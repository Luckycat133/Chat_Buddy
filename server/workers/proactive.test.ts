import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '../test/pglite.js';
import { seedSocialGraph } from '../test/fixtures.js';
import {
  runProactiveTick,
  type ProactiveMessageGenerator,
} from './proactive.js';
import { FailingPushPort, type PushPort, type PushSendInput } from '../services/push.js';
import {
  conversationMembers,
  conversations,
  messages,
  proactiveIntents,
  pushDeliveryAttempts,
  relationshipPreferences,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import type { Database } from '../../db/index.js';
import { newId } from '../../shared/contracts/ids.js';
import { issueTokens } from '../auth/session.js';
import { buildServer } from '../index.js';
import { resetServerEnvForTests } from '../config.js';

/**
 * Proactive intents keyed by ProactiveIntent.id (WEB_IMPLEMENTATION §15,
 * DOMAIN_ARCHITECTURE §10 / §4.21): dedupe key, not-before, quiet hours,
 * expiration, execution-time re-validation, message-before-push, and a
 * delivery-attempt record per push call (APNs stays at contract level).
 */
let db: TestDatabase;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
let sdb: Database;

const FAKE_TEXT = '周末有空吗？想约你去那家山系咖啡店。';

const fakeGenerator: ProactiveMessageGenerator = async () => FAKE_TEXT;

class RecordingPushPort implements PushPort {
  readonly channel = 'apns' as const;
  readonly sends: PushSendInput[] = [];
  constructor(
    private readonly ok = true,
    private readonly detail = 'noop: P0 push contract stub',
  ) {}
  async send(input: PushSendInput) {
    this.sends.push(input);
    return { ok: this.ok, detail: this.detail };
  }
}

interface Scene {
  graphId: string;
  accountId: string;
  humanActorId: string;
  characterActorId: string;
  conversationId: string;
  relationshipId: string;
}

async function seedProactiveScene(): Promise<Scene> {
  const seed = await seedSocialGraph(db);
  const relId = newId<string>();
  await db.insert(relationships).values({
    id: relId,
    socialGraphId: seed.graphId,
    actorAId: seed.humanActorId,
    actorBId: seed.characterActorId,
    state: 'accepted',
    initiatedBy: seed.humanActorId,
  });
  const conversationId = newId<string>();
  await db.insert(conversations).values({
    id: conversationId,
    socialGraphId: seed.graphId,
    type: 'direct',
    createdByActorId: seed.humanActorId,
  });
  await db.insert(conversationMembers).values([
    {
      conversationId,
      actorId: seed.humanActorId,
      status: 'active',
      joinedAt: new Date(),
    },
    {
      conversationId,
      actorId: seed.characterActorId,
      status: 'active',
      joinedAt: new Date(),
    },
  ]);
  return { ...seed, conversationId, relationshipId: relId };
}

async function seedIntent(
  scene: Scene,
  overrides: Partial<typeof proactiveIntents.$inferInsert> = {},
): Promise<string> {
  const id = newId<string>();
  await db.insert(proactiveIntents).values({
    id,
    sourceActorId: scene.characterActorId,
    targetActorId: scene.humanActorId,
    sourceEventId: newId<string>(),
    reason: '聊聊周末的展览',
    desiredEffect: '约一次线下见面',
    notBefore: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 3600_000),
    dedupeKey: `dedupe-${id}`,
    status: 'pending',
    ...overrides,
  });
  return id;
}

async function intentStatus(id: string): Promise<string> {
  const [row] = await db
    .select({ status: proactiveIntents.status })
    .from(proactiveIntents)
    .where(eq(proactiveIntents.id, id))
    .limit(1);
  return row?.status ?? 'missing';
}

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  sdb = created.db as unknown as Database;
  resetServerEnvForTests();
});

afterEach(async () => {
  resetServerEnvForTests();
  await closeTestDatabase(pg);
});

describe('runProactiveTick (worker)', () => {
  it('sends a due intent: message persisted before push, delivery attempt recorded', async () => {
    const scene = await seedProactiveScene();
    const intentId = await seedIntent(scene);
    const push = new RecordingPushPort();

    const result = await runProactiveTick(sdb, {
      pushPort: push,
      generateMessage: fakeGenerator,
    });

    expect(result).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    expect(await intentStatus(intentId)).toBe('sent');

    const [msg] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, scene.conversationId),
          eq(messages.clientIdempotencyKey, `proactive:${intentId}`),
        ),
      );
    expect(msg).toBeTruthy();
    expect(msg!.content).toBe(FAKE_TEXT);
    expect(msg!.senderActorId).toBe(scene.characterActorId);

    const [event] = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'proactive_message_sent'));
    expect(event).toBeTruthy();
    expect(event!.payload).toMatchObject({ intentId, messageId: msg!.id });

    expect(push.sends).toHaveLength(1);
    expect(push.sends[0]).toMatchObject({
      actorId: scene.humanActorId,
      intentId,
      conversationId: scene.conversationId,
    });
    const [attempt] = await db.select().from(pushDeliveryAttempts);
    expect(attempt).toMatchObject({
      intentId,
      actorId: scene.humanActorId,
      channel: 'apns',
      ok: true,
    });
  });

  it('sequences consecutive proactive messages without collisions', async () => {
    const scene = await seedProactiveScene();
    // Pre-existing message occupies sequence 1.
    await db.insert(messages).values({
      id: newId<string>(),
      conversationId: scene.conversationId,
      senderActorId: scene.humanActorId,
      sequence: 1,
      clientIdempotencyKey: 'seed-human-1',
      kind: 'text',
      content: '之前的一条消息',
      status: 'accepted',
    });
    await seedIntent(scene);
    await seedIntent(scene, { dedupeKey: 'second-intent' });

    const result = await runProactiveTick(sdb, {
      generateMessage: fakeGenerator,
    });
    expect(result.sent).toBe(2);

    const rows = await db
      .select({ sequence: messages.sequence })
      .from(messages)
      .where(eq(messages.conversationId, scene.conversationId))
      .orderBy(messages.sequence);
    expect(rows.map((r) => r.sequence)).toEqual([1, 2, 3]);
  });

  it('never sends twice for the same intent (idempotent replay)', async () => {
    const scene = await seedProactiveScene();
    const intentId = await seedIntent(scene);
    await runProactiveTick(sdb, { generateMessage: fakeGenerator });
    await runProactiveTick(sdb, { generateMessage: fakeGenerator });

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.clientIdempotencyKey, `proactive:${intentId}`));
    expect(rows).toHaveLength(1);
  });

  it('respects not-before: a future intent is not claimed', async () => {
    const scene = await seedProactiveScene();
    const intentId = await seedIntent(scene, {
      notBefore: new Date(Date.now() + 3600_000),
    });

    const result = await runProactiveTick(sdb, {
      generateMessage: fakeGenerator,
    });
    expect(result.claimed).toBe(0);
    expect(await intentStatus(intentId)).toBe('pending');
    const rows = await db.select().from(messages);
    expect(rows).toHaveLength(0);
  });

  it('expires intents whose deadline passed', async () => {
    const scene = await seedProactiveScene();
    const intentId = await seedIntent(scene, {
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await runProactiveTick(sdb, {
      generateMessage: fakeGenerator,
    });
    expect(result.expired).toBe(1);
    expect(await intentStatus(intentId)).toBe('expired');
    expect(result.claimed).toBe(0);
  });

  it('defers instead of sending inside quiet hours, then sends after', async () => {
    const scene = await seedProactiveScene();
    // Fixed now: 2026-09-25T01:00:00Z (inside 00:00-07:00 quiet window).
    const now = new Date('2026-09-25T01:00:00Z');
    const intentId = await seedIntent(scene, {
      notBefore: new Date('2026-09-25T00:30:00Z'),
      expiresAt: new Date('2026-09-26T00:00:00Z'),
      quietHoursPolicy: { startMinute: 0, endMinute: 420 },
    });

    const first = await runProactiveTick(sdb, {
      now,
      generateMessage: fakeGenerator,
    });
    expect(first.sent).toBe(0);
    expect(first.skipped).toBe(1);
    expect(await intentStatus(intentId)).toBe('pending');

    const [row] = await db
      .select()
      .from(proactiveIntents)
      .where(eq(proactiveIntents.id, intentId));
    expect(row!.notBefore).toEqual(new Date('2026-09-25T07:00:00Z'));

    const second = await runProactiveTick(sdb, {
      now: new Date('2026-09-25T07:30:00Z'),
      generateMessage: fakeGenerator,
    });
    expect(second.sent).toBe(1);
    expect(await intentStatus(intentId)).toBe('sent');
  });

  it('defers quiet hours on the user-local timezone basis, not UTC', async () => {
    const scene = await seedProactiveScene();
    // 00:00-07:00 Asia/Shanghai = 16:00-23:00 UTC. now=17:00Z is 01:00 +08
    // (inside the user-local window) but OUTSIDE the same window on the
    // UTC basis — execution must defer until 07:00 +08 = 23:00Z.
    const intentId = await seedIntent(scene, {
      notBefore: new Date('2026-09-25T16:30:00Z'),
      expiresAt: new Date('2026-09-26T16:00:00Z'),
      quietHoursPolicy: { startMinute: 0, endMinute: 420, timeZone: 'Asia/Shanghai' },
    });

    const first = await runProactiveTick(sdb, {
      now: new Date('2026-09-25T17:00:00Z'),
      generateMessage: fakeGenerator,
    });
    expect(first.sent).toBe(0);
    expect(await intentStatus(intentId)).toBe('pending');

    const [row] = await db
      .select()
      .from(proactiveIntents)
      .where(eq(proactiveIntents.id, intentId));
    expect(row!.notBefore).toEqual(new Date('2026-09-25T23:00:00Z'));

    const second = await runProactiveTick(sdb, {
      now: new Date('2026-09-25T23:30:00Z'),
      generateMessage: fakeGenerator,
    });
    expect(second.sent).toBe(1);
    expect(await intentStatus(intentId)).toBe('sent');
  });

  it('cancels when the target disallows proactive messages', async () => {
    const scene = await seedProactiveScene();
    await db.insert(relationshipPreferences).values({
      relationshipId: scene.relationshipId,
      ownerActorId: scene.humanActorId,
      allowProactiveMessage: false,
    });
    const intentId = await seedIntent(scene);

    const result = await runProactiveTick(sdb, {
      generateMessage: fakeGenerator,
    });
    expect(result.sent).toBe(0);
    expect(await intentStatus(intentId)).toBe('cancelled');
    expect(await db.select().from(messages)).toHaveLength(0);
  });

  it('cancels without an accepted relationship (friend/DM state)', async () => {
    const scene = await seedProactiveScene();
    await db
      .delete(relationships)
      .where(eq(relationships.id, scene.relationshipId));
    const intentId = await seedIntent(scene);

    const result = await runProactiveTick(sdb, {
      generateMessage: fakeGenerator,
    });
    expect(await intentStatus(intentId)).toBe('cancelled');
    expect(result.sent).toBe(0);
  });

  it('cancels when no direct conversation exists for delivery', async () => {
    const scene = await seedProactiveScene();
    await db
      .delete(conversationMembers)
      .where(eq(conversationMembers.conversationId, scene.conversationId));
    const intentId = await seedIntent(scene);

    const result = await runProactiveTick(sdb, {
      generateMessage: fakeGenerator,
    });
    expect(await intentStatus(intentId)).toBe('cancelled');
    expect(result.sent).toBe(0);
  });

  it('marks the intent failed when generation fails; nothing is sent', async () => {
    const scene = await seedProactiveScene();
    const intentId = await seedIntent(scene);
    const push = new RecordingPushPort();

    const result = await runProactiveTick(sdb, {
      pushPort: push,
      generateMessage: async () => {
        throw new Error('gateway down');
      },
    });

    expect(result.failed).toBe(1);
    expect(await intentStatus(intentId)).toBe('failed');
    expect(await db.select().from(messages)).toHaveLength(0);
    expect(push.sends).toHaveLength(0);
    expect(await db.select().from(pushDeliveryAttempts)).toHaveLength(0);
  });

  it('push failure records a failed attempt and keeps the message', async () => {
    const scene = await seedProactiveScene();
    const intentId = await seedIntent(scene);

    const result = await runProactiveTick(sdb, {
      pushPort: new FailingPushPort('apns unreachable'),
      generateMessage: fakeGenerator,
    });

    expect(result.sent).toBe(1);
    expect(await intentStatus(intentId)).toBe('sent');
    expect(
      await db
        .select()
        .from(messages)
        .where(eq(messages.clientIdempotencyKey, `proactive:${intentId}`)),
    ).toHaveLength(1);
    const [attempt] = await db.select().from(pushDeliveryAttempts);
    expect(attempt).toMatchObject({ ok: false, detail: 'apns unreachable' });
  });
});

/** Route-level coverage: creation dedupe, quiet-hours shift, inspector. */
describe('proactive intent API', () => {
  let app: FastifyInstance;
  let scene: Scene;
  let token: string;

  beforeEach(async () => {
    setApiEnv();
    resetServerEnvForTests();
    app = await buildServer({ db: sdb, listen: false });
    scene = await seedProactiveScene();
    const tokens = await issueTokens(sdb, scene.accountId);
    token = tokens.accessToken;
  });

  function setApiEnv(): void {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
    process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
  }

  afterEach(async () => {
    resetServerEnvForTests();
    await app.close();
  });

  const auth = { authorization: '' };
  function withAuth(t: string) {
    auth.authorization = `Bearer ${t}`;
    return auth;
  }

  function createPayload(
    scene_: Scene,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      targetActorId: scene_.characterActorId,
      sourceEventId: newId<string>(),
      reason: '试试安静时段',
      desiredEffect: '唤起回复',
      notBefore: '2026-09-25T01:00:00.000Z',
      expiresAt: '2026-09-26T01:00:00.000Z',
      dedupeKey: 'dedupe-key-001',
      quietHoursPolicy: { startMinute: 0, endMinute: 420 },
      privateContext: { note: 'private-context-should-not-leak' },
      ...overrides,
    };
  }

  it('creates an intent, shifts not-before out of quiet hours, emits the event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/proactive-intents',
      headers: withAuth(token),
      payload: createPayload(scene),
    });
    expect(res.statusCode).toBe(201);
    const { id, deduped } = res.json() as { id: string; deduped: boolean };
    expect(deduped).toBe(false);

    const [row] = await db
      .select()
      .from(proactiveIntents)
      .where(eq(proactiveIntents.id, id));
    // 01:00 UTC is inside 00:00-07:00 quiet → shifted to 07:00.
    expect(row!.notBefore).toEqual(new Date('2026-09-25T07:00:00.000Z'));

    const [event] = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'proactive_intent_created'));
    expect(event).toBeTruthy();
    expect(event!.payload).toMatchObject({ intentId: id, dedupeKey: 'dedupe-key-001' });
  });

  it('shifts not-before using the policy timezone when provided', async () => {
    // 16:30Z is outside 00:00-07:00 on the UTC basis but equals 00:30 +08
    // (inside the user-local window) → shifted to 07:00 +08 = 23:00Z.
    const res = await app.inject({
      method: 'POST',
      url: '/v1/proactive-intents',
      headers: withAuth(token),
      payload: createPayload(scene, {
        notBefore: '2026-09-25T16:30:00.000Z',
        expiresAt: '2026-09-26T16:00:00.000Z',
        quietHoursPolicy: { startMinute: 0, endMinute: 420, timeZone: 'Asia/Shanghai' },
      }),
    });
    expect(res.statusCode).toBe(201);
    const { id } = res.json() as { id: string };
    const [row] = await db
      .select()
      .from(proactiveIntents)
      .where(eq(proactiveIntents.id, id));
    expect(row!.notBefore).toEqual(new Date('2026-09-25T23:00:00.000Z'));
    expect(row!.quietHoursPolicy).toMatchObject({ timeZone: 'Asia/Shanghai' });
  });

  it('returns the existing intent for a repeated dedupe key', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/v1/proactive-intents',
      headers: withAuth(token),
      payload: createPayload(scene),
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/proactive-intents',
      headers: withAuth(token),
      payload: createPayload(scene),
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({
      id: first.json().id,
      deduped: true,
    });
  });

  it('rejects an expiration before not-before', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/proactive-intents',
      headers: withAuth(token),
      payload: createPayload(scene, {
        notBefore: '2026-09-26T01:00:00.000Z',
        expiresAt: '2026-09-25T01:00:00.000Z',
      }),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('inspector exposes reason/due/status to participants, never privateContext', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/v1/proactive-intents',
      headers: withAuth(token),
      payload: createPayload(scene),
    });
    const id = (create.json() as { id: string }).id;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/proactive-intents/${id}`,
      headers: withAuth(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ id, status: 'pending' });
    expect(body.reason).toBe('试试安静时段');
    expect(body.notBefore).toBe('2026-09-25T07:00:00.000Z');
    expect(JSON.stringify(body)).not.toContain('private-context-should-not-leak');
    expect(body.privateContext).toBeUndefined();

    // A non-participant actor cannot inspect.
    const otherScene = await seedProactiveScene();
    const otherTokens = await issueTokens(sdb, otherScene.accountId);
    const denied = await app.inject({
      method: 'GET',
      url: `/v1/proactive-intents/${id}`,
      headers: withAuth(otherTokens.accessToken),
    });
    expect(denied.statusCode).toBe(403);
  });
});
