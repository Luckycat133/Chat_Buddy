/**
 * Offline outbox. The Web client never trusts the network round-trip
 * alone: every client-initiated mutation goes through here with a stable
 * client idempotency key (DOMAIN_ARCHITECTURE §13). On reconnect, the
 * outbox replays pending entries exactly once.
 */
import {
  putEntity,
  readSyncCursor,
  openDatabase,
} from './idb.js';
import { type CloudClient, CloudRequestError } from '../api/client.js';

export type OutboxState = 'queued' | 'sending' | 'accepted' | 'failed' | 'conflicted';

export interface OutboxEntry {
  id: string;
  accountId: string;
  /** Stable client-supplied idempotency key. */
  idempotencyKey: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body: unknown;
  state: OutboxState;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxResult {
  accepted: number;
  failed: number;
  conflicted: number;
}

/**
 * Submit a mutation. Returns immediately with `queued` state, schedules
 * a background flush attempt. UI may render optimistic state from the
 * returned entry.
 */
export function enqueueMutation(args: {
  client: CloudClient;
  accountId: string;
  method: OutboxEntry['method'];
  path: string;
  body: unknown;
  idempotencyKey: string;
}): OutboxEntry {
  const now = new Date().toISOString();
  const entry: OutboxEntry = {
    id: cryptoRandomId(),
    accountId: args.accountId,
    idempotencyKey: args.idempotencyKey,
    method: args.method,
    path: args.path,
    body: args.body,
    state: 'queued',
    attempts: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  // Best-effort enqueue; if IndexedDB is unavailable, callers must surface.
  void persistEntry(entry);
  // Kick a flush on the next tick.
  setTimeout(() => {
    void flushOutbox(args.client, args.accountId);
  }, 0);
  return entry;
}

/**
 * Flush all queued entries for an account. Idempotent: the server
 * collapses duplicate idempotency keys. Caller may invoke this on
 * reconnect / app foreground / online event.
 */
export async function flushOutbox(
  client: CloudClient,
  accountId: string,
): Promise<OutboxResult> {
  const queued = await loadEntries(accountId, ['queued', 'failed']);
  let accepted = 0;
  let failed = 0;
  let conflicted = 0;
  for (const entry of queued) {
    const updated: OutboxEntry = {
      ...entry,
      state: 'sending',
      attempts: entry.attempts + 1,
      updatedAt: new Date().toISOString(),
    };
    await persistEntry(updated);
    try {
      await raw(client, updated);
      await persistEntry({
        ...updated,
        state: 'accepted',
        lastError: null,
        updatedAt: new Date().toISOString(),
      });
      accepted += 1;
    } catch (err) {
      if (err instanceof CloudRequestError && err.status === 409) {
        await persistEntry({
          ...updated,
          state: 'conflicted',
          lastError: err.message,
          updatedAt: new Date().toISOString(),
        });
        conflicted += 1;
      } else {
        const message = err instanceof Error ? err.message : String(err);
        await persistEntry({
          ...updated,
          state: 'failed',
          lastError: message,
          updatedAt: new Date().toISOString(),
        });
        failed += 1;
      }
    }
  }
  return { accepted, failed, conflicted };
}

/* ---------------------------- internal helpers --------------------------- */

async function raw(
  client: CloudClient,
  entry: OutboxEntry,
): Promise<unknown> {
  const init: RequestInit = {
    method: entry.method,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': entry.idempotencyKey,
    },
    body: entry.body === undefined ? undefined : JSON.stringify(entry.body),
  };
  const token = client.getAccessToken();
  if (token) {
    (init.headers as Record<string, string>).authorization = `Bearer ${token}`;
  }
  const fullUrl = entry.path.startsWith('http')
    ? entry.path
    : client.baseUrl + (entry.path.startsWith('/') ? entry.path : `/${entry.path}`);
  const res = await client.fetchImpl(fullUrl, init);
  if (!res.ok) {
    const text = await res.text();
    throw new CloudRequestError(
      {
        error: {
          code: res.status === 409 ? 'CONFLICT' : 'INTERNAL',
          message: text || `HTTP ${res.status}`,
          requestId: res.headers.get('x-request-id') ?? '',
        },
      },
      res.status,
    );
  }
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function loadEntries(
  accountId: string,
  states: OutboxState[],
): Promise<OutboxEntry[]> {
  const all = await loadAllEntries(accountId);
  const stateSet = new Set(states);
  return all.filter((e) => stateSet.has(e.state));
}

async function loadAllEntries(accountId: string): Promise<OutboxEntry[]> {
  const db = await openDatabase();
  return new Promise<OutboxEntry[]>((resolve, reject) => {
    const transaction = db.transaction('outbox', 'readonly');
    const store = transaction.objectStore('outbox');
    const r = store.getAll();
    r.onsuccess = () => {
      const rows = (r.result as OutboxEntry[]).filter(
        (e) => e.accountId === accountId,
      );
      resolve(rows);
    };
    r.onerror = () => reject(r.error);
  });
}

async function persistEntry(entry: OutboxEntry): Promise<void> {
  await putEntity({
    table: 'outbox',
    id: entry.id,
    payload: entry,
    updatedAt: entry.updatedAt,
  });
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Read cursor is re-exported for callers that want to integrate sync.
export { readSyncCursor };
