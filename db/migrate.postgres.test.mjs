import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { after, test } from 'node:test';
import { promisify } from 'node:util';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const fixtureUrl = process.env.MIGRATION_TEST_DATABASE_URL;
assert.ok(fixtureUrl, 'Set MIGRATION_TEST_DATABASE_URL to the disposable PostgreSQL service.');
const adminUrl = new URL(fixtureUrl);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(adminUrl.hostname), 'Use a loopback PostgreSQL fixture.');
const admin = postgres(adminUrl.href, { max: 1 });
after(() => admin.end());

const run = promisify(execFile);
const journal = JSON.parse(await readFile(new URL('./migrations/meta/_journal.json', import.meta.url), 'utf8'));
const history = await Promise.all(journal.entries.map(async entry => ({
  ...entry,
  sql: await readFile(new URL(`./migrations/${entry.tag}.sql`, import.meta.url), 'utf8'),
})));
const originalHash = '6d875a3d5dd39ef93aabfcd355d766d0736c88fcb46265e72cc255a0bcc6b751';

async function createFixture(t) {
  const name = `cb_r5_${randomUUID().replaceAll('-', '')}`;
  await admin`create database ${admin(name)}`;
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const client = postgres(url.href, { max: 1, onnotice: () => {} });
  t.after(async () => {
    await client.end();
    await admin`drop database ${admin(name)}`;
  });
  return { client, url: url.href };
}

function cli(url) {
  return run('npm', ['run', 'db:migrate'], {
    env: {
      ...process.env, DATABASE_URL: url, DATABASE_POOLED: 'false', NODE_ENV: 'test',
      SESSION_SIGNING_KEY: 'synthetic-r5-migration-fixture-signing-key',
    },
  });
}

async function legacyDrizzle(client, original) {
  const folder = await mkdtemp(join(tmpdir(), 'chat-buddy-old-drizzle-'));
  try {
    await mkdir(join(folder, 'meta'));
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }));
    let sql = history[0].sql;
    if (original) {
      // Reproduce the immutable bytes of 693f9025 without a full Git checkout in CI.
      const start = sql.indexOf('CREATE TABLE IF NOT EXISTS "tool_executions"');
      assert.ok(start >= 0);
      sql = sql.slice(0, start) + sql.slice(start).replace('"conversation_id" uuid,', '"conversation_id" uuid NOT NULL,');
      assert.equal(createHash('sha256').update(sql).digest('hex'), originalHash);
    }
    await writeFile(join(folder, `${history[0].tag}.sql`), sql);
    await migrate(drizzle(client), { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

function receipts(client) {
  return client`select id, hash, created_at::text from drizzle.__drizzle_migrations order by created_at`;
}

async function assertLatest(client) {
  const [checkpoint] = await client`select
    to_regclass('public.push_delivery_attempts') is not null as delivery_table,
    to_regclass('public.actor_reports_graph_idx') is not null as report_index,
    to_regclass('public.contact_invites_creator_idx') is not null as existing_invite_index,
    (select count(*)::int from information_schema.columns where table_schema = 'public'
      and table_name = 'sessions' and column_name in ('access_token_hash', 'user_agent', 'last_seen_at')) as session_fields`;
  assert.deepEqual({ ...checkpoint }, { delivery_table: true, report_index: true, existing_invite_index: true, session_fields: 3 });
  assert.equal((await receipts(client)).length, history.length);
}

test('production migration command applies a clean journal and the next run is a no-op', async t => {
  const { client, url } = await createFixture(t);
  assert.match((await cli(url)).stdout, new RegExp(`migrations applied: ${history.length}\\b`));
  await assertLatest(client);
  const before = [...await receipts(client)];
  assert.match((await cli(url)).stdout, /migrations applied: 0\b/);
  assert.deepEqual([...await receipts(client)], before);
});

for (const original of [true, false]) {
  test(`upgrades the ${original ? 'original' : 'nullable'} recorded 0000 and preserves session data`, async t => {
    const { client, url } = await createFixture(t);
    await legacyDrizzle(client, original);
    const [before] = await receipts(client);
    const [column] = await client`select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'tool_executions' and column_name = 'conversation_id'`;
    assert.equal(column.is_nullable, original ? 'NO' : 'YES');
    const [account] = await client`insert into accounts (display_name) values ('R5 fixture') returning id`;
    const [session] = await client`insert into sessions (account_id, refresh_token_hash, expires_at)
      values (${account.id}, 'fixture-hash', now() + interval '1 day') returning id`;

    assert.match((await cli(url)).stdout, new RegExp(`migrations applied: ${history.length - 1}\\b`));
    await assertLatest(client);
    assert.deepEqual((await receipts(client))[0], before);
    const [afterSession] = await client`select account_id, refresh_token_hash, user_agent, last_seen_at is not null as seen
      from sessions where id = ${session.id}`;
    assert.deepEqual({ ...afterSession }, {
      account_id: account.id, refresh_token_hash: 'fixture-hash', user_agent: 'Unknown', seen: true,
    });
    assert.match((await cli(url)).stdout, /migrations applied: 0\b/);
  });
}

test('refuses old all-SQL bootstrapping without creating a Drizzle receipt', async t => {
  const { client, url } = await createFixture(t);
  for (const migration of history.slice(0, 6)) await client.unsafe(migration.sql).simple();
  await assert.rejects(cli(url), /nonempty without trusted Drizzle history/);
  const [state] = await client`select to_regclass('drizzle.__drizzle_migrations') is null as no_receipt,
    to_regclass('public.actor_reports_graph_idx') is null as no_new_index`;
  assert.deepEqual({ ...state }, { no_receipt: true, no_new_index: true });
});

test('refuses unrecorded schema changes beside a known receipt', async t => {
  const { client, url } = await createFixture(t);
  await legacyDrizzle(client, false);
  const before = [...await receipts(client)];
  await client.unsafe(history[1].sql).simple();
  await assert.rejects(cli(url), /recorded schema has column drift/);
  assert.deepEqual([...await receipts(client)], before);
  const [state] = await client`select to_regclass('public.push_delivery_attempts') is null as no_pending_table`;
  assert.equal(state.no_pending_table, true);
});

test('serializes simultaneous production migrations on the same new database', async t => {
  const { client, url } = await createFixture(t);
  const afterRuns = await Promise.all([cli(url), cli(url)]);
  const applied = afterRuns.map(({ stdout }) => Number(stdout.match(/migrations applied: (\d+)/)?.[1])).sort((a, b) => a - b);
  assert.deepEqual(applied, [0, history.length]);
  await assertLatest(client);
});
