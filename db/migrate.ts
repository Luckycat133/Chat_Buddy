/**
 * Apply pending Drizzle migrations against `DATABASE_URL`.
 * Use only on environments you trust with destructive operations.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadServerEnv } from '../server/config.js';

async function main(): Promise<void> {
  const env = loadServerEnv();
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: './db/migrations' });
  await client.end();
   
  console.log('migrations applied');
}

main().catch((err) => {
   
  console.error('migration failed', err);
  process.exit(1);
});
