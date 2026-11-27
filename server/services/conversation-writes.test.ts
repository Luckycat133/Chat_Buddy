import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createDatabase, type Database } from '../../db/index.js';
import {
  conversationMembers,
  conversations,
  memoryItems,
  messageBursts,
  messages,
  proactiveIntents,
  pushDeliveryAttempts,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import { buildServer } from '../index.js';
import { seedSocialGraph, type SeededGraph } from '../test/fixtures.js';
import { closeTestDatabase, createTestDatabase, type TestDatabase } from '../test/pglite.js';
import { runProactiveTick } from '../workers/proactive.js';

const { model } = vi.hoisted(() => ({ model: vi.fn() }));
vi.mock('./model-gateway.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./model-gateway.js')>(),
  createChatCompletion: model,
}));

const { generateRepliesForConversation } = await import('./generation.js');

let app: FastifyInstance;
let db: Database;
let closeDatabase: () => Promise<void>;
const nativeUrl = process.env.CHAT_BUDDY_MESSAGE_TEST_PG_URL;

function connectNative(databaseUrl: string) {
  const connection = createDatabase({ databaseUrl });
  db = connection;
  closeDatabase = () => connection.$client.end();
}

beforeEach(async () => {
  // The same assertions can run against an isolated migrated PostgreSQL
  // service, so the shared allocator also sees competing connections.
  if (nativeUrl) {
    connectNative(nativeUrl);
  } else {
    const fixture = await createTestDatabase();
    db = fixture.db as unknown as Database;
    closeDatabase = () => closeTestDatabase(fixture.pg);
  }
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://127.0.0.1:5432/test';
  process.env.PUBLIC_WEB_URL = 'http://127.0.0.1:5173';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  resetServerEnvForTests();
  model.mockReset();
  app = await buildServer({ listen: false, db });
});

afterEach(async () => {
  await app?.close();
  await closeDatabase?.();
  resetServerEnvForTests();
});

async function seedConversation(owner: SeededGraph, peer: SeededGraph) {
  const id = newId<string>();
  await db.insert(relationships).values({
    socialGraphId: owner.graphId,
    state: 'accepted',
    actorAId: owner.characterActorId,
    actorBId: peer.humanActorId,
    initiatedBy: peer.humanActorId,
  });
  await db.insert(conversations).values({
    id, socialGraphId: owner.graphId, type: 'direct', createdByActorId: owner.characterActorId,
  });
  await db.insert(conversationMembers).values([owner.characterActorId, peer.humanActorId].map((actorId) => ({
    conversationId: id, actorId, status: 'active' as const, joinedAt: new Date(),
  })));
  const token = await issueTokens(db, peer.accountId);
  return { id, headers: { authorization: `Bearer ${token.accessToken}` } };
}

const seedGraph = () => seedSocialGraph(db as unknown as TestDatabase);
type Scene = Awaited<ReturnType<typeof seedConversation>>;

function send(scene: Scene, clientIdempotencyKey: string, content = 'Synthetic input') {
  return app.inject({
    method: 'POST', url: `/v1/conversations/${scene.id}/messages`, headers: scene.headers,
    payload: { clientIdempotencyKey, content },
  });
}

function closeBurst(scene: Scene) {
  return app.inject({
    method: 'POST', url: `/v1/conversations/${scene.id}/bursts/close`, headers: scene.headers,
    payload: { reason: 'manual' },
  });
}

async function ingest(scene: Scene, key: string) {
  expect((await send(scene, key)).statusCode).toBe(201);
  const response = await closeBurst(scene);
  expect(response.statusCode).toBe(200);
  const burstId = response.json<{ closed: string }>().closed;
  expect(burstId).toMatch(/^[0-9a-f-]{36}$/);
  return burstId;
}

function bubbles(...texts: string[]) {
  return {
    model: 'test-model',
    content: JSON.stringify({ messages: texts.map((text) => ({ target: 'current_conversation', text })) }),
  };
}

describe('shared conversation writer', () => {
  it('serializes human, AI and proactive writers and replays without duplicate rows in two graphs', async () => {
    const first = await seedGraph();
    const second = await seedGraph();
    const a = await seedConversation(first, second);
    const b = await seedConversation(second, first);
    const burstA = await ingest(a, 'initial-a');
    const burstB = await ingest(b, 'initial-b');
    const intentId = newId<string>();
    const now = new Date();
    await db.insert(proactiveIntents).values({
      id: intentId,
      sourceActorId: first.characterActorId,
      targetActorId: second.humanActorId,
      sourceEventId: newId<string>(),
      reason: 'Synthetic tick',
      desiredEffect: 'Check delivery',
      notBefore: now,
      expiresAt: new Date(now.getTime() + 60_000),
      dedupeKey: intentId,
    });
    model.mockResolvedValue(bubbles('Synthetic first bubble', 'Synthetic second bubble'));
    const reusedKey = `ai:burst:${burstA}:${first.characterActorId}:0`;
    expect((await send(a, reusedKey)).statusCode).toBe(201);

    const push = vi.fn(async () => { throw new Error('Synthetic process failure after commit'); });
    const runTick = () => runProactiveTick(db, {
      now,
      generateMessage: async () => 'Synthetic proactive delivery',
      pushPort: { channel: 'apns', send: push },
    });
    const [human] = await Promise.all([
      send(a, 'concurrent-human'),
      generateRepliesForConversation(db, a.id, burstA),
      generateRepliesForConversation(db, a.id, burstA),
      generateRepliesForConversation(db, b.id, burstB),
      runTick(),
    ]);
    expect(human.statusCode).toBe(201);
    expect((await send(a, reusedKey)).statusCode).toBe(201);

    for (const [scene, graph, count] of [[a, first, 6], [b, second, 3]] as const) {
      const rows = await db.select().from(messages).where(eq(messages.conversationId, scene.id)).orderBy(asc(messages.sequence));
      const events = await db.select().from(worldEvents).where(eq(worldEvents.conversationId, scene.id));
      expect(rows.map((row) => row.sequence)).toEqual(Array.from({ length: count }, (_, index) => index + 1));
      expect(events).toHaveLength(count + 1);
      expect(events.every((event) => event.socialGraphId === graph.graphId)).toBe(true);
      const messageEvents = events.filter((event) => event.type !== 'message_burst_closed');
      expect(messageEvents.map((event) => (event.payload as { messageId: string }).messageId).sort())
        .toEqual(rows.map((row) => row.id).sort());
      const generated = rows.filter((row) => row.content.startsWith('Synthetic') && row.clientIdempotencyKey.startsWith('ai:burst:') && row.senderActorId === graph.characterActorId);
      expect(generated.map((row) => row.content)).toEqual(['Synthetic first bubble', 'Synthetic second bubble']);
      const [generationBurst] = await db.select().from(messageBursts).where(eq(messageBursts.id, generated[0]!.burstId!));
      expect(generationBurst?.lastMessageSequence).toBe(generated[1]?.sequence);
    }

    const callsAfterCommit = model.mock.calls.length;
    if (nativeUrl) {
      await app.close();
      await closeDatabase();
      connectNative(nativeUrl);
      app = await buildServer({ listen: false, db });
    }
    await generateRepliesForConversation(db, a.id, burstA);
    await generateRepliesForConversation(db, b.id, burstB);
    expect(model).toHaveBeenCalledTimes(callsAfterCommit);
    expect(await runTick()).toMatchObject({ claimed: 0, sent: 0 });
    expect(push).toHaveBeenCalledTimes(1);
    const [intent] = await db.select().from(proactiveIntents).where(eq(proactiveIntents.id, intentId));
    expect(intent?.status).toBe('sent');
    const [attempt] = await db.select().from(pushDeliveryAttempts).where(eq(pushDeliveryAttempts.intentId, intentId));
    expect(attempt?.ok).toBe(false);

    const sync = (sc: Scene) => app.inject({ method: 'GET', url: '/v1/sync', headers: sc.headers });
    const [member, graphOwner] = await Promise.all([sync(a), sync(b)]);
    expect(member.statusCode).toBe(200);
    expect(graphOwner.statusCode).toBe(200);
    expect(member.body).toContain(a.id);
    expect(member.body).not.toContain(b.id);
    expect(graphOwner.body).toContain(b.id);
    expect(graphOwner.body).not.toContain(a.id);
  });

  it('rolls back a human message, burst close and complete AI batch when their events are rejected', async () => {
    const graph = await seedGraph();
    const scene = await seedConversation(graph, graph);
    const getMessages = () => db.select().from(messages).where(eq(messages.conversationId, scene.id));
    const getEvents = () => db.select().from(worldEvents).where(eq(worldEvents.conversationId, scene.id));
    const getBursts = () => db.select().from(messageBursts).where(eq(messageBursts.conversationId, scene.id));

    await db.execute(sql`alter table world_events add constraint r3_test_event check (type <> 'message_sent') not valid`);
    try {
      expect((await send(scene, 'recoverable-human')).statusCode).toBe(500);
      expect(await getMessages()).toEqual([]);
      expect(await getBursts()).toEqual([]);
      expect(await getEvents()).toEqual([]);
    } finally {
      await db.execute(sql`alter table world_events drop constraint r3_test_event`);
    }
    const retried = await send(scene, 'recoverable-human');
    expect(retried.statusCode).toBe(201);
    expect(retried.json()).toMatchObject({ sequence: 1 });

    await db.execute(sql`alter table world_events add constraint r3_test_event check (type <> 'message_burst_closed') not valid`);
    try {
      expect((await closeBurst(scene)).statusCode).toBe(500);
      expect((await getBursts())[0]?.closedAt).toBeNull();
      expect(await getEvents()).toHaveLength(1);
    } finally {
      await db.execute(sql`alter table world_events drop constraint r3_test_event`);
    }
    const closed = await closeBurst(scene);
    const burstId = closed.json<{ closed: string }>().closed;
    expect(closed.statusCode).toBe(200);
    expect((await closeBurst(scene)).json()).toEqual({ closed: null });

    const generated = bubbles('First recoverable bubble', 'Second recoverable bubble');
    model.mockResolvedValue({
      ...generated,
      content: JSON.stringify({
        ...JSON.parse(generated.content),
        memory_patches: [{
          type: 'public',
          objectiveFact: 'Observed synthetic fact',
          subjectiveInterpretation: '',
          confidence: 'observed',
        }],
      }),
    });
    await db.execute(sql`alter table world_events add constraint r3_test_event check (idempotency_key not like 'reply_bubble:%:1') not valid`);
    try {
      await generateRepliesForConversation(db, scene.id, burstId);
      expect(await getMessages()).toHaveLength(1);
      expect(await getBursts()).toHaveLength(1);
      expect(await getEvents()).toHaveLength(2);
      expect(await db.select().from(memoryItems).where(eq(memoryItems.ownerActorId, graph.characterActorId))).toHaveLength(0);
    } finally {
      await db.execute(sql`alter table world_events drop constraint r3_test_event`);
    }
    await generateRepliesForConversation(db, scene.id, burstId);
    await generateRepliesForConversation(db, scene.id, burstId);
    expect(model).toHaveBeenCalledTimes(2);
    expect(await getMessages()).toHaveLength(3);
    const accepted = await db.select().from(worldEvents).where(and(
      eq(worldEvents.conversationId, scene.id), eq(worldEvents.type, 'message_sent'),
    ));
    expect(accepted).toHaveLength(3);
    const humanEvent = accepted.find((event) => event.actorId === graph.humanActorId);
    expect(accepted.filter((event) => event.causedByEventId !== null).map((event) => event.causedByEventId)).toEqual([
      humanEvent?.id,
      humanEvent?.id,
    ]);
    const memories = await db.select().from(memoryItems).where(eq(memoryItems.ownerActorId, graph.characterActorId));
    expect(memories).toHaveLength(1);
    expect(memories[0]).toMatchObject({
      type: 'private',
      sourceEventId: humanEvent?.id,
      sourceActorId: graph.humanActorId,
      sharePolicy: { conversationIds: [scene.id] },
    });
  });
});
