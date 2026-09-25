import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  actors,
  characterActors,
  conversationMembers,
  conversations,
  personaTemplates,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';
import { actorGraphId } from '../services/graph.js';

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
  db: Database,
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
  const existing = await loadOnboardingConversation(db, actorId);
  if (existing) return existing;

  const miraTemplate = await loadMiraTemplate(db);
  if (!miraTemplate) {
    throw new ApiError(
      ApiErrorCodes.Internal,
      'Mira persona template not seeded',
    );
  }
  const graphId = await actorGraphId(db, actorId);
  const [miraActor] = await db
    .select()
    .from(actors)
    .where(
      and(
        eq(actors.publicName, 'Mira'),
        eq(actors.socialGraphId, graphId),
      ),
    )
    .limit(1);
  const miraActorId =
    miraActor?.id ?? (await createMiraActor(db, miraTemplate.id, graphId));

  const convoId = newId<string>();
  const eventId = newId<string>();
  const occurredAt = new Date();
  await db.transaction(async (tx) => {
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
  });

  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, convoId))
    .limit(1);
  return convo!;
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
  db: Database,
): Promise<typeof personaTemplates.$inferSelect | null> {
  const rows = await db
    .select()
    .from(personaTemplates)
    .where(eq(personaTemplates.slug, 'mira'))
    .limit(1);
  return rows[0] ?? null;
}

async function createMiraActor(
  db: Database,
  templateId: string,
  socialGraphId: string,
): Promise<string> {
  const id = newId<string>();
  await db.transaction(async (tx) => {
    await tx.insert(actors).values({
      id,
      socialGraphId,
      type: 'character',
      publicName: 'Mira',
      templateId,
    });
    await tx.insert(characterActors).values({
      actorId: id,
      templateId,
      templateRevision: 1,
      socialGraphId,
    });
  });
  return id;
}