import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { buildServer } from '../index.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';
import { seedSocialGraph, type SeededGraph } from '../test/fixtures.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import type { Database } from '../../db/index.js';
import {
  accounts,
  actors,
  conversationMembers,
  conversations,
  personaTemplates,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';

const ONBOARDING_STARTED = 'onboarding_conversation_created';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let app: FastifyInstance;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
let seed: SeededGraph;
let ownerToken: string;
let strangerToken: string;

function setBaseEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
}

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function issueActorToken(accountId: string): Promise<string> {
  return (await issueTokens(db as unknown as Database, accountId)).accessToken;
}

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  setBaseEnv();
  resetServerEnvForTests();
  app = await buildServer({ db: db as unknown as Database, listen: false });
  seed = await seedSocialGraph(db);

  await db
    .update(personaTemplates)
    .set({ slug: 'mira', publicName: 'Mira' })
    .where(eq(personaTemplates.id, seed.templateId));
  await db
    .update(actors)
    .set({ publicName: 'Mira' })
    .where(eq(actors.id, seed.characterActorId));
  ownerToken = await issueActorToken(seed.accountId);

  const strangerAccountId = newId<string>();
  await db.insert(accounts).values({
    id: strangerAccountId,
    displayName: 'Unrelated Human',
  });
  await db.insert(actors).values({
    id: newId<string>(),
    socialGraphId: seed.graphId,
    accountId: strangerAccountId,
    type: 'human',
    publicName: 'Unrelated Actor',
  });
  strangerToken = await issueActorToken(strangerAccountId);
});

afterEach(async () => {
  resetServerEnvForTests();
  await app.close();
  await closeTestDatabase(pg);
});

describe('onboarding initial world-event snapshot', () => {
  it('creates the conversation and private event in one successful transaction', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/advance',
      headers: bearer(ownerToken),
      payload: { to: 'learn_name', facts: { name: '幸喵' } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      state: 'learn_name',
      facts: { name: '幸喵' },
    });

    const convoRows = await db
      .select({ convo: conversations })
      .from(conversationMembers)
      .innerJoin(
        conversations,
        eq(conversationMembers.conversationId, conversations.id),
      )
      .where(
        and(
          eq(conversationMembers.actorId, seed.humanActorId),
          sql`${conversations.publicName} LIKE 'onboarding:%'`,
        ),
      );
    expect(convoRows).toHaveLength(1);
    const convo = convoRows[0]!.convo;

    const events = await db
      .select()
      .from(worldEvents)
      .where(
        and(
          eq(worldEvents.type, ONBOARDING_STARTED),
          eq(worldEvents.conversationId, convo.id),
        ),
      );
    expect(events).toHaveLength(1);
    const event = events[0]!;

    expect(event.id).toMatch(UUID_RE);
    expect(event.socialGraphId).toBe(seed.graphId);
    expect(event.actorId).toBe(seed.humanActorId);
    expect(event.subjectActorIds).toEqual([seed.humanActorId]);
    expect(event.conversationId).toBe(convo.id);
    expect(event.type).toBe(ONBOARDING_STARTED);
    expect(event.payload).toEqual({ initialState: 'welcome' });
    expect(event.visibilityPolicy).toEqual({
      participants: [seed.humanActorId],
    });
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(Number.isNaN(event.occurredAt.getTime())).toBe(false);
    expect(event.idempotencyKey).toBe(
      `${ONBOARDING_STARTED}:${convo.id}`,
    );
  });

  it('rolls the conversation back when its world event cannot commit', async () => {
    await db.execute(sql.raw('DROP TABLE world_events'));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/advance',
      headers: bearer(ownerToken),
      payload: { to: 'learn_name' },
    });
    expect(response.statusCode).toBe(500);

    const convoRows = await db
      .select({ id: conversations.id })
      .from(conversationMembers)
      .innerJoin(
        conversations,
        eq(conversationMembers.conversationId, conversations.id),
      )
      .where(
        and(
          eq(conversationMembers.actorId, seed.humanActorId),
          sql`${conversations.publicName} LIKE 'onboarding:%'`,
        ),
      );
    expect(convoRows).toHaveLength(0);
  });

  it('does not duplicate the event on repeated advance or expose it to another actor', async () => {
    const payload = { to: 'learn_name', facts: { name: '幸喵' } };
    const first = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/advance',
      headers: bearer(ownerToken),
      payload,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/advance',
      headers: bearer(ownerToken),
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());

    const allEvents = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, ONBOARDING_STARTED));
    expect(allEvents).toHaveLength(1);

    const ownerWorldEvents = await app.inject({
      method: 'GET',
      url: `/v1/world-events?types=${ONBOARDING_STARTED}`,
      headers: bearer(ownerToken),
    });
    expect(ownerWorldEvents.statusCode).toBe(200);
    expect(ownerWorldEvents.json().items).toHaveLength(1);

    const ownerSync = await app.inject({
      method: 'GET',
      url: '/v1/sync',
      headers: bearer(ownerToken),
    });
    expect(ownerSync.statusCode).toBe(200);
    const ownerSyncBody = ownerSync.json() as {
      upserts: Array<{ payload: { id: string } }>;
    };
    expect(ownerSyncBody.upserts).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ id: allEvents[0]!.id }),
      }),
    );

    const strangerWorldEvents = await app.inject({
      method: 'GET',
      url: `/v1/world-events?types=${ONBOARDING_STARTED}`,
      headers: bearer(strangerToken),
    });
    expect(strangerWorldEvents.statusCode).toBe(200);
    expect(strangerWorldEvents.json().items).toEqual([]);

    const strangerSync = await app.inject({
      method: 'GET',
      url: '/v1/sync',
      headers: bearer(strangerToken),
    });
    expect(strangerSync.statusCode).toBe(200);
    const syncBody = strangerSync.json() as {
      upserts: Array<{ payload: { id: string } }>;
    };
    expect(syncBody.upserts).not.toContainEqual(
      expect.objectContaining({ payload: expect.objectContaining({ id: allEvents[0]!.id }) }),
    );
  });
});
