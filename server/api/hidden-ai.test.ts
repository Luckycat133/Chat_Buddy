import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildServer } from '../index.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';
import { seedSocialGraph } from '../test/fixtures.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import {
  conversationMembers,
  conversations,
  messages,
  worldEvents,
  actors,
  accounts,
} from '../../db/schema.js';
import type { Database } from '../../db/index.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * Hidden AI conversation isolation (WEB_IMPLEMENTATION §13, §23
 * P0-continuity "hidden AI chat"; DOMAIN_ARCHITECTURE §5):
 * - human endpoints never return hidden_ai_direct conversations,
 *   their messages, or identifiers enabling enumeration (sync included);
 * - only participating characters can read through the hidden endpoint;
 * - the audit endpoint is administrative and separately authorized by
 *   an audit token, never by a user session.
 */
let app: FastifyInstance;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
let humanToken: string;
let charAToken: string;
let scene: {
  hiddenConvId: string;
  normalConvId: string;
  charAId: string;
  charBId: string;
};

const AUDIT_TOKEN = 'a'.repeat(32);
const HIDDEN_SECRET = 'AI私密对谈内容：我们观察人类的作息';

function setBaseEnv(withAuditToken: boolean): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
  if (withAuditToken) {
    process.env.SERVER_AUDIT_TOKEN = AUDIT_TOKEN;
  } else {
    delete process.env.SERVER_AUDIT_TOKEN;
  }
}

async function seedHiddenScene(): Promise<void> {
  const seed = await seedSocialGraph(db);
  const charBId = newId<string>();
  await db.insert(actors).values({
    id: charBId,
    socialGraphId: seed.graphId,
    type: 'character',
    publicName: '另一角色',
    templateId: seed.templateId,
  });

  // Character actors need owning accounts to hold session tokens (the
  // schema allows account-bound character actors; auth derives the actor
  // from the account either way).
  const mkAccountFor = async (actorId: string, name: string) => {
    const accountId = newId<string>();
    await db.insert(accounts).values({ id: accountId, displayName: name });
    await db.update(actors).set({ accountId }).where(eq(actors.id, actorId));
    return accountId;
  };
  const charAAccount = await mkAccountFor(
    seed.characterActorId,
    'char-a-runtime',
  );
  await mkAccountFor(charBId, 'char-b-runtime');

  // Hidden AI direct conversation between the two characters.
  const hiddenConvId = newId<string>();
  await db.insert(conversations).values({
    id: hiddenConvId,
    socialGraphId: seed.graphId,
    type: 'hidden_ai_direct',
    createdByActorId: seed.characterActorId,
  });
  await db.insert(conversationMembers).values([
    {
      conversationId: hiddenConvId,
      actorId: seed.characterActorId,
      status: 'active',
      joinedAt: new Date(),
    },
    {
      conversationId: hiddenConvId,
      actorId: charBId,
      status: 'active',
      joinedAt: new Date(),
    },
  ]);
  await db.insert(messages).values({
    id: newId<string>(),
    conversationId: hiddenConvId,
    senderActorId: seed.characterActorId,
    sequence: 1,
    clientIdempotencyKey: 'hidden-msg-1',
    kind: 'text',
    content: HIDDEN_SECRET,
    status: 'accepted',
  });

  // A normal human↔character direct conversation as the positive control.
  const normalConvId = newId<string>();
  await db.insert(conversations).values({
    id: normalConvId,
    socialGraphId: seed.graphId,
    type: 'direct',
    createdByActorId: seed.humanActorId,
  });
  await db.insert(conversationMembers).values([
    {
      conversationId: normalConvId,
      actorId: seed.humanActorId,
      status: 'active',
      joinedAt: new Date(),
    },
    {
      conversationId: normalConvId,
      actorId: seed.characterActorId,
      status: 'active',
      joinedAt: new Date(),
    },
  ]);
  await db.insert(messages).values({
    id: newId<string>(),
    conversationId: normalConvId,
    senderActorId: seed.humanActorId,
    sequence: 1,
    clientIdempotencyKey: 'normal-msg-1',
    kind: 'text',
    content: '普通的人类消息',
    status: 'accepted',
  });

  // World events for the sync filter: one per conversation.
  await db.insert(worldEvents).values([
    {
      id: newId<string>(),
      socialGraphId: seed.graphId,
      type: 'message_sent',
      actorId: seed.humanActorId,
      subjectActorIds: [seed.humanActorId],
      conversationId: normalConvId,
      payload: { messageId: 'normal' },
      visibilityPolicy: { conversation: normalConvId },
      idempotencyKey: 'ev-normal',
    },
    {
      id: newId<string>(),
      socialGraphId: seed.graphId,
      type: 'message_sent',
      actorId: seed.characterActorId,
      subjectActorIds: [charBId],
      conversationId: hiddenConvId,
      payload: { messageId: 'hidden' },
      visibilityPolicy: { conversation: hiddenConvId },
      idempotencyKey: 'ev-hidden',
    },
  ]);

  scene = { hiddenConvId, normalConvId, charAId: seed.characterActorId, charBId };

  const humanTokens = await issueTokens(
    db as unknown as Database,
    seed.accountId,
  );
  humanToken = humanTokens.accessToken;
  const charATokens = await issueTokens(
    db as unknown as Database,
    charAAccount,
  );
  charAToken = charATokens.accessToken;
}

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  setBaseEnv(true);
  resetServerEnvForTests();
  app = await buildServer({ db: db as unknown as Database, listen: false });
  await seedHiddenScene();
});

afterEach(async () => {
  resetServerEnvForTests();
  delete process.env.SERVER_AUDIT_TOKEN;
  await app.close();
  await closeTestDatabase(pg);
});

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe('human endpoints never surface hidden_ai_direct', () => {
  it('GET /v1/conversations omits the hidden conversation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/conversations',
      headers: auth(humanToken),
    });
    expect(res.statusCode).toBe(200);
    const ids = (res.json().items as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toContain(scene.normalConvId);
    expect(ids).not.toContain(scene.hiddenConvId);
  });

  it('GET /v1/conversations/:hidden/messages denies a non-member human', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${scene.hiddenConvId}/messages`,
      headers: auth(humanToken),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('POST messages into a hidden conversation is rejected for humans', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${scene.hiddenConvId}/messages`,
      headers: auth(humanToken),
      payload: {
        clientIdempotencyKey: 'human-tries-hidden',
        content: '你们在聊什么？',
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('delta sync drops events bound to hidden conversations but keeps the rest', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/sync',
      headers: auth(humanToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      upserts: Array<{ id: string; payload: { conversationId?: string } }>;
    };
    const convIds = body.upserts.map((u) => u.payload.conversationId);
    expect(convIds).toContain(scene.normalConvId);
    expect(convIds).not.toContain(scene.hiddenConvId);
    // No identifier enabling enumeration survives either.
    expect(JSON.stringify(body)).not.toContain(scene.hiddenConvId);
  });

  it('the hidden reader endpoint rejects human callers outright', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/hidden-ai/messages?with=${scene.charBId}`,
      headers: auth(humanToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('participant-character access', () => {
  it('a participating character reads its own hidden conversation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/hidden-ai/messages?with=${scene.charBId}`,
      headers: auth(charAToken),
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ content: string }>;
    expect(items).toHaveLength(1);
    expect(items[0]!.content).toBe(HIDDEN_SECRET);
  });

  it('a character cannot read a hidden conversation it is not part of', async () => {
    const stranger = newId<string>();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/hidden-ai/messages?with=${stranger}`,
      headers: auth(charAToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('a participating character may load the conversation via membership', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${scene.hiddenConvId}/messages`,
      headers: auth(charAToken),
    });
    expect(res.statusCode).toBe(200);
    expect((res.json().items as unknown[]).length).toBe(1);
  });
});

describe('administrative audit endpoint (separate authorization)', () => {
  it('requires the audit token and rejects user sessions alone', async () => {
    const noToken = await app.inject({
      method: 'GET',
      url: `/v1/audit/hidden-ai-conversations/${scene.hiddenConvId}/messages`,
      headers: auth(humanToken),
    });
    expect(noToken.statusCode).toBe(401);

    const wrongToken = await app.inject({
      method: 'GET',
      url: `/v1/audit/hidden-ai-conversations/${scene.hiddenConvId}/messages`,
      headers: { 'x-audit-token': 'w'.repeat(32) },
    });
    expect(wrongToken.statusCode).toBe(403);
  });

  it('returns hidden messages only with the correct audit token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/audit/hidden-ai-conversations/${scene.hiddenConvId}/messages`,
      headers: { 'x-audit-token': AUDIT_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ content: string }>;
    expect(items[0]!.content).toBe(HIDDEN_SECRET);
  });

  it('is hard-disabled when no audit token is configured', async () => {
    await app.close();
    setBaseEnv(false);
    resetServerEnvForTests();
    app = await buildServer({
      db: db as unknown as Database,
      listen: false,
    });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/audit/hidden-ai-conversations/${scene.hiddenConvId}/messages`,
      headers: { 'x-audit-token': AUDIT_TOKEN },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });
});
