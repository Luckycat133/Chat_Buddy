/**
 * PGlite-backed test database helper.
 *
 * Uses `@electric-sql/pglite` (already in devDependencies) so server
 * integration tests can exercise real Drizzle queries without a live
 * PostgreSQL instance. The Drizzle journal is the source of migration
 * order here and in the PostgreSQL deployment command.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../../db/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

export async function createTestDatabase(): Promise<{
  pg: PGlite;
  db: TestDatabase;
}> {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  try {
    await migrate(db, { migrationsFolder: join(__dirname, '../../db/migrations') });
  } catch (error) {
    await pg.close();
    throw error;
  }
  return { pg, db };
}

export async function closeTestDatabase(pg: PGlite): Promise<void> {
  await pg.close();
}
