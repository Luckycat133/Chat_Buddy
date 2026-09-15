/**
 * Drizzle database client. Server-only.
 *
 * Per WEB_IMPLEMENTATION §3, services connect to PostgreSQL via `postgres`
 * (postgres.js). The schema lives in `./schema.ts`. Migrations live in
 * `./migrations/` and are produced by `drizzle-kit generate`.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDatabase>;

export interface DatabaseConfig {
  databaseUrl: string;
  /** Maximum pool size; postgres.js default is 10. */
  max?: number;
  /** Statement timeout in seconds; default 30 to keep realtime responsive. */
  statementTimeoutSec?: number;
  /** Whether the connection is to a managed pooler (PgBouncer transaction mode). */
  pooled?: boolean;
}

export function createDatabase(config: DatabaseConfig) {
  const client = postgres(config.databaseUrl, {
    max: config.max ?? 10,
    // PgBouncer transaction mode forbids prepared statements; opt out when used.
    prepare: !config.pooled,
    onnotice: () => {
      /* swallow NOTICEs to avoid noisy logs */
    },
  });
  return drizzle(client, { schema });
}

export type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
export { schema };
