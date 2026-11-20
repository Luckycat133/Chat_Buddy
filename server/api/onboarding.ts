import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  actors,
  characterActors,
  conversationMembers,
  conversations,
  messages,
  personaTemplates,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * Mira onboarding state machine per DEMO_EXPERIENCE §4.
 *
 * The state machine lives server-side but is expressed through normal
 * messages — no fixed script. Each state accepts the user-supplied facts
 * and persists them as memories with provenance from this conversation.
 */
const ONBOARDING_STATES = [
  'welcome',
  'learn_name',
  'learn_need',
  'learn_quiet_hours',
  'learn_social_preference',
  'learn_open_thread',
  'recommend_characters',
  'friend_requests',
  'propose_group',
  'introduce_moments',
  'complete',
] as const;
type OnboardingState = (typeof ONBOARDING_STATES)[number];

const WELCOME_KEY = 'mira-first-contact-v1';
const WELCOME_COPY = 'Hi, I’m Mira. What would you like me to call you?';

interface OnboardingSnapshot {
  state: OnboardingState;
  facts: Record<string, string>;
}

export function registerOnboardingRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/onboarding',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No actor bound to session',
        );
      }
      const convo = await loadOnboardingConversation(db, actorId);
      if (!convo) return { state: 'welcome' as OnboardingState, facts: {} };
      return parseSnapshot(convo);
    },
  );

  app.post(
    '/v1/onboarding/bootstrap',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
      const convo = await ensureOnboardingConversation(db, actorId);
      const [welcome] = await db
        .select({ content: messages.content, sequence: messages.sequence,
          lastReadSequence: conversationMembers.lastReadSequence })
        .from(messages)
        .innerJoin(conversationMembers, and(
          eq(conversationMembers.conversationId, messages.conversationId),
          eq(conversationMembers.actorId, actorId),
        ))
        .where(and(eq(messages.conversationId, convo.id),
          eq(messages.clientIdempotencyKey, WELCOME_KEY)))
        .limit(1);
      return {
        conversationId: convo.id,
        preview: welcome?.content ?? null,
        unread: welcome != null && welcome.sequence > welcome.lastReadSequence,
      };
    },
  );

  app.post(
    '/v1/onboarding/read',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
      const convo = await loadOnboardingConversation(db, actorId);
      if (!convo) throw new ApiError(ApiErrorCodes.NotFound, 'First contact not found');
      // Only the authenticated member's receipt is changed, and only for the
      // first welcome sequence. Never rewind a newer read cursor.
      await db.update(conversationMembers).set({
        lastReadSequence: sql`greatest(${conversationMembers.lastReadSequence}, 1)`,
      }).where(and(eq(conversationMembers.conversationId, convo.id),
        eq(conversationMembers.actorId, actorId)));
      return { ok: true };
    },
  );

  app.post(
    '/v1/onboarding/advance',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({
          to: z.enum(ONBOARDING_STATES),
          facts: z.record(z.string().min(1).max(400)).optional(),
        })
        .parse(request.body);
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No actor bound to session',
        );
      }
      const convo = await ensureOnboardingConversation(db, actorId);
      const snapshot = parseSnapshot(convo);
      if (!ONBOARDING_STATES.includes(snapshot.state)) {
        throw new ApiError(
          ApiErrorCodes.ValidationFailed,
          'Onboarding state corrupted',
        );
      }
      const next: OnboardingSnapshot = {
        state: body.to,
        facts: { ...snapshot.facts, ...(body.facts ?? {}) },
      };
      // Persist by updating the conversation's public_name as opaque
      // JSON. The actual chat messages continue normally; this field
      // stores only the durable state machine snapshot.
      await db
        .update(conversations)
        .set({ publicName: serializeSnapshot(next) })
        .where(eq(conversations.id, convo.id));
      return next;
    },
  );
}

async function loadOnboardingConversation(
  db: Pick<Database, 'select'>,
  actorId: string,
): Promise<typeof conversations.$inferSelect | null> {
  const rows = await db
    .select({ convo: conversations })
    .from(conversationMembers)
    .innerJoin(
      conversations,
      eq(conversationMembers.conversationId, conversations.id),
    )
    .where(
      and(
        eq(conversationMembers.actorId, actorId),
        eq(conversations.type, 'direct'),
        eq(conversations.createdByActorId, actorId),
        sql`${conversations.publicName} LIKE 'onboarding:%'`,
      ),
    )
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  return rows[0]?.convo ?? null;
}

async function ensureOnboardingConversation(
  db: Database,
  actorId: string,
): Promise<typeof conversations.$inferSelect> {
  return db.transaction(async (tx) => {
    // Two tabs can bootstrap the same account concurrently. Lock its actor
    // before looking for the first chat and creating message/relationship/event.
    const [owner] = await tx.select({ graphId: actors.socialGraphId })
      .from(actors).where(eq(actors.id, actorId)).for('update');
    if (!owner) throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
    const existing = await loadOnboardingConversation(tx, actorId);
    if (existing) return existing;

    const miraTemplate = await loadMiraTemplate(tx);
    if (!miraTemplate) {
      throw new ApiError(ApiErrorCodes.Internal, 'Mira persona template not seeded');
    }
    const graphId = owner.graphId;
    const [miraActor] = await tx.select().from(actors).where(and(
      eq(actors.publicName, 'Mira'),
      eq(actors.socialGraphId, graphId),
      eq(actors.templateId, miraTemplate.id),
      eq(actors.type, 'character'),
    )).limit(1);
    const miraActorId = miraActor?.id ?? (await createMiraActor(tx, miraTemplate.id, graphId));
    const convoId = newId<string>();
    const eventId = newId<string>();
    const occurredAt = new Date();

    await tx.insert(conversations).values({
      id: convoId,
      socialGraphId: graphId,
      type: 'direct',
      publicName: serializeSnapshot({
        state: 'welcome',
        facts: {},
      }),
      createdByActorId: actorId,
    });
    await tx.insert(conversationMembers).values([
      {
        conversationId: convoId,
        actorId,
        status: 'active',
        joinedAt: new Date(),
      },
      {
        conversationId: convoId,
        actorId: miraActorId,
        status: 'active',
        joinedAt: new Date(),
      },
    ]);
    // Seed a relationship between the user and Mira.
    const [a, b] = [actorId, miraActorId].sort();
    const relRows = await tx
      .select()
      .from(relationships)
      .where(
        and(eq(relationships.actorAId, a!), eq(relationships.actorBId, b!)),
      )
      .limit(1);
    if (relRows.length === 0) {
      await tx.insert(relationships).values({
        id: newId<string>(),
        socialGraphId: graphId,
        actorAId: a!,
        actorBId: b!,
        state: 'accepted',
        initiatedBy: miraActorId,
      });
    }
    await tx.insert(messages).values({
      conversationId: convoId,
      senderActorId: miraActorId,
      sequence: 1,
      clientIdempotencyKey: WELCOME_KEY,
      kind: 'text',
      content: WELCOME_COPY,
    });
    await tx.insert(worldEvents).values({
      id: eventId,
      socialGraphId: graphId,
      type: 'onboarding_conversation_created',
      actorId,
      subjectActorIds: [actorId],
      conversationId: convoId,
      payload: { initialState: 'welcome' },
      visibilityPolicy: { participants: [actorId] },
      occurredAt,
      idempotencyKey: `onboarding_conversation_created:${convoId}`,
    });
    const [convo] = await tx.select().from(conversations)
      .where(eq(conversations.id, convoId)).limit(1);
    return convo!;
  });
}

function parseSnapshot(convo: { publicName: string | null }): OnboardingSnapshot {
  if (!convo.publicName || !convo.publicName.startsWith('onboarding:')) {
    return { state: 'welcome', facts: {} };
  }
  try {
    const parsed = JSON.parse(convo.publicName.slice('onboarding:'.length)) as OnboardingSnapshot;
    if (!ONBOARDING_STATES.includes(parsed.state)) {
      return { state: 'welcome', facts: parsed.facts ?? {} };
    }
    return parsed;
  } catch {
    return { state: 'welcome', facts: {} };
  }
}

function serializeSnapshot(snap: OnboardingSnapshot): string {
  return `onboarding:${JSON.stringify(snap)}`;
}

async function loadMiraTemplate(
  db: Pick<Database, 'select'>,
): Promise<typeof personaTemplates.$inferSelect | null> {
  const rows = await db
    .select()
    .from(personaTemplates)
    .where(eq(personaTemplates.slug, 'mira'))
    .limit(1);
  return rows[0] ?? null;
}

async function createMiraActor(
  db: Pick<Database, 'insert'>,
  templateId: string,
  socialGraphId: string,
): Promise<string> {
  const id = newId<string>();
  await db.insert(actors).values({
    id,
    socialGraphId,
    type: 'character',
    publicName: 'Mira',
    templateId,
  });
  await db.insert(characterActors).values({
    actorId: id,
    templateId,
    templateRevision: 1,
    socialGraphId,
  });
  return id;
}
