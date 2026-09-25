import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildServer } from '../index.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';
import { seedSocialGraph, type SeededGraph } from '../test/fixtures.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import type { Database } from '../../db/index.js';
import {
  conversationMembers,
  conversations,
  messages,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * API robustness regression tests (C1, C2, H1, H2, H4).
 *
 * - C1: GET /v1/sync must stay 200 across repeated calls; the sync-cursor
 *   predicate must not bind raw JS Date instances to the driver.
 * - C2: concurrent POST /v1/conversations/:id/messages must never 500;
 *   same idempotency key replays return the same id; distinct keys get
 *   distinct sequences (DB-side atomic allocation).
 * - H1: malformed JSON / empty JSON body / missing content type must map to
 *   the Fastify-native 400/415, not a wrapped 500.
 * - H2: NUL (\u0000) in content must be rejected with 422, never 500.
 * - H4: /v1/sync cursor/limit query params are validated (422), aligned
 *   with the moments routes.
 */

let app: FastifyInstance;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
let seed: SeededGraph;
let accessToken: string;

function setBaseEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
}

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  setBaseEnv();
  resetServerEnvForTests();
  app = await buildServer({ db: db as unknown as Database, listen: false });
  seed = await seedSocialGraph(db);
  const tokens = await issueTokens(db as unknown as Database, seed.accountId);
  accessToken = tokens.accessToken;
});

afterEach(async () => {
  resetServerEnvForTests();
  await app.close();
  await closeTestDatabase(pg);
});

function bearer(): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

async function createConversation(): Promise<string> {
  const [conv] = await db
    .insert(conversations)
    .values({
      id: newId<string>(),
      socialGraphId: seed.graphId,
      type: 'direct',
      createdByActorId: seed.humanActorId,
    })
    .returning();
  await db.insert(conversationMembers).values({
    conversationId: conv!.id,
    actorId: seed.humanActorId,
    status: 'active',
    role: 'moderator',
    joinedAt: new Date(),
  });
  return conv!.id;
}

async function postMessage(
  conversationId: string,
  payload: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: `/v1/conversations/${conversationId}/messages`,
    headers: bearer(),
    payload,
  });
}

describe('C1: GET /v1/sync stays 200 across repeated calls', () => {
  it('returns 200 five times in a row, advancing the persisted cursor', async () => {
    // Seed a world event so the sync-cursor persistence branch runs
    // (this is the path whose Date bind poisoned the connection).
    await db.insert(worldEvents).values({
      id: newId<string>(),
      socialGraphId: seed.graphId,
      type: 'message_sent',
      actorId: seed.humanActorId,
      subjectActorIds: [seed.humanActorId],
      payload: { messageId: newId<string>() },
      visibilityPolicy: {},
      idempotencyKey: `robustness:${newId<string>()}`,
    });

    const statuses: number[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/sync' + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''),
        headers: bearer(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        cursor: string;
        upserts: unknown[];
        hasMore: boolean;
      };
      expect(Array.isArray(body.upserts)).toBe(true);
      // The single seeded event is delivered on the first call; later
      // calls (advancing the cursor) legitimately return an empty delta.
      if (i === 0) {
        expect(body.upserts.length).toBeGreaterThanOrEqual(1);
      }
      expect(body.hasMore).toBe(false);
      cursor = body.cursor;
      statuses.push(res.statusCode);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
  });

  it('keeps returning 200 when the persisted cursor path is hit (no query cursor)', async () => {
    await db.insert(worldEvents).values({
      id: newId<string>(),
      socialGraphId: seed.graphId,
      type: 'message_sent',
      actorId: seed.humanActorId,
      subjectActorIds: [seed.humanActorId],
      payload: {},
      visibilityPolicy: {},
      idempotencyKey: `robustness-2:${newId<string>()}`,
    });
    // First call persists the cursor; second call reads it back and
    // rebuilds the (occurred_at, id) predicate from it.
    const first = await app.inject({
      method: 'GET',
      url: '/v1/sync',
      headers: bearer(),
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: 'GET',
      url: '/v1/sync',
      headers: bearer(),
    });
    expect(second.statusCode).toBe(200);
    const body = second.json() as { upserts: unknown[] };
    expect(body.upserts).toEqual([]);
  });
});

describe('C2: concurrent message inserts', () => {
  it('replays the same id for 10 concurrent writes with one idempotency key', async () => {
    const conversationId = await createConversation();
    const key = `idem-${newId<string>()}`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        postMessage(conversationId, {
          clientIdempotencyKey: key,
          content: 'same key race',
        }),
      ),
    );
    const statuses = results.map((r) => r.statusCode);
    expect(statuses.every((s) => s === 201)).toBe(true);
    const ids = results.map((r) => (r.json() as { id: string }).id);
    expect(new Set(ids).size).toBe(1);

    const [count] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    // Exactly one row was stored for the key.
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(ids[0]);
    void count;
  });

  it('assigns distinct sequences to 10 concurrent writes with distinct keys (no 500)', async () => {
    const conversationId = await createConversation();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        postMessage(conversationId, {
          clientIdempotencyKey: `idem-race-${newId<string>()}-${i}`,
          content: `parallel message ${i}`,
        }),
      ),
    );
    const statuses = results.map((r) => r.statusCode);
    expect(statuses.filter((s) => s === 201).length).toBe(10);

    const ids = results.map((r) => (r.json() as { id: string }).id);
    expect(new Set(ids).size).toBe(10);
    const sequences = results.map((r) => (r.json() as { sequence: number }).sequence);
    expect(new Set(sequences).size).toBe(10);
    expect(Math.min(...sequences)).toBe(1);
    expect(Math.max(...sequences)).toBe(10);

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(rows.length).toBe(10);
  });
});

describe('H1: malformed payloads map to Fastify-native 4xx', () => {
  it('malformed JSON body -> 400 (not 500)', async () => {
    const conversationId = await createConversation();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { ...bearer(), 'content-type': 'application/json' },
      payload: '{"clientIdempotencyKey": "abcdef12", "content": ',
    });
    expect([400, 415]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(500);
    expect((res.json() as { error: { code: string } }).error.code).toBeDefined();
  });

  it('empty body with CT=json -> 400/415 (not 500)', async () => {
    const conversationId = await createConversation();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { ...bearer(), 'content-type': 'application/json' },
      payload: '',
    });
    expect([400, 415]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(500);
  });

  it('missing content type -> 400/415 (not 500)', async () => {
    const conversationId = await createConversation();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/messages`,
      headers: bearer(),
      payload: Buffer.from('plain-text-body'),
    });
    expect([400, 415]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(500);
  });
});

describe('H2: NUL bytes in message content', () => {
  it('content containing \\u0000 -> 422 (not 500)', async () => {
    const conversationId = await createConversation();
    const res = await postMessage(conversationId, {
      clientIdempotencyKey: `idem-nul-${newId<string>()}`,
      content: 'hello\u0000world',
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_FAILED');

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(rows.length).toBe(0);
  });
});

describe('H4: /v1/sync query validation', () => {
  it('garbage cursor -> 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/sync?cursor=!!!not-base64url!!!',
      headers: bearer(),
    });
    expect(res.statusCode).toBe(422);
  });

  it('structurally invalid base64url cursor -> 422', async () => {
    const bogus = Buffer.from(JSON.stringify({ nope: 1 }), 'utf8').toString(
      'base64url',
    );
    const res = await app.inject({
      method: 'GET',
      url: `/v1/sync?cursor=${bogus}`,
      headers: bearer(),
    });
    expect(res.statusCode).toBe(422);
  });

  it('limit=0 and limit=501 -> 422; valid limit passes', async () => {
    const zero = await app.inject({
      method: 'GET',
      url: '/v1/sync?limit=0',
      headers: bearer(),
    });
    expect(zero.statusCode).toBe(422);
    const tooBig = await app.inject({
      method: 'GET',
      url: '/v1/sync?limit=501',
      headers: bearer(),
    });
    expect(tooBig.statusCode).toBe(422);
    const ok = await app.inject({
      method: 'GET',
      url: '/v1/sync?limit=10',
      headers: bearer(),
    });
    expect(ok.statusCode).toBe(200);
  });
});
