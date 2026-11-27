import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { accounts, devices, sessions } from '../../db/schema.js';
import { AccountDeletionReceiptSchema } from '../../shared/contracts/account.js';
import { issueTokens, revokeSession } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import { buildServer } from '../index.js';
import { seedSocialGraph } from '../test/fixtures.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';

let app: FastifyInstance;
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let db: Database;
let accountId: string;

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/test');
  vi.stubEnv('SESSION_SIGNING_KEY', 'f'.repeat(64));
  vi.stubEnv('LOG_LEVEL', 'silent');
  resetServerEnvForTests();
  fixture = await createTestDatabase();
  db = fixture.db as unknown as Database;
  app = await buildServer({ db, listen: false });
});

beforeEach(async () => {
  ({ accountId } = await seedSocialGraph(fixture.db));
});

afterAll(async () => {
  await app?.close();
  if (fixture) await closeTestDatabase(fixture.pg);
  vi.unstubAllEnvs();
  resetServerEnvForTests();
});

const confirmation = { confirmation: 'delete my account' };

function bearer(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

function remove(accessToken: string | undefined, payload: object = confirmation) {
  return app.inject({
    method: 'POST',
    url: '/v1/account/delete',
    ...(accessToken ? { headers: bearer(accessToken) } : {}),
    payload,
  });
}

function refresh(refreshToken: string) {
  return app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken } });
}

function listSessions(accessToken: string) {
  return app.inject({ method: 'GET', url: '/v1/auth/sessions', headers: bearer(accessToken) });
}

async function registerFixtureDevice(ownerId: string, platform = 'ios') {
  await db.insert(devices).values({
    accountId: ownerId,
    platform,
    appVersion: 'fixture',
    pushTokenEncrypted: 'synthetic-opaque-fixture',
    notificationPermission: 'granted',
  });
}

async function getAccount(ownerId = accountId) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, ownerId));
  return account;
}

describe('account deletion request', () => {
  it('requires the caller’s bearer and exact destructive confirmation', async () => {
    const current = await issueTokens(db, accountId);
    const other = await seedSocialGraph(fixture.db);
    expect((await remove(undefined)).statusCode).toBe(401);
    expect((await remove('invalid')).statusCode).toBe(401);
    expect((await remove(current.accessToken, { confirmation: 'cancel' })).statusCode).toBe(422);
    expect((await remove(current.accessToken, { ...confirmation, accountId: other.accountId })).statusCode).toBe(422);
    expect((await getAccount())?.status).toBe('active');
    expect((await getAccount(other.accountId))?.status).toBe('active');
  });

  it('commits access removal and the initiator’s receipt, leaving another account available', async () => {
    const current = await issueTokens(db, accountId);
    const second = await issueTokens(db, accountId);
    const old = await issueTokens(db, accountId, 'Previously revoked device');
    const previouslyRevokedAt = new Date(1_000);
    await db.update(sessions).set({ revokedAt: previouslyRevokedAt })
      .where(and(eq(sessions.accountId, accountId), eq(sessions.userAgent, 'Previously revoked device')));
    const other = await seedSocialGraph(fixture.db);
    const otherTokens = await issueTokens(db, other.accountId);
    await registerFixtureDevice(accountId);
    await registerFixtureDevice(accountId, 'web');
    await registerFixtureDevice(other.accountId);

    const reply = await remove(current.accessToken);
    expect(reply.statusCode).toBe(200);
    const receipt = AccountDeletionReceiptSchema.parse(reply.json());
    expect(await getAccount()).toMatchObject({ status: 'deleting', deletedAt: new Date(receipt.deletionStartedAt) });
    const ownDevices = await db.select().from(devices).where(eq(devices.accountId, accountId));
    expect(ownDevices).toHaveLength(2);
    for (const device of ownDevices) {
      expect(device).toMatchObject({ pushTokenEncrypted: null, notificationPermission: 'denied' });
    }
    const [otherDevice] = await db.select().from(devices).where(eq(devices.accountId, other.accountId));
    expect(otherDevice).toMatchObject({ pushTokenEncrypted: 'synthetic-opaque-fixture', notificationPermission: 'granted' });
    expect((await getAccount(other.accountId))?.status).toBe('active');

    for (const tokens of [current, second, old]) {
      expect((await listSessions(tokens.accessToken)).statusCode).toBe(401);
      expect((await refresh(tokens.refreshToken)).statusCode).toBe(401);
    }
    expect((await listSessions(otherTokens.accessToken)).statusCode).toBe(200);
    await expect(issueTokens(db, accountId)).rejects.toMatchObject({ status: 401 });
    await revokeSession(db, accountId);
    const replay = await remove(current.accessToken);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(receipt);
    expect((await remove(second.accessToken)).statusCode).toBe(401);
    expect((await remove(old.accessToken)).statusCode).toBe(401);
    expect((await getAccount())?.deletedAt?.toISOString()).toBe(receipt.deletionStartedAt);
    const ownSessions = await db.select().from(sessions).where(eq(sessions.accountId, accountId));
    expect(ownSessions).toHaveLength(3);
    expect(ownSessions.find((session) => session.userAgent === 'Previously revoked device')?.revokedAt)
      .toEqual(previouslyRevokedAt);

    vi.setSystemTime(new Date(current.accessExpiresAt.getTime() + 1));
    try {
      expect((await remove(current.accessToken)).statusCode).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rolls back deletion, session revocation and the receipt if push removal fails', async () => {
    const current = await issueTokens(db, accountId);
    await registerFixtureDevice(accountId);
    await db.execute(sql`alter table devices add constraint fixture_requires_push check (push_token_encrypted is not null) not valid`);
    try {
      expect((await remove(current.accessToken)).statusCode).toBe(500);
      expect(await getAccount()).toMatchObject({ status: 'active', deletedAt: null });
      expect((await listSessions(current.accessToken)).statusCode).toBe(200);
      const [device] = await db.select().from(devices).where(eq(devices.accountId, accountId));
      expect(device).toMatchObject({ pushTokenEncrypted: 'synthetic-opaque-fixture', notificationPermission: 'granted' });
    } finally {
      await db.execute(sql`alter table devices drop constraint fixture_requires_push`);
    }
  });

  it('accepts only one concurrent refresh of the same token', async () => {
    const current = await issueTokens(db, accountId, 'Rotation fixture');
    const attempts = await Promise.all([refresh(current.refreshToken), refresh(current.refreshToken)]);
    expect(attempts.map((attempt) => attempt.statusCode).sort()).toEqual([200, 401]);
    const active = await db.select().from(sessions).where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)));
    expect(active).toHaveLength(1);
    expect(active[0]?.userAgent).toBe('Rotation fixture');
  });

  it('cannot retain a usable rotated session racing account deletion', async () => {
    const current = await issueTokens(db, accountId);
    const second = await issueTokens(db, accountId);
    const [deletion, rotation] = await Promise.all([remove(current.accessToken), refresh(second.refreshToken)]);
    expect(deletion.statusCode).toBe(200);
    expect([200, 401]).toContain(rotation.statusCode);
    if (rotation.statusCode === 200) {
      const rotated = rotation.json<{ accessToken: string; refreshToken: string }>();
      expect((await listSessions(rotated.accessToken)).statusCode).toBe(401);
      expect((await refresh(rotated.refreshToken)).statusCode).toBe(401);
    }
    const active = await db.select().from(sessions).where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)));
    expect(active).toHaveLength(0);
  });

  it('rejects access, refresh, issue and deletion for a suspended account with an unrevoked session', async () => {
    const current = await issueTokens(db, accountId);
    await db.update(accounts).set({ status: 'suspended' }).where(eq(accounts.id, accountId));
    expect((await listSessions(current.accessToken)).statusCode).toBe(401);
    expect((await refresh(current.refreshToken)).statusCode).toBe(401);
    expect((await remove(current.accessToken)).statusCode).toBe(401);
    await expect(issueTokens(db, accountId)).rejects.toMatchObject({ status: 401 });
  });
});
