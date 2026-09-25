import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { buildServer } from '../index.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';
import { seedSocialGraph, type SeededGraph } from '../test/fixtures.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import type { Database } from '../../db/index.js';
import {
  momentInteractions,
  moments,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import { RelationshipState } from '../../shared/contracts/enums.js';

/**
 * Server authorization tests for the Moments API (WEB_IMPLEMENTATION
 * §16, DOMAIN_ARCHITECTURE §4.16-§4.17 + §5): the server — never the
 * client — decides who sees a Moment and who may interact with it.
 * Covers cursor pagination, audience classes, block state, cross-graph
 * non-enumeration, real view events, and optimistic-client idempotency.
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

function authGet(url: string) {
  return app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${accessToken}` },
  }) as Promise<{ statusCode: number; json: () => any }>;
}

function authPost(url: string, body: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${accessToken}` },
    payload: body,
  }) as Promise<{ statusCode: number; json: () => any }>;
}

async function insertMoment(
  overrides: Partial<typeof moments.$inferInsert> = {},
): Promise<typeof moments.$inferSelect> {
  const [row] = await db
    .insert(moments)
    .values({
      actorId: seed.characterActorId,
      socialGraphId: seed.graphId,
      content: '在河边散步，风很舒服。',
      audiencePolicy: { allowedActorIds: [], class: 'public_within_graph' },
      ...overrides,
    })
    .returning();
  return row!;
}

async function insertInteraction(
  momentId: string,
  overrides: Partial<typeof momentInteractions.$inferInsert> = {},
): Promise<void> {
  await db.insert(momentInteractions).values({
    momentId,
    actorId: seed.characterActorId,
    type: 'reaction',
    ...overrides,
  });
}

async function interactionEventCount(
  momentId: string,
  type: string,
): Promise<number> {
  const rows = await db
    .select({ id: worldEvents.id })
    .from(worldEvents)
    .where(and(eq(worldEvents.momentId, momentId), eq(worldEvents.type, type)));
  return rows.length;
}

describe('moments API: authentication', () => {
  it('requires a bearer token for the feed', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/moments' });
    expect(res.statusCode).toBe(401);
  });

  it('requires a bearer token for interactions', async () => {
    const moment = await insertMoment();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/moments/${moment.id}/interactions`,
      payload: { type: 'view' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('moments API: cursor pagination', () => {
  it('pages deterministically without duplicates or gaps', async () => {
    const base = Date.parse('2026-09-20T10:00:00.000Z');
    const inserted: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const row = await insertMoment({
        content: `moment-${i}`,
        createdAt: new Date(base + i * 60_000),
      });
      inserted.push(row.id);
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5; page += 1) {
      const url = cursor
        ? `/v1/moments?limit=2&cursor=${encodeURIComponent(cursor)}`
        : '/v1/moments?limit=2';
      const res = await authGet(url);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items.length).toBeLessThanOrEqual(2);
      for (const item of body.items) seen.push(item.moment.id);
      cursor = body.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    // Newest first.
    expect(seen).toEqual([...inserted].reverse());
  });

  it('rejects a malformed cursor with 422 instead of silently restarting', async () => {
    const res = await authGet('/v1/moments?cursor=not-a-cursor');
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('returns the documented feed envelope shape', async () => {
    const moment = await insertMoment();
    await insertInteraction(moment.id, { type: 'reaction' });
    await insertInteraction(moment.id, {
      type: 'comment',
      content: '我也想去',
      actorId: seed.humanActorId,
    });
    const res = await authGet('/v1/moments');
    const body = res.json();
    expect(body.items).toHaveLength(1);
    const item = body.items[0];
    expect(item.moment.id).toBe(moment.id);
    expect(typeof item.moment.createdAt).toBe('string');
    expect(item.reactionCount).toBe(1);
    expect(item.commentCount).toBe(1);
    // Only the caller's own interactions are echoed back (reconciliation
    // source for optimistic state).
    expect(item.viewerInteractions).toHaveLength(1);
    expect(item.viewerInteractions[0].actorId).toBe(seed.humanActorId);
  });
});

describe('moments API: server-side audience enforcement', () => {
  it('hides cross-graph moments from the feed and rejects interaction with 404', async () => {
    const other = await seedSocialGraph(db);
    const foreign = await insertMoment({
      socialGraphId: other.graphId,
      actorId: other.characterActorId,
    });
    const feed = await authGet('/v1/moments');
    expect(feed.json().items).toHaveLength(0);

    const res = await authPost(`/v1/moments/${foreign.id}/interactions`, {
      type: 'view',
    });
    // 404, not 403: no enumeration oracle for foreign-graph moments.
    expect(res.statusCode).toBe(404);
  });

  it('shows restricted moments only to explicitly allowed actors', async () => {
    const allowed = await insertMoment({
      audiencePolicy: {
        allowedActorIds: [seed.humanActorId],
        class: 'restricted',
      },
    });
    const denied = await insertMoment({
      audiencePolicy: {
        allowedActorIds: [seed.characterActorId],
        class: 'restricted',
      },
    });
    const feed = await authGet('/v1/moments');
    const ids = feed.json().items.map((i: { moment: { id: string } }) => i.moment.id);
    expect(ids).toContain(allowed.id);
    expect(ids).not.toContain(denied.id);
  });

  it('treats familiar moments as visible to accepted relationships only', async () => {
    const familiar = await insertMoment({
      audiencePolicy: { allowedActorIds: [], class: 'familiar' },
    });
    const before = await authGet('/v1/moments');
    expect(before.json().items).toHaveLength(0);

    await db.insert(relationships).values({
      socialGraphId: seed.graphId,
      actorAId: seed.humanActorId,
      actorBId: seed.characterActorId,
      state: RelationshipState.Accepted,
      initiatedBy: seed.humanActorId,
    });
    const after = await authGet('/v1/moments');
    expect(after.json().items.map((i: { moment: { id: string } }) => i.moment.id))
      .toContain(familiar.id);
  });

  it('hides moments authored by a blocked actor even when public', async () => {
    const moment = await insertMoment();
    await db.insert(relationships).values({
      socialGraphId: seed.graphId,
      actorAId: seed.humanActorId,
      actorBId: seed.characterActorId,
      state: RelationshipState.Blocked,
      initiatedBy: seed.humanActorId,
    });
    const feed = await authGet('/v1/moments');
    expect(feed.json().items).toHaveLength(0);

    const res = await authPost(`/v1/moments/${moment.id}/interactions`, {
      type: 'view',
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('ACTOR_BLOCKED');
  });

  it('hides deleted moments and rejects their interactions with 404', async () => {
    const moment = await insertMoment({
      deletedAt: new Date(),
    });
    const feed = await authGet('/v1/moments');
    expect(feed.json().items).toHaveLength(0);
    const res = await authPost(`/v1/moments/${moment.id}/interactions`, {
      type: 'view',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('moments API: real view events + optimistic idempotency', () => {
  it('records a real view interaction and a moment_viewed world event', async () => {
    const moment = await insertMoment();
    const res = await authPost(`/v1/moments/${moment.id}/interactions`, {
      type: 'view',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.interaction.type).toBe('view');
    expect(body.duplicate).toBe(false);
    expect(await interactionEventCount(moment.id, 'moment_viewed')).toBe(1);
  });

  it('replays the original interaction for a retried client idempotency key', async () => {
    const moment = await insertMoment();
    const payload = {
      type: 'reaction',
      clientIdempotencyKey: 'optimistic-key-1',
    };
    const first = await authPost(`/v1/moments/${moment.id}/interactions`, payload);
    const second = await authPost(`/v1/moments/${moment.id}/interactions`, payload);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().duplicate).toBe(false);
    expect(second.json().duplicate).toBe(true);
    expect(second.json().interaction.id).toBe(first.json().interaction.id);
    // Exactly one interaction row and one world event.
    const rows = await db
      .select({ id: momentInteractions.id })
      .from(momentInteractions)
      .where(eq(momentInteractions.momentId, moment.id));
    expect(rows).toHaveLength(1);
    expect(await interactionEventCount(moment.id, 'moment_reacted')).toBe(1);
  });

  it('does not dedupe interactions sent without a client key', async () => {
    const moment = await insertMoment();
    const payload = { type: 'comment', content: '好地方' };
    await authPost(`/v1/moments/${moment.id}/interactions`, payload);
    await authPost(`/v1/moments/${moment.id}/interactions`, payload);
    const rows = await db
      .select({ id: momentInteractions.id })
      .from(momentInteractions)
      .where(eq(momentInteractions.momentId, moment.id));
    expect(rows).toHaveLength(2);
  });

  it('rejects interaction payloads that violate the shared contract', async () => {
    const moment = await insertMoment();
    const res = await authPost(`/v1/moments/${moment.id}/interactions`, {
      type: 'hug',
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('moments API: human post creation', () => {
  it('creates a moment and its canonical moment_posted event', async () => {
    const res = await authPost('/v1/moments', {
      content: '今天把阳台的花都浇了。',
      audiencePolicy: { allowedActorIds: [], class: 'public_within_graph' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.moment.content).toContain('阳台');
    expect(body.moment.sourceEventId).toBeNull();

    const events = await db
      .select({ type: worldEvents.type })
      .from(worldEvents)
      .where(eq(worldEvents.momentId, body.moment.id));
    expect(events.map((e) => e.type)).toEqual(['moment_posted']);
  });

  it('only accepts a sourceEventId that references a caller-owned event', async () => {
    const res = await authPost('/v1/moments', {
      content: 'spoofed source',
      audiencePolicy: { allowedActorIds: [], class: 'public_within_graph' },
      sourceEventId: newId<string>(),
    });
    expect(res.statusCode).toBe(422);

    const owned = newId<string>();
    await db.insert(worldEvents).values({
      id: owned,
      socialGraphId: seed.graphId,
      type: 'native_world_event',
      actorId: seed.humanActorId,
      subjectActorIds: [],
      payload: {},
      visibilityPolicy: {},
      idempotencyKey: `test:${owned}`,
    });
    const ok = await authPost('/v1/moments', {
      content: 'linked to my own event',
      audiencePolicy: { allowedActorIds: [], class: 'public_within_graph' },
      sourceEventId: owned,
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().moment.sourceEventId).toBe(owned);
  });
});
