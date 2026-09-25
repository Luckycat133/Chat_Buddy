import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { buildServer } from '../index.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';
import { seedSocialGraph } from '../test/fixtures.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import {
  accounts,
  actorIdentityLinks,
  actors,
  contactInvites,
  conversationMembers,
  groupInvitations,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import type { Database } from '../../db/index.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * P1 human friend completeness (WEB_IMPLEMENTATION §23 P1, DEMO_EXPERIENCE
 * §6): invite links, human DM, block/report distinct from unfriend, and
 * same-template identity links in shared groups.
 */
let app: FastifyInstance;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
let tokenA: string;
let tokenB: string;
let actorAId: string;
let actorBId: string;
let graphId: string;
let templateId: string;

function setBaseEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
}

/** Human account + actor in the current graph; returns session tokens. */
async function seedHuman(
  displayName: string,
): Promise<{ accountId: string; actorId: string; token: string }> {
  const accountId = newId<string>();
  await db.insert(accounts).values({ id: accountId, displayName });
  const actorId = newId<string>();
  await db.insert(actors).values({
    id: actorId,
    socialGraphId: graphId,
    accountId,
    type: 'human',
    publicName: displayName,
  });
  const tokens = await issueTokens(db as unknown as Database, accountId);
  return { accountId, actorId, token: tokens.accessToken };
}

/** Character actor with an owning account so it can hold a session. */
async function seedCharacter(
  publicName: string,
  opts: { createdAt?: Date } = {},
): Promise<{ actorId: string; token: string }> {
  const accountId = newId<string>();
  await db.insert(accounts).values({ id: accountId, displayName: publicName });
  const actorId = newId<string>();
  await db.insert(actors).values({
    id: actorId,
    socialGraphId: graphId,
    accountId,
    type: 'character',
    publicName,
    templateId,
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
  });
  const tokens = await issueTokens(db as unknown as Database, accountId);
  return { actorId, token: tokens.accessToken };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  setBaseEnv();
  resetServerEnvForTests();
  app = await buildServer({ db: db as unknown as Database, listen: false });

  const seed = await seedSocialGraph(db);
  graphId = seed.graphId;
  templateId = seed.templateId;
  actorAId = seed.humanActorId;
  const tokensA = await issueTokens(db as unknown as Database, seed.accountId);
  tokenA = tokensA.accessToken;
  const second = await seedHuman('人类乙');
  actorBId = second.actorId;
  tokenB = second.token;
});

afterEach(async () => {
  resetServerEnvForTests();
  await app.close();
  await closeTestDatabase(pg);
});

async function relationshipState(): Promise<string> {
  const [a, b] = [actorAId, actorBId].sort();
  const [row] = await db
    .select({ state: relationships.state })
    .from(relationships)
    .where(
      and(eq(relationships.actorAId, a!), eq(relationships.actorBId, b!)),
    )
    .limit(1);
  return row?.state ?? 'missing';
}

async function seedRelationship(state: string, initiatedBy = actorAId): Promise<string> {
  const id = newId<string>();
  await db.insert(relationships).values({
    id,
    socialGraphId: graphId,
    actorAId: [actorAId, actorBId].sort()[0]!,
    actorBId: [actorAId, actorBId].sort()[1]!,
    state: state as 'accepted',
    initiatedBy,
  });
  return id;
}

describe('invite links', () => {
  it('a human creates an invite, a second human redeems it, both become friends', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/invites',
      headers: auth(tokenA),
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    const { code } = created.json();

    const redeemed = await app.inject({
      method: 'POST',
      url: '/v1/invites/redeem',
      headers: auth(tokenB),
      payload: { code },
    });
    expect(redeemed.statusCode).toBe(200);
    expect(redeemed.json().relationshipId).toBeTruthy();
    expect(await relationshipState()).toBe('accepted');
  });

  it('redemption is idempotent for the same human and consumed for others', async () => {
    const { code } = (
      await app.inject({ method: 'POST', url: '/v1/invites', headers: auth(tokenA), payload: {} })
    ).json();
    const first = await app.inject({
      method: 'POST',
      url: '/v1/invites/redeem',
      headers: auth(tokenB),
      payload: { code },
    });
    expect(first.json().idempotent).toBe(false);
    const again = await app.inject({
      method: 'POST',
      url: '/v1/invites/redeem',
      headers: auth(tokenB),
      payload: { code },
    });
    expect(again.json().idempotent).toBe(true);

    const third = await seedHuman('人类丙');
    const stolen = await app.inject({
      method: 'POST',
      url: '/v1/invites/redeem',
      headers: auth(third.token),
      payload: { code },
    });
    expect(stolen.statusCode).toBe(409);
    expect(stolen.json().error.code).toBe('CONFLICT');
  });

  it('unknown codes 404; revoked codes are rejected', async () => {
    const selfRedeem = await app.inject({
      method: 'POST',
      url: '/v1/invites/redeem',
      headers: auth(tokenA),
      payload: { code: 'SELF0000' },
    });
    expect(selfRedeem.statusCode).toBe(404);

    const created = await app.inject({
      method: 'POST',
      url: '/v1/invites',
      headers: auth(tokenA),
      payload: {},
    });
    const { id, code } = created.json();
    const revoked = await app.inject({
      method: 'DELETE',
      url: `/v1/invites/${id}`,
      headers: auth(tokenA),
    });
    expect(revoked.statusCode).toBe(200);
    const after = await app.inject({
      method: 'POST',
      url: '/v1/invites/redeem',
      headers: auth(tokenB),
      payload: { code },
    });
    expect(after.statusCode).toBe(409);

    const rows = await db.select({ status: contactInvites.status }).from(contactInvites);
    expect(rows[0]?.status).toBe('revoked');
  });

  it('a blocked human cannot redeem an invite', async () => {
    await seedRelationship('blocked');
    const { code } = (
      await app.inject({ method: 'POST', url: '/v1/invites', headers: auth(tokenA), payload: {} })
    ).json();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/invites/redeem',
      headers: auth(tokenB),
      payload: { code },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('block, report, and unfriend are distinct', () => {
  beforeEach(async () => {
    await seedRelationship('accepted');
  });

  it('block sets the relationship to blocked and prevents re-contact', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/actors/${actorBId}/block`,
      headers: auth(tokenA),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(await relationshipState()).toBe('blocked');

    const req = await app.inject({
      method: 'POST',
      url: '/v1/friend-requests',
      headers: auth(tokenB),
      payload: { recipientActorId: actorAId },
    });
    expect(req.statusCode).toBe(403);
    expect(req.json().error.code).toBe('ACTOR_BLOCKED');
  });

  it('unblock severs the friendship but allows a fresh friend request', async () => {
    await app.inject({
      method: 'POST',
      url: `/v1/actors/${actorBId}/block`,
      headers: auth(tokenA),
      payload: {},
    });
    const unblock = await app.inject({
      method: 'DELETE',
      url: `/v1/actors/${actorBId}/block`,
      headers: auth(tokenA),
    });
    expect(unblock.statusCode).toBe(200);
    expect(await relationshipState()).toBe('deleted');

    const req = await app.inject({
      method: 'POST',
      url: '/v1/friend-requests',
      headers: auth(tokenB),
      payload: { recipientActorId: actorAId },
    });
    expect(req.statusCode).toBe(201);
  });

  it('unfriend ends the friendship without blocking re-contact', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/actors/${actorBId}/friend`,
      headers: auth(tokenA),
    });
    expect(res.statusCode).toBe(200);
    expect(await relationshipState()).toBe('deleted');

    // Unlike block, a new request goes through (201, not rejected).
    const req = await app.inject({
      method: 'POST',
      url: '/v1/friend-requests',
      headers: auth(tokenB),
      payload: { recipientActorId: actorAId },
    });
    expect(req.statusCode).toBe(201);

    const event = await db
      .select({ type: worldEvents.type })
      .from(worldEvents)
      .where(eq(worldEvents.type, 'friendship_deleted'));
    expect(event.length).toBeGreaterThanOrEqual(1);
  });

  it('block refuses to unfriend directly; the two actions stay distinct', async () => {
    await app.inject({
      method: 'POST',
      url: `/v1/actors/${actorBId}/block`,
      headers: auth(tokenA),
      payload: {},
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/actors/${actorBId}/friend`,
      headers: auth(tokenA),
    });
    expect(res.statusCode).toBe(422);
    expect(await relationshipState()).toBe('blocked');
  });

  it('report records a moderation row and never emits a public event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/actors/${actorBId}/report`,
      headers: auth(tokenA),
      payload: { reason: 'spam', details: '刷屏' },
    });
    expect(res.statusCode).toBe(201);
    const events = await db
      .select({ type: worldEvents.type })
      .from(worldEvents)
      .where(eq(worldEvents.type, 'actor_reported'));
    expect(events.length).toBe(0);
    expect(await relationshipState()).toBe('accepted');
  });
});

describe('human DM', () => {
  it('two accepted friends open a direct conversation with both members active', async () => {
    await seedRelationship('accepted');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: auth(tokenA),
      payload: { type: 'direct', inviteeActorIds: [actorBId] },
    });
    expect(res.statusCode).toBe(201);
    const { id } = res.json();
    const members = await db
      .select({
        actorId: conversationMembers.actorId,
        status: conversationMembers.status,
      })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, id));
    expect(members).toHaveLength(2);
    expect(members.every((m) => m.status === 'active')).toBe(true);

    // B can read the DM immediately.
    const read = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${id}/messages`,
      headers: auth(tokenB),
    });
    expect(read.statusCode).toBe(200);
  });

  it('a blocked human cannot open a direct conversation', async () => {
    await seedRelationship('blocked');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: auth(tokenB),
      payload: { type: 'direct', inviteeActorIds: [actorAId] },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('ACTOR_BLOCKED');
  });

  it('a non-friend direct conversation still requires the invitation-confirm path', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: auth(tokenA),
      payload: { type: 'direct', inviteeActorIds: [actorBId] },
    });
    expect(res.statusCode).toBe(201);
    const { id } = res.json();
    const members = await db
      .select({ status: conversationMembers.status })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, id));
    expect(members.map((m) => m.status).sort()).toEqual(['active', 'invited']);
  });
});

describe('same-template identity link in shared groups', () => {
  it('accepting a group invitation links one public identity; private relationships stay separate', async () => {
    // Two character actors instantiated from the SAME template, each with
    // an owning account and session (real API decision path).
    const charA = await seedCharacter('米拉（甲）', { createdAt: new Date(Date.now() - 10_000) });
    const charB = await seedCharacter('米拉（乙）');

    // Pre-existing private relationship (A ↔ 米拉乙) must survive untouched.
    const privateRelId = newId<string>();
    await db.insert(relationships).values({
      id: privateRelId,
      socialGraphId: graphId,
      actorAId: [actorAId, charB.actorId].sort()[0]!,
      actorBId: [actorAId, charB.actorId].sort()[1]!,
      state: 'accepted',
      initiatedBy: actorAId,
    });

    // A invites both same-template characters into a group.
    const convo = await app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: auth(tokenA),
      payload: {
        type: 'group',
        publicName: '同名聚会',
        inviteeActorIds: [charA.actorId, charB.actorId],
      },
    });
    expect(convo.statusCode).toBe(201);
    const convoId = convo.json().id;

    // Both characters accept through the real decision endpoint.
    const invitations = await db
      .select({ id: groupInvitations.id, invitee: groupInvitations.inviteeActorId })
      .from(groupInvitations)
      .where(eq(groupInvitations.conversationId, convoId));
    expect(invitations).toHaveLength(2);
    for (const inv of invitations) {
      const token = inv.invitee === charA.actorId ? charA.token : charB.token;
      const decided = await app.inject({
        method: 'POST',
        url: `/v1/invitations/${inv.id}/decision`,
        headers: auth(token),
        payload: { decision: 'accepted' },
      });
      expect(decided.statusCode).toBe(200);
    }

    // Deterministic canonical: the earliest-created actor.
    const links = await db.select().from(actorIdentityLinks);
    expect(links).toHaveLength(1);
    expect(links[0]?.canonicalActorId).toBe(charA.actorId);
    expect(links[0]?.linkedActorId).toBe(charB.actorId);
    expect(links[0]?.status).toBe('active');

    // Public projection: the linked duplicate disappears from the list and
    // the canonical remains the single public identity.
    const list = await app.inject({
      method: 'GET',
      url: '/v1/actors',
      headers: auth(tokenA),
    });
    const items = list.json().items as Array<{ id: string; identityLinkedTo: string | null }>;
    const ids = items.map((i) => i.id);
    expect(ids).toContain(charA.actorId);
    expect(ids).not.toContain(charB.actorId);

    // The private relationship is never copied or merged by the link.
    const rel = await db
      .select({ state: relationships.state })
      .from(relationships)
      .where(eq(relationships.id, privateRelId));
    expect(rel[0]?.state).toBe('accepted');

    // Exactly one identity_linked event.
    const events = await db
      .select({ id: worldEvents.id })
      .from(worldEvents)
      .where(eq(worldEvents.type, 'identity_linked'));
    expect(events).toHaveLength(1);
  });
});
