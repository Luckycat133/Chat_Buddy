import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { buildServer } from '../index.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';
import { seedSocialGraph } from '../test/fixtures.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import { sessions } from '../../db/schema.js';
import type { Database } from '../../db/index.js';

let app: FastifyInstance;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
let accountId: string;

function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function setEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  process.env.SESSION_TTL_SEC = '1209600';
  process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
  resetServerEnvForTests();
}

beforeEach(async () => {
  const created = await createTestDatabase();
  pg = created.pg;
  db = created.db;
  setEnv();
  app = await buildServer({ db: db as unknown as Database, listen: false });
  const seed = await seedSocialGraph(db);
  accountId = seed.accountId;
});

afterEach(async () => {
  resetServerEnvForTests();
  await app.close();
  await closeTestDatabase(pg);
});

describe('device session management', () => {
  it('stores the user agent and access-token hash, then updates last seen', async () => {
    const before = new Date(Date.now() - 60_000);
    const tokens = await issueTokens(
      db as unknown as Database,
      accountId,
      'Chat Buddy Test Browser',
    );
    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.accountId, accountId));
    expect(row?.userAgent).toBe('Chat Buddy Test Browser');
    expect(row?.accessTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row?.accessTokenHash).not.toBe(tokens.accessToken);

    await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: bearer(tokens.accessToken),
    });
    const [seen] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, row!.id));
    expect(seen!.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
  });

  it('lists owned sessions and revokes another owned session', async () => {
    const first = await issueTokens(db as unknown as Database, accountId, 'Browser A');
    const second = await issueTokens(db as unknown as Database, accountId, 'Browser B');

    const listed = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: bearer(first.accessToken),
    });
    expect(listed.statusCode).toBe(200);
    const items = listed.json().items as Array<{
      id: string;
      current: boolean;
      userAgent: string;
    }>;
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.current)?.userAgent).toBe('Browser A');
    const other = items.find((item) => !item.current)!;

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/auth/sessions/${other.id}`,
      headers: bearer(first.accessToken),
    });
    expect(deleted.statusCode).toBe(200);

    const revoked = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: bearer(second.accessToken),
    });
    expect(revoked.statusCode).toBe(401);
  });

  it('does not expose or revoke a session owned by another account', async () => {
    const mine = await issueTokens(db as unknown as Database, accountId, 'Mine');
    const otherSeed = await seedSocialGraph(db);
    const other = await issueTokens(
      db as unknown as Database,
      otherSeed.accountId,
      'Other account',
    );
    const [otherRow] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(
        eq(sessions.accountId, otherSeed.accountId),
        eq(sessions.userAgent, 'Other account'),
      ));

    const listed = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: bearer(mine.accessToken),
    });
    expect(
      (listed.json().items as Array<{ id: string }>).some(
        (item) => item.id === otherRow!.id,
      ),
    ).toBe(false);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/auth/sessions/${otherRow!.id}`,
      headers: bearer(mine.accessToken),
    });
    expect(deleted.statusCode).toBe(404);
    expect(
      (await app.inject({
        method: 'GET',
        url: '/v1/auth/sessions',
        headers: bearer(other.accessToken),
      })).statusCode,
    ).toBe(200);
  });

  it('rejects revoking the current session', async () => {
    const current = await issueTokens(db as unknown as Database, accountId, 'Current');
    const listed = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: bearer(current.accessToken),
    });
    const currentId = (listed.json().items as Array<{ id: string; current: boolean }>)
      .find((item) => item.current)!.id;
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/auth/sessions/${currentId}`,
      headers: bearer(current.accessToken),
    });
    expect(deleted.statusCode).toBe(409);
  });

  it('returns 401 after the session expires even if the access signature is valid', async () => {
    const tokens = await issueTokens(db as unknown as Database, accountId, 'Expired');
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(sessions.accountId, accountId));
    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: bearer(tokens.accessToken),
    });
    expect(response.statusCode).toBe(401);
  });
});
