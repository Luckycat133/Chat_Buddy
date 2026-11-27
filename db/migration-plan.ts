import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readMigrationFiles } from 'drizzle-orm/migrator';

const ledger = 'drizzle.__drizzle_migrations';
export const MIGRATIONS_FOLDER = './db/migrations';

// The original 0000 at 693f9025 required tool_executions.conversation_id.
// 072a3bc6 made the column nullable in-place without changing its journal time.
export const ORIGINAL_0000_HASH = '6d875a3d5dd39ef93aabfcd355d766d0736c88fcb46265e72cc255a0bcc6b751';
const NULLABLE_0000_HASH = '7fba5f676f6e7d4e6b72a9b4625ff8d5a5d2147e87574aaaa1b672061e5f21c8';

type Snapshot = {
  tables: Record<string, {
    name: string;
    columns: Record<string, { name: string; type: string; notNull: boolean }>;
    indexes: Record<string, { name: string; isUnique: boolean }>;
  }>;
  enums: Record<string, { name: string; values: string[] }>;
};

/** The caller binds this function to one open PostgreSQL transaction. */
export type MigrationQuery = <Row extends Record<string, unknown>>(
  query: string,
  params?: (string | number)[],
) => Promise<readonly Row[]>;

export function readMigrationPlan(folder = MIGRATIONS_FOLDER) {
  const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8')) as {
    dialect: string;
    entries: Array<{ idx: number; when: number; tag: string }>;
  };
  const scripts = readdirSync(folder).filter(filename => filename.endsWith('.sql')).sort();
  if (journal.dialect !== 'postgresql' || scripts.length === 0 || journal.entries.length !== scripts.length
      || journal.entries.some((entry, idx) => entry.idx !== idx
        || `${entry.tag}.sql` !== scripts[idx]
        || !Number.isSafeInteger(entry.when)
        || entry.when <= (journal.entries[idx - 1]?.when ?? 0))) {
    throw new Error('Migration journal must list every SQL file in order with increasing timestamps.');
  }
  return readMigrationFiles({ migrationsFolder: folder }).map((migration, idx) => ({
    ...migration,
    snapshot: JSON.parse(readFileSync(
      join(folder, `meta/${String(idx).padStart(4, '0')}_snapshot.json`), 'utf8',
    )) as Snapshot,
  }));
}

function requireSameShape(label: string, actual: string[], expected: string[]): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.find(value => !actualSet.has(value));
  const unexpected = actual.find(value => !expectedSet.has(value));
  if (missing || unexpected) {
    const difference = missing ? `missing ${missing}` : `unexpected ${unexpected}`;
    throw new Error(`Refusing migration: recorded schema has ${label} drift (${difference}).`);
  }
}

async function verifySchema(query: MigrationQuery, snapshot: Snapshot, nullableBaseline: boolean): Promise<void> {
  // The historical SQL and snapshots describe this application's public schema.
  const columns = await query<{ table_name: string; name: string; type: string; not_null: boolean }>(`
    select c.relname as table_name, a.attname as name, a.attnotnull as not_null,
      pg_catalog.format_type(a.atttypid, a.atttypmod) as type
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
  `);
  requireSameShape('column',
    columns.map(row => `${row.table_name}.${row.name} ${row.type} ${row.not_null ? 'NOT NULL' : 'NULL'}`),
    Object.values(snapshot.tables).flatMap(table => Object.values(table.columns).map(column => {
      const nullableOverride = nullableBaseline && table.name === 'tool_executions' && column.name === 'conversation_id';
      return `${table.name}.${column.name} ${column.type} ${column.notNull && !nullableOverride ? 'NOT NULL' : 'NULL'}`;
    })),
  );

  const indexes = await query<{ table_name: string; name: string; unique_index: boolean }>(`
    select t.relname as table_name, c.relname as name, i.indisunique as unique_index
    from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indexrelid
    join pg_catalog.pg_class t on t.oid = i.indrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and not exists (
      select 1 from pg_catalog.pg_constraint k where k.conrelid = t.oid and k.conindid = c.oid
    )
  `);
  requireSameShape('index',
    indexes.map(row => `${row.table_name}.${row.name}${row.unique_index ? ' UNIQUE' : ''}`),
    Object.values(snapshot.tables).flatMap(table => Object.values(table.indexes).map(
      index => `${table.name}.${index.name}${index.isUnique ? ' UNIQUE' : ''}`,
    )),
  );

  const enums = await query<{ name: string; labels: string[] }>(`
    select t.typname as name, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
    from pg_catalog.pg_type t join pg_catalog.pg_enum e on e.enumtypid = t.oid
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by t.typname
  `);
  requireSameShape('enum',
    enums.map(row => `${row.name}: ${row.labels.join(',')}`),
    Object.values(snapshot.enums).map(type => `${type.name}: ${type.values.join(',')}`),
  );
}

/**
 * Use Drizzle's SQL reader and ledger format. Keep the history preflight,
 * migration statements and receipts together under a transaction lock.
 */
export async function applyMigrationPlan(query: MigrationQuery, plan = readMigrationPlan()): Promise<number> {
  await query("select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('chat-buddy:schema-migrations'))");
  await query('set local search_path to public, pg_catalog');

  const [state] = await query<{ ledger_exists: boolean; public_used: boolean }>(`
    select pg_catalog.to_regclass('${ledger}') is not null as ledger_exists,
      exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public')
      or exists (select 1 from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype in ('e', 'd', 'r')) as public_used
  `);
  const receipts = state?.ledger_exists
    ? await query<{ hash: string; created_at: string | null }>(
      `select hash, created_at::text from ${ledger} order by created_at nulls first, id`,
    )
    : [];
  for (const [idx, receipt] of receipts.entries()) {
    const expected = plan[idx];
    const originalBaseline = idx === 0 && expected?.hash === NULLABLE_0000_HASH && receipt.hash === ORIGINAL_0000_HASH;
    if (!expected || receipt.created_at !== String(expected.folderMillis)
        || (receipt.hash !== expected.hash && !originalBaseline)) {
      throw new Error('Refusing migration: Drizzle history is not a recognized prefix of the checked-in journal.');
    }
  }
  if (receipts.length === 0 && state?.public_used) {
    throw new Error('Refusing migration: public schema is nonempty without trusted Drizzle history. Review a backup before reconciling an SQL-bootstrap database.');
  }
  const current = plan[receipts.length - 1];
  if (current) {
    await verifySchema(query, current.snapshot, receipts.length === 1 && receipts[0]?.hash === NULLABLE_0000_HASH);
  }

  const pending = plan.slice(receipts.length);
  if (pending.length === 0) return 0;
  await query('create schema if not exists drizzle');
  await query(`create table if not exists ${ledger} (
    id serial primary key, hash text not null, created_at bigint
  )`);
  for (const migration of pending) {
    for (const statement of migration.sql) {
      if (statement.trim()) await query(statement);
    }
    await query(`insert into ${ledger} (hash, created_at) values ($1, $2)`,
      [migration.hash, migration.folderMillis]);
  }
  await verifySchema(query, pending.at(-1)!.snapshot, false);
  return pending.length;
}
