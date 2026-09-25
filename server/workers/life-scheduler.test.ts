import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '../test/pglite.js';
import { seedSocialGraph } from '../test/fixtures.js';
import {
  runLifeTick,
  validateCandidate,
  generateLifeEventViaModel,
  type LifeCandidateGenerator,
} from './life-scheduler.js';
import type { Database } from '../../db/index.js';
import {
  actors,
  characterActors,
  conversations,
  messages,
  moments,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import { MessageKind } from '../../shared/contracts/enums.js';
import { resetServerEnvForTests } from '../config.js';

/**
 * Contract tests for the character life scheduler (DOMAIN_ARCHITECTURE
 * §9, WEB_IMPLEMENTATION §14): due-actor selection, adaptive frequency,
 * per-graph spend cap, validation before publication, and the "no
 * forced event when nothing is meaningful" guarantee.
 */

let db: TestDatabase;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
let sdb: Database;

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  sdb = created.db as unknown as Database;
  resetServerEnvForTests();
});

afterEach(async () => {
  resetServerEnvForTests();
  vi.restoreAllMocks();
  await closeTestDatabase(pg);
});

async function seedCharacter(
  templateId: string,
  graphId: string,
): Promise<string> {
  const actorId = newId<string>();
  await db.insert(actors).values({
    id: actorId,
    socialGraphId: graphId,
    type: 'character',
    publicName: '小澈',
    templateId,
  });
  await db.insert(characterActors).values({
    actorId,
    templateId,
    templateRevision: 1,
    socialGraphId: graphId,
  });
  return actorId;
}

async function momentRowsFor(actorId: string) {
  return db.select().from(moments).where(eq(moments.actorId, actorId));
}

const NOOP_GENERATOR: LifeCandidateGenerator = async () => null;

describe('life scheduler: due-actor selection and publication', () => {
  it('publishes a Moment + native-world event pair for a due actor', async () => {
    const seed = await seedSocialGraph(db);
    const actorId = await seedCharacter(seed.templateId, seed.graphId);
    const now = new Date('2026-09-25T08:00:00.000Z');

    const result = await runLifeTick(sdb, now, async () => '清晨沿着河边慢跑，空气里有桂花的味道。');

    expect(result).toEqual({
      considered: 1,
      generated: 1,
      spendCapped: 0,
      rejected: 0,
    });
    const rows = await momentRowsFor(actorId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.audiencePolicy).toEqual({
      allowedActorIds: [],
      class: 'public_within_graph',
    });

    const events = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.momentId, rows[0]!.id));
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('native_world_event');
    expect(events[0]!.idempotencyKey).toBe(`native_world_event:${rows[0]!.id}`);

    const [actor] = await db
      .select()
      .from(characterActors)
      .where(eq(characterActors.actorId, actorId));
    expect(actor!.lastSimulatedAt).toEqual(now);
    expect(actor!.nextSimulationAfter).toEqual(
      new Date(now.getTime() + 60 * 60_000),
    );
  });

  it('does not consider actors whose next simulation time is in the future', async () => {
    const seed = await seedSocialGraph(db);
    const actorId = await seedCharacter(seed.templateId, seed.graphId);
    await db
      .update(characterActors)
      .set({ nextSimulationAfter: new Date('2026-09-25T09:00:00.000Z') })
      .where(eq(characterActors.actorId, actorId));

    const generate = vi.fn(NOOP_GENERATOR);
    const result = await runLifeTick(sdb, new Date('2026-09-25T08:00:00.000Z'), generate);

    expect(result.considered).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it('processes at most MAX_PER_TICK actors per tick', async () => {
    const seed = await seedSocialGraph(db);
    for (let i = 0; i < 9; i += 1) {
      await seedCharacter(seed.templateId, seed.graphId);
    }
    const generate = vi.fn(NOOP_GENERATOR);
    const result = await runLifeTick(sdb, new Date(), generate);
    expect(result.considered).toBe(8);
    expect(generate).toHaveBeenCalledTimes(8);
  });
});

describe('life scheduler: adaptive frequency + no forced events', () => {
  it('reschedules a quiet actor far out when nothing meaningful exists', async () => {
    const seed = await seedSocialGraph(db);
    const actorId = await seedCharacter(seed.templateId, seed.graphId);
    const now = new Date('2026-09-25T08:00:00.000Z');

    const result = await runLifeTick(sdb, now, async () => null);

    expect(result.generated).toBe(0);
    expect(await momentRowsFor(actorId)).toHaveLength(0);
    const [actor] = await db
      .select()
      .from(characterActors)
      .where(eq(characterActors.actorId, actorId));
    expect(actor!.nextSimulationAfter).toEqual(
      new Date(now.getTime() + 3 * 60 * 60_000),
    );
  });

  it('gives recently active actors more opportunities (shorter reschedule)', async () => {
    const seed = await seedSocialGraph(db);
    const actorId = await seedCharacter(seed.templateId, seed.graphId);
    const now = new Date('2026-09-25T08:00:00.000Z');

    // Recent chat activity: a message sent one hour ago.
    const conversationId = newId<string>();
    await db.insert(conversations).values({
      id: conversationId,
      socialGraphId: seed.graphId,
      type: 'direct',
      createdByActorId: actorId,
    });
    await db.insert(messages).values({
      conversationId,
      senderActorId: actorId,
      sequence: 1,
      clientIdempotencyKey: `life-test:${actorId}`,
      kind: MessageKind.Text,
      content: '早上好呀',
      createdAt: new Date(now.getTime() - 60 * 60_000),
    });

    const result = await runLifeTick(sdb, now, async () => null);

    expect(result.generated).toBe(0);
    const [actor] = await db
      .select()
      .from(characterActors)
      .where(eq(characterActors.actorId, actorId));
    // Active: retry in an hour, not in three.
    expect(actor!.nextSimulationAfter).toEqual(
      new Date(now.getTime() + 60 * 60_000),
    );
  });

  it('never publishes a placeholder when the generator throws', async () => {
    const seed = await seedSocialGraph(db);
    const actorId = await seedCharacter(seed.templateId, seed.graphId);
    const now = new Date();

    const result = await runLifeTick(sdb, now, async () => {
      throw new Error('gateway down');
    });

    expect(result.generated).toBe(0);
    expect(await momentRowsFor(actorId)).toHaveLength(0);
  });
});

describe('life scheduler: validation and spend cap', () => {
  it('rejects invalid candidate content instead of publishing it', async () => {
    const seed = await seedSocialGraph(db);
    const actorId = await seedCharacter(seed.templateId, seed.graphId);

    const result = await runLifeTick(sdb, new Date(), async () => '  [object Object] TODO ');

    expect(result.rejected).toBe(1);
    expect(result.generated).toBe(0);
    expect(await momentRowsFor(actorId)).toHaveLength(0);
  });

  it('enforces the per-graph generation spend cap without calling the model', async () => {
    const seed = await seedSocialGraph(db);
    const actorId = await seedCharacter(seed.templateId, seed.graphId);
    const now = new Date();

    // 12 graph events already published in the rolling 24h window.
    for (let i = 0; i < 12; i += 1) {
      await db.insert(worldEvents).values({
        socialGraphId: seed.graphId,
        type: 'native_world_event',
        actorId,
        subjectActorIds: [actorId],
        payload: {},
        visibilityPolicy: {},
        idempotencyKey: `cap-test:${i}:${actorId}`,
        occurredAt: new Date(now.getTime() - i * 60_000),
      });
    }

    const generate = vi.fn(async () => '应该不会被调用');
    const result = await runLifeTick(sdb, now, generate);

    expect(generate).not.toHaveBeenCalled();
    expect(result.spendCapped).toBe(1);
    expect(result.generated).toBe(0);
    expect(await momentRowsFor(actorId)).toHaveLength(0);
  });
});

describe('life scheduler: default model generator', () => {
  it('yields no event when the model gateway is unconfigured', async () => {
    delete process.env.MODEL_GATEWAY_URL;
    delete process.env.MODEL_GATEWAY_KEY;
    resetServerEnvForTests();

    const candidate = await generateLifeEventViaModel({
      actorId: newId<string>(),
      socialGraphId: newId<string>(),
      publicName: '小澈',
      nativeWorldState: {},
      recentEvents: [],
      recentActivityCount: 0,
    });
    expect(candidate).toBeNull();
  });

  it('treats a NONE answer as no meaningful event', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
    process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
    process.env.MODEL_GATEWAY_URL = 'https://gateway.test/api/v1';
    process.env.MODEL_GATEWAY_KEY = 'k'.repeat(24);
    resetServerEnvForTests();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'NONE' } }],
          model: 'test-model',
        }),
        { status: 200 },
      )) as typeof fetch;
    try {
      const candidate = await generateLifeEventViaModel({
        actorId: newId<string>(),
        socialGraphId: newId<string>(),
        publicName: '小澈',
        nativeWorldState: {},
        recentEvents: [],
        recentActivityCount: 0,
      });
      expect(candidate).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.MODEL_GATEWAY_URL;
      delete process.env.MODEL_GATEWAY_KEY;
    }
  });
});

describe('life scheduler: candidate validation', () => {
  it('accepts ordinary content and rejects placeholders/oversize/blank', () => {
    expect(validateCandidate('周末去爬山。')).toBe('周末去爬山。');
    expect(validateCandidate('  带空白的句子  ')).toBe('带空白的句子');
    expect(validateCandidate(null)).toBeNull();
    expect(validateCandidate('   ')).toBeNull();
    expect(validateCandidate('undefined')).toBeNull();
    expect(validateCandidate('a'.repeat(8001))).toBeNull();
  });
});
