import { and, desc, eq, gt, gte, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../../db/index.js';
import {
  actors,
  actorCapabilitySettings,
  conversationMembers,
  conversations,
  memoryGrants,
  memoryItems,
  messageBursts,
  messages,
  relationshipNarratives,
  relationships,
  worldEvents,
} from '../../../db/schema.js';

type Reader = Pick<Database, 'select' | 'selectDistinct'>;
type Memory = typeof memoryItems.$inferSelect;

export async function readPromptAudience(db: Reader, conversationId: string) {
  const rows = await db
    .select({
      graphId: conversations.socialGraphId,
      conversationType: conversations.type,
      id: actors.id,
      name: actors.publicName,
      type: actors.type,
      status: actors.status,
      joinedAt: conversationMembers.joinedAt,
    })
    .from(conversations)
    .innerJoin(conversationMembers, eq(conversations.id, conversationMembers.conversationId))
    .innerJoin(actors, eq(actors.id, conversationMembers.actorId))
    .where(and(
      eq(conversations.id, conversationId),
      eq(conversations.status, 'active'),
      eq(conversationMembers.status, 'active'),
    ))
    .orderBy(actors.id);
  const first = rows[0];
  if (!first || rows.some((row) => row.status !== 'active')) return null;
  const { graphId, conversationType } = first;
  if (conversationType !== 'group' && rows.length !== 2) return null;
  if (conversationType === 'hidden_ai_direct' && rows.some((row) => row.type !== 'character')) {
    return null;
  }
  const memberIds = rows.map((row) => row.id);
  const edges = await db
    .select({ id: relationships.id, state: relationships.state })
    .from(relationships)
    .where(and(
      inArray(relationships.actorAId, memberIds),
      inArray(relationships.actorBId, memberIds),
      ne(relationships.actorAId, relationships.actorBId),
    ));
  if (edges.some((edge) => edge.state === 'blocked')) return null;

  return {
    conversationId,
    graphId,
    type: conversationType,
    members: rows.map(({ id, name, type, joinedAt }) => ({ id, name, type, joinedAt })),
    // Opposite-order legacy rows are ambiguous even if one is accepted.
    relationshipId:
      conversationType !== 'group' && edges.length === 1 && edges[0]?.state === 'accepted'
        ? edges[0].id
        : null,
  };
}

export type PromptAudience = NonNullable<Awaited<ReturnType<typeof readPromptAudience>>>;

export function visiblePromptMessages(audience: PromptAudience) {
  // A new group member did not witness messages before their own admission.
  // All recipients of a generated reply must have been eligible for the input.
  const joinedTimes = audience.members.map((member) => member.joinedAt?.getTime());
  const groupHistory = audience.type !== 'group'
    ? undefined
    : joinedTimes.some((time) => time === undefined)
      ? sql`false`
      : gte(messages.createdAt, new Date(Math.max(...joinedTimes as number[])));
  return and(
    eq(messages.conversationId, audience.conversationId),
    eq(messages.status, 'accepted'),
    isNull(messages.deletedAt),
    inArray(messages.senderActorId, audience.members.map((member) => member.id)),
    groupHistory,
  );
}

function visibleMessageEvents(audience: PromptAudience) {
  return and(
    visiblePromptMessages(audience),
    eq(worldEvents.socialGraphId, audience.graphId),
    eq(worldEvents.conversationId, audience.conversationId),
    eq(worldEvents.type, 'message_sent'),
    sql`${worldEvents.visibilityPolicy}->>'conversation' = ${audience.conversationId}`,
  );
}

const eventMessage = and(
  eq(worldEvents.actorId, messages.senderActorId),
  sql`${worldEvents.payload}->>'messageId' = ${messages.id}::text`,
);

export async function readMemorySource(db: Reader, audience: PromptAudience, burstId: string) {
  const [source] = await db
    .select({
      eventId: worldEvents.id,
      actorId: messages.senderActorId,
      messageId: messages.id,
    })
    .from(messageBursts)
    .innerJoin(messages, and(
      eq(messages.burstId, messageBursts.id),
      eq(messages.conversationId, messageBursts.conversationId),
      eq(messages.senderActorId, messageBursts.senderActorId),
    ))
    .innerJoin(worldEvents, eventMessage)
    .where(and(visibleMessageEvents(audience), eq(messageBursts.id, burstId)))
    .orderBy(desc(messages.sequence), worldEvents.id)
    .limit(1);
  return source ?? null;
}

export async function readPromptNarrative(db: Reader, audience: PromptAudience) {
  if (!audience.relationshipId) return null;
  const [narrative] = await db
    .select({
      currentDynamic: relationshipNarratives.currentDynamic,
      version: relationshipNarratives.version,
      sources: relationshipNarratives.changedByEventIds,
    })
    .from(relationshipNarratives)
    .where(eq(relationshipNarratives.relationshipId, audience.relationshipId))
    .orderBy(desc(relationshipNarratives.version))
    .limit(1);
  if (!narrative) return null;
  const parsed = z.array(z.string().uuid()).safeParse(narrative.sources);
  if (!parsed.success) return null;
  const sources = [...new Set(parsed.data)];
  if (sources.length > 0) {
    const readable = await db.selectDistinct({ id: worldEvents.id })
      .from(worldEvents)
      .innerJoin(messages, eventMessage)
      .where(and(visibleMessageEvents(audience), inArray(worldEvents.id, sources)));
    if (readable.length !== sources.length) return null;
  }
  return narrative;
}

const id = z.string().uuid();
const generatedScopeSchema = z.object({
  origin: z.literal('generation'),
  conversationId: id,
  relationshipId: id.nullable(),
  members: z.array(z.object({ id, joinedAt: z.string().datetime().nullable() })),
  messageIds: z.array(id),
  memoryIds: z.array(id),
  narrativeVersion: z.number().int().positive().nullable(),
  weatherDefault: z.object({ actorId: id, settingsVersion: z.string().datetime() }).nullable(),
});

export type GeneratedScope = z.infer<typeof generatedScopeSchema>;

export function capturePromptScope(
  audience: PromptAudience,
  sources: Pick<GeneratedScope, 'messageIds' | 'memoryIds' | 'narrativeVersion' | 'weatherDefault'>,
): GeneratedScope {
  return {
    origin: 'generation',
    conversationId: audience.conversationId,
    relationshipId: audience.relationshipId,
    members: audience.members.map(({ id, joinedAt }) => ({ id, joinedAt: joinedAt?.toISOString() ?? null })),
    ...sources,
  };
}

export async function isPromptScopeCurrent(
  db: Reader,
  audience: PromptAudience,
  actorId: string,
  scope: GeneratedScope,
  authorize: ReturnType<typeof memoryAuthorizer> = memoryAuthorizer(db, audience),
  visited: ReadonlySet<string> = new Set(),
): Promise<boolean> {
  if (
    scope.conversationId !== audience.conversationId ||
    scope.relationshipId !== audience.relationshipId ||
    !audience.members.some((m) => m.id === actorId)
  ) {
    return false;
  }
  if (scope.members.length !== audience.members.length || scope.members.some(({ id, joinedAt }, index) => {
    const member = audience.members[index];
    return id !== member?.id || joinedAt !== (member.joinedAt?.toISOString() ?? null);
  })) return false;
  if (scope.narrativeVersion !== null && (await readPromptNarrative(db, audience))?.version !== scope.narrativeVersion) {
    return false;
  }
  if (scope.weatherDefault) {
    const [settings] = await db.select().from(actorCapabilitySettings)
      .where(eq(actorCapabilitySettings.actorId, scope.weatherDefault.actorId));
    if (!settings?.weatherConsentAt || settings.updatedAt.toISOString() !== scope.weatherDefault.settingsVersion) return false;
  }
  if (scope.messageIds.length > 0) {
    const readable = await db.select({ id: messages.id }).from(messages)
      .where(and(visiblePromptMessages(audience), inArray(messages.id, scope.messageIds)));
    if (readable.length !== scope.messageIds.length) return false;
  }
  if (scope.memoryIds.length > 0) {
    const parents = await db.select().from(memoryItems).where(inArray(memoryItems.id, scope.memoryIds));
    if (parents.length !== scope.memoryIds.length) return false;
    for (const parent of parents) {
      if (!(await authorize(parent, actorId, visited))) return false;
    }
  }
  return true;
}

export function memoryAuthorizer(db: Reader, audience: PromptAudience) {
  // A model can derive several memories from the same parent in one turn.
  // Reuse checks within the same read snapshot and reject cyclic lineage.
  const checked = new Map<string, boolean>();

  async function authorize(memory: Memory, actorId: string, visited: ReadonlySet<string> = new Set()): Promise<boolean> {
    if (visited.has(memory.id) || visited.size >= 16) return false;
    const key = `${actorId}:${memory.id}`;
    const cached = checked.get(key);
    if (cached !== undefined) return cached;
    const allowed = await check(memory, actorId, new Set([...visited, memory.id]));
    checked.set(key, allowed);
    return allowed;
  }

  async function check(memory: Memory, actorId: string, visited: ReadonlySet<string>) {
    if (memory.deletedAt || memory.supersededById || !audience.members.some((m) => m.id === actorId)) return false;
    const share = (memory.sharePolicy ?? {}) as { conversationIds?: unknown; excludeConversationIds?: unknown };
    if (Array.isArray(share.excludeConversationIds) && share.excludeConversationIds.includes(audience.conversationId)) return false;
    const explicit = Array.isArray(share.conversationIds) && share.conversationIds.includes(audience.conversationId);
    if (Array.isArray(share.conversationIds) && share.conversationIds.length > 0 && !explicit) return false;
    if (memory.relationshipId && memory.relationshipId !== audience.relationshipId) return false;

    const scope = generatedScopeSchema.safeParse(memory.visibilityPolicy);
    const hasGeneratedOrigin = (memory.visibilityPolicy as { origin?: unknown } | null)?.origin === 'generation';
    if (hasGeneratedOrigin && !scope.success) return false;
    const source = await readSourceEvent(db, memory.sourceEventId);
    if (scope.success || source?.type === 'message_sent') {
      // Older generated rows point at the AI reply instead of its inputs.
      // That reply cannot justify disclosure or recover the missing lineage.
      if (!scope.success && source?.isGenerated) return false;
      if (!(await hasVisibleSource(db, audience, memory.sourceEventId, memory.sourceActorId))) return false;
    }
    if (memory.type === 'private' && !memory.relationshipId && !scope.success && !explicit) return false;

    if (actorId !== memory.ownerActorId) {
      const [grant] = await db.select({ permission: memoryGrants.permission })
        .from(memoryGrants)
        .where(and(
          eq(memoryGrants.memoryId, memory.id),
          eq(memoryGrants.granteeActorId, actorId),
          or(isNull(memoryGrants.expiresAt), gt(memoryGrants.expiresAt, new Date())),
        ));
      // A response model can disclose any raw input. The know/summarize/quote
      // grants are usable here only when every recipient already has access.
      if (!grant || (grant.permission !== 'disclose' && !scope.success && !memory.relationshipId)) return false;
      const external = audience.members.map((member) => member.id).filter((id) => id !== memory.ownerActorId);
      const [block] = await db.select({ id: relationships.id }).from(relationships).where(and(
        eq(relationships.state, 'blocked'),
        or(
          and(eq(relationships.actorAId, memory.ownerActorId), inArray(relationships.actorBId, external)),
          and(eq(relationships.actorBId, memory.ownerActorId), inArray(relationships.actorAId, external)),
        ),
      )).limit(1);
      if (block) return false;
    }
    return !scope.success || (
      (audience.type === 'group' || memory.relationshipId !== null) &&
      await isPromptScopeCurrent(db, audience, memory.ownerActorId, scope.data, authorize, visited)
    );
  }

  return authorize;
}

async function readSourceEvent(db: Reader, eventId: string) {
  const [row] = await db.select({
    type: worldEvents.type,
    isGenerated: sql<boolean>`${worldEvents.payload} ? 'model'`,
  }).from(worldEvents).where(eq(worldEvents.id, eventId));
  return row;
}

export async function hasVisibleSource(
  db: Reader,
  audience: PromptAudience,
  eventId: string,
  sourceActorId: string | null,
): Promise<boolean> {
  if (!sourceActorId || !audience.members.some((m) => m.id === sourceActorId)) return false;
  const [source] = await db.select({ id: worldEvents.id }).from(worldEvents)
    .innerJoin(messages, eventMessage)
    .where(and(
      visibleMessageEvents(audience),
      eq(worldEvents.id, eventId),
      eq(worldEvents.actorId, sourceActorId),
    ));
  return source !== undefined;
}
