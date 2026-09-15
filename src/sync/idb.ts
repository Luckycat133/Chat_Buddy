/**
 * IndexedDB cache foundation for the Web cloud client.
 *
 * Per WEB_IMPLEMENTATION §8 the local cache stores:
 *   - normalized entities (by id)
 *   - sync cursor
 *   - outbound outbox (queued messages)
 *
 * This file is intentionally framework-agnostic: the Web UI binds to it
 * via thin hooks. Schema versioning lives next to the upgrade callbacks.
 */
const DB_NAME = 'cb-cloud-cache';
const DB_VERSION = 1;

export type CacheStore =
  | 'entities'
  | 'messages'
  | 'moments'
  | 'syncCursor'
  | 'outbox'
  | 'meta';

const STORE_SCHEMAS: Record<CacheStore, string> = {
  entities: 'table,id',
  messages: 'conversationId,id',
  moments: 'id',
  syncCursor: 'accountId',
  outbox: 'id,createdAt',
  meta: 'key',
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of Object.keys(STORE_SCHEMAS) as CacheStore[]) {
        if (!db.objectStoreNames.contains(store)) {
          const newStore = db.createObjectStore(store, {
            keyPath: primaryKeyOf(store),
          });
          const indexSpec = STORE_SCHEMAS[store];
          if (indexSpec.includes(',')) {
            const [, idx] = indexSpec.split(',');
            if (idx) newStore.createIndex(`${store}_idx`, idx);
          }
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () =>
      reject(new Error('IndexedDB open blocked by another connection'));
  });
  return dbPromise;
}

function primaryKeyOf(store: CacheStore): string {
  switch (store) {
    case 'syncCursor':
      return 'accountId';
    case 'meta':
      return 'key';
    default:
      return 'id';
  }
}

async function tx<T>(
  store: CacheStore,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const objectStore = transaction.objectStore(store);
    let result: T | undefined;
    let settled = false;
    const settle = (err?: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(value as T);
    };
    transaction.oncomplete = () => settle(undefined, result);
    transaction.onerror = () =>
      settle(transaction.error ?? new Error('IndexedDB tx error'));
    transaction.onabort = () =>
      settle(transaction.error ?? new Error('IndexedDB tx aborted'));
    const r = fn(objectStore);
    if (r instanceof Promise) {
      r.then((v) => {
        result = v;
      }).catch((err) => {
        try {
          transaction.abort();
        } catch {
          /* ignore */
        }
        settle(err);
      });
    } else {
      r.onsuccess = () => {
        result = r.result as T;
      };
      r.onerror = () => settle(r.error ?? new Error('IndexedDB request error'));
    }
  });
}

/* ----------------------------- public API -------------------------------- */

export interface EntityRecord {
  table: string;
  id: string;
  payload: unknown;
  updatedAt: string;
}

export async function putEntity(record: EntityRecord): Promise<void> {
  await tx('entities', 'readwrite', (s) => s.put(record));
}

export async function putEntities(records: EntityRecord[]): Promise<void> {
  if (records.length === 0) return;
  await tx('entities', 'readwrite', (s) => {
    for (const r of records) s.put(r);
    return s.transaction as unknown as IDBRequest<void>;
  });
}

export async function getEntity(
  table: string,
  id: string,
): Promise<EntityRecord | null> {
  return tx<EntityRecord | undefined>('entities', 'readonly', (s) => {
    return new Promise<EntityRecord | undefined>((resolve, reject) => {
      const r = s.index('entities_idx').get([table, id]);
      r.onsuccess = () => resolve(r.result as EntityRecord | undefined);
      r.onerror = () => reject(r.error ?? new Error('IndexedDB read failed'));
    });
  }).then((v) => v ?? null);
}

export async function deleteEntity(table: string, id: string): Promise<void> {
  await tx('entities', 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const r = s.index('entities_idx').getKey([table, id]);
      r.onsuccess = () => {
        if (r.result) {
          const del = s.delete(r.result as IDBValidKey);
          del.onsuccess = () => resolve();
          del.onerror = () => reject(del.error);
        } else {
          resolve();
        }
      };
      r.onerror = () => reject(r.error);
    });
  });
}

export interface SyncCursorRecord {
  accountId: string;
  cursor: string;
  updatedAt: string;
}

export async function readSyncCursor(
  accountId: string,
): Promise<SyncCursorRecord | null> {
  return tx<SyncCursorRecord | undefined>('syncCursor', 'readonly', (s) => {
    return new Promise<SyncCursorRecord | undefined>((resolve, reject) => {
      const r = s.get(accountId);
      r.onsuccess = () => resolve(r.result as SyncCursorRecord | undefined);
      r.onerror = () => reject(r.error);
    });
  }).then((v) => v ?? null);
}

export async function writeSyncCursor(record: SyncCursorRecord): Promise<void> {
  await tx('syncCursor', 'readwrite', (s) => s.put(record));
}

/**
 * Clear per-account sync state and outbox. Entity cache is intentionally
 * retained so a quick re-login preserves the read-side cache; call
 * {@link purgeAllCachesForAccount} if a hard wipe is required (e.g. account
 * deletion).
 */
export async function clearAccountState(accountId: string): Promise<void> {
  await Promise.all([
    tx('syncCursor', 'readwrite', (s) => s.delete(accountId)),
    tx('outbox', 'readwrite', (s) => {
      return new Promise<void>((resolve) => {
        const r = s.openCursor();
        r.onsuccess = () => {
          const cursor = r.result;
          if (cursor) {
            const v = cursor.value as { accountId?: string };
            if (v.accountId === accountId) cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    }),
  ]);
}

/**
 * Hard wipe everything tied to an account: sync cursor, outbox, and
 * every entity whose payload references the account id (best-effort scan
 * of the `accountId` field on each record). Use for account deletion.
 */
export async function purgeAllCachesForAccount(accountId: string): Promise<void> {
  await clearAccountState(accountId);
  await tx('entities', 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const r = s.openCursor();
      r.onsuccess = () => {
        const cursor = r.result;
        if (cursor) {
          const v = cursor.value as EntityRecord;
          const payload = v.payload as { accountId?: unknown } | null;
          if (payload && payload.accountId === accountId) cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      r.onerror = () => reject(r.error);
    });
  });
}
