/**
 * Apply the checked-in Drizzle migration journal against DATABASE_URL.
 */
import postgres from 'postgres';
import { loadServerEnv } from '../server/config.js';
import { applyMigrationPlan, readMigrationPlan } from './migration-plan.js';

async function main(): Promise<void> {
  const env = loadServerEnv();
  const plan = readMigrationPlan();
  const client = postgres(env.DATABASE_URL, { max: 1, prepare: !env.DATABASE_POOLED });
  try {
    const applied = await client.begin(tx => applyMigrationPlan(
      async <Row extends Record<string, unknown>>(query: string, params: (string | number)[] = []) =>
        tx.unsafe<Row[]>(query, params),
      plan,
    ));
    console.log(`migrations applied: ${applied}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('migration failed:', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
