/**
 * PGlite-backed test database helper.
 *
 * Uses `@electric-sql/pglite` (already in devDependencies) so server
 * integration tests can exercise real Drizzle queries without a live
 * PostgreSQL instance. Migrations are applied from the checked-in SQL
 * snapshot.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFile, readdir } from 'node:fs/promises';
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
  const migrationsDir = join(__dirname, '../../db/migrations');
  // Apply every checked-in migration in filename order so new migrations
  // are picked up without editing this helper.
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    // Strip drizzle-kit breakpoint comments and execute the whole snapshot.
    const cleaned = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--> statement-breakpoint'))
      .join('\n');
    await pg.exec(cleaned);
  }
  return { pg, db };
}

export async function closeTestDatabase(pg: PGlite): Promise<void> {
  await pg.close();
}
