import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '../test/pglite.js';
import {
  seedFriendRequest,
  seedSocialGraph,
} from '../test/fixtures.js';
import {
  runCharacterInvitationTick,
  decideViaModel,
  type AppliedDecision,
} from './character-invitations.js';
import { requestStatus } from '../test/fixtures.js';
import type { Database } from '../../db/index.js';
import {
  groupInvitations,
  relationships,
  worldEvents,
  conversations,
  conversationMembers,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import { resetServerEnvForTests } from '../config.js';

/**
 * Contract tests for the direct-session character invitation worker
 * (PRODUCT_CONTRACT §7): a character decision follows identity and social
 * history — never random, never automatic acceptance — and group
 * invitations are explicitly out of scope because every group invitee must
 * confirm individually.
 */

const ORIGINAL_FETCH = globalThis.fetch;
let db: TestDatabase;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
/** Worker functions accept the production postgres-js Database type. */
let sdb: Database;

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  sdb = created.db as unknown as Database;
  resetServerEnvForTests();
});

afterEach(async () => {
  globalThis.fetch = ORIGINAL_FETCH;
  delete process.env.MODEL_GATEWAY_URL;
  delete process.env.MODEL_GATEWAY_KEY;
  delete process.env.MODEL_GATEWAY_MODEL;
  resetServerEnvForTests();
  vi.restoreAllMocks();
  await closeTestDatabase(pg);
});

const acceptDecision = async (): Promise<AppliedDecision> => ({
  decision: 'accepted',
  reasonCode: 'shared_history',
  source: 'model',
});

describe('character invitation worker (direct friend requests)', () => {
  it('applies an accepted model decision: status, relationship, world event', async () => {
    const seed = await seedSocialGraph(db);
    const requestId = await seedFriendRequest(
      db,
      seed.humanActorId,
      seed.characterActorId,
      { note: '我们同在摄影小组' },
    );

    const result = await runCharacterInvitationTick(sdb, new Date(), acceptDecision);

    expect(result).toEqual({ considered: 1, decided: 1, deferred: 0, skipped: 0 });
    expect(await requestStatus(db, requestId)).toBe('accepted');

    const pair = [seed.humanActorId, seed.characterActorId].sort();
    const rels = await db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.actorAId, pair[0]!),
          eq(relationships.actorBId, pair[1]!),
        ),
      );
    expect(rels).toHaveLength(1);
    expect(rels[0]!.state).toBe('accepted');
    expect(rels[0]!.initiatedBy).toBe(seed.humanActorId);

    const events = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'friendship_accepted'));
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({
      requestId,
      decision: 'accepted',
      reasonCode: 'shared_history',
      source: 'character_invitation_worker',
    });
  });

  it('never auto-accepts when no valid decision exists (defer stays pending)', async () => {
    const seed = await seedSocialGraph(db);
    const requestId = await seedFriendRequest(
      db,
      seed.humanActorId,
      seed.characterActorId,
    );

    const result = await runCharacterInvitationTick(sdb, new Date(), async () => null);

    expect(result).toEqual({ considered: 1, decided: 0, deferred: 1, skipped: 0 });
    expect(await requestStatus(db, requestId)).toBe('pending');
    const rels = await db.select().from(relationships);
    expect(rels).toHaveLength(0);
    const events = await db.select().from(worldEvents);
    expect(events).toHaveLength(0);
  });

  it('declines deterministically on a blocked relationship without any model call', async () => {
    const seed = await seedSocialGraph(db);
    const requestId = await seedFriendRequest(
      db,
      seed.humanActorId,
      seed.characterActorId,
    );
    const pair = [seed.humanActorId, seed.characterActorId].sort();
    await db.insert(relationships).values({
      id: newId<string>(),
      socialGraphId: seed.graphId,
      actorAId: pair[0]!,
      actorBId: pair[1]!,
      state: 'blocked',
      initiatedBy: seed.humanActorId,
    });

    const decide = vi.fn(async () => acceptDecision());
    const result = await runCharacterInvitationTick(sdb, new Date(), decide);

    expect(decide).not.toHaveBeenCalled();
    expect(result.decided).toBe(1);
    expect(await requestStatus(db, requestId)).toBe('declined');
    const events = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'friendship_declined'));
    expect(events[0]!.payload).toMatchObject({ reasonCode: 'blocked' });
  });

  it('resolves a stale request idempotently when the relationship already exists', async () => {
    const seed = await seedSocialGraph(db);
    const requestId = await seedFriendRequest(
      db,
      seed.humanActorId,
      seed.characterActorId,
    );
    const pair = [seed.humanActorId, seed.characterActorId].sort();
    await db.insert(relationships).values({
      id: newId<string>(),
      socialGraphId: seed.graphId,
      actorAId: pair[0]!,
      actorBId: pair[1]!,
      state: 'accepted',
      initiatedBy: seed.humanActorId,
    });

    const result = await runCharacterInvitationTick(sdb, new Date(), async () => null);

    expect(result.decided).toBe(1);
    expect(await requestStatus(db, requestId)).toBe('accepted');
    const rels = await db.select().from(relationships);
    expect(rels).toHaveLength(1);
  });

  it('records ignored decisions without creating a relationship', async () => {
    const seed = await seedSocialGraph(db);
    const requestId = await seedFriendRequest(
      db,
      seed.humanActorId,
      seed.characterActorId,
    );

    const result = await runCharacterInvitationTick(sdb, new Date(), async () => ({
      decision: 'ignored',
      reasonCode: 'not_now',
      source: 'model',
    }));

    expect(result.decided).toBe(1);
    expect(await requestStatus(db, requestId)).toBe('ignored');
    expect(await db.select().from(relationships)).toHaveLength(0);
    const events = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'friend_request_ignored'));
    expect(events).toHaveLength(1);
  });

  it('is idempotent across ticks: decided requests are not reprocessed', async () => {
    const seed = await seedSocialGraph(db);
    await seedFriendRequest(db, seed.humanActorId, seed.characterActorId);

    const first = await runCharacterInvitationTick(sdb, new Date(), acceptDecision);
    const second = await runCharacterInvitationTick(sdb, new Date(), acceptDecision);

    expect(first.decided).toBe(1);
    expect(second).toEqual({ considered: 0, decided: 0, deferred: 0, skipped: 0 });
    expect(await db.select().from(worldEvents)).toHaveLength(1);
  });

  it('does not touch group invitations: every group invitee confirms explicitly', async () => {
    const seed = await seedSocialGraph(db);
    const conversationId = newId<string>();
    await db.insert(conversations).values({
      id: conversationId,
      socialGraphId: seed.graphId,
      type: 'group',
      createdByActorId: seed.humanActorId,
      publicName: '周末爬山',
    });
    await db.insert(conversationMembers).values([
      {
        conversationId,
        actorId: seed.humanActorId,
        status: 'active',
        joinedAt: new Date(),
      },
      { conversationId, actorId: seed.characterActorId, status: 'invited' },
    ]);
    const invitationId = newId<string>();
    await db.insert(groupInvitations).values({
      id: invitationId,
      conversationId,
      inviterActorId: seed.humanActorId,
      inviteeActorId: seed.characterActorId,
      purpose: 'hiking group',
      status: 'pending',
    });
    await seedFriendRequest(db, seed.humanActorId, seed.characterActorId);

    await runCharacterInvitationTick(sdb, new Date(), acceptDecision);

    const [inv] = await db
      .select()
      .from(groupInvitations)
      .where(eq(groupInvitations.id, invitationId));
    expect(inv!.status).toBe('pending');
  });
});

describe('model decision parsing', () => {
  it('parses a valid JSON decision from the gateway', async () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
    process.env.MODEL_GATEWAY_URL = 'https://openrouter.ai/api/v1';
    process.env.MODEL_GATEWAY_KEY = 'test-key-not-real';
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"decision":"declined","reason_code":"no_shared_context"}',
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const decision = await decideViaModel({
      senderName: '测试用户',
      note: null,
      sharedGroupCount: 0,
      priorRequests: [],
      characterName: '米拉',
      identityPrompt: 'Warm guide.',
      speakingStyle: 'Gentle.',
    });

    expect(decision).toEqual({
      decision: 'declined',
      reasonCode: 'no_shared_context',
      source: 'model',
    });
  });

  it('defers on invalid model output (never guesses an acceptance)', async () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
    process.env.MODEL_GATEWAY_URL = 'https://openrouter.ai/api/v1';
    process.env.MODEL_GATEWAY_KEY = 'test-key-not-real';
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '好的，我们做朋友吧！' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const decision = await decideViaModel({
      senderName: '测试用户',
      note: null,
      sharedGroupCount: 0,
      priorRequests: [],
      characterName: '米拉',
      identityPrompt: '',
      speakingStyle: '',
    });
    expect(decision).toBeNull();
  });

  it('defers when the gateway is not configured', async () => {
    delete process.env.MODEL_GATEWAY_URL;
    delete process.env.MODEL_GATEWAY_KEY;
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
    resetServerEnvForTests();
    const decision = await decideViaModel({
      senderName: 'x',
      note: null,
      sharedGroupCount: 0,
      priorRequests: [],
      characterName: 'x',
      identityPrompt: '',
      speakingStyle: '',
    });
    expect(decision).toBeNull();
  });
});
