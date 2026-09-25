/**
 * Direct-session character invitation worker per PRODUCT_CONTRACT §7
 * ("Direct relationships") and DOMAIN_ARCHITECTURE §4.10.
 *
 * Scope: pending friend requests whose RECIPIENT is a character actor.
 * Group invitations are deliberately out of scope — the contract requires
 * every group invitee (including each AI) to confirm explicitly, so no
 * runtime worker may auto-resolve a `group_invitations` row.
 *
 * Decision policy (contract, not convenience):
 * - A character decision is based on character identity and social history,
 *   never random and never automatic acceptance.
 * - Hard social facts decide without a model: a blocked relationship or a
 *   blocked/unavailable sender declines; an already-accepted relationship
 *   resolves the stale request idempotently.
 * - Otherwise the model proposes {decision, reason_code} from the compiled
 *   identity + social context. Invalid, failed, or unconfigured model output
 *   DEFERS the request (it stays pending) — never a silent auto-accept.
 *
 * Application of a decision mirrors the manual endpoint
 * (server/api/friend-requests.ts): guarded `status='pending'` transition,
 * relationship promotion on accept, and a world event for the decision.
 */
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import {
  actors,
  conversationMembers,
  conversations,
  friendRequests,
  personaTemplates,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import {
  createChatCompletion,
  DEFAULT_GATEWAY_MODEL,
} from '../services/model-gateway.js';

export const CHARACTER_INVITATION_EVENT_SOURCE = 'character_invitation_worker';

/** Rows processed per tick; keeps model spend bounded per social graph. */
const MAX_PER_TICK = 10;
const DECISION_TIMEOUT_MS = 20_000;

export interface CharacterInvitationTickResult {
  /** Pending character-targeted requests observed this tick. */
  considered: number;
  /** Requests whose decision was applied (any outcome). */
  decided: number;
  /** Requests left pending because no valid decision could be produced. */
  deferred: number;
  /** Requests already decided concurrently (lost guarded update). */
  skipped: number;
}

export type CharacterInvitationDecision =
  | 'accepted'
  | 'declined'
  | 'ignored';

export interface AppliedDecision {
  decision: CharacterInvitationDecision;
  reasonCode: string;
  source: 'deterministic' | 'model';
}

interface DecisionContext {
  senderName: string;
  note: string | null;
  sharedGroupCount: number;
  priorRequests: Array<{ direction: 'inbound' | 'outbound'; status: string }>;
  characterName: string;
  identityPrompt: string;
  speakingStyle: string;
}

/**
 * Run one worker tick. `decide` is injectable for tests; production uses
 * the model gateway with identity + social-history context.
 */
export async function runCharacterInvitationTick(
  db: Database,
  now: Date = new Date(),
  decide: (
    ctx: DecisionContext,
  ) => Promise<AppliedDecision | null> = decideViaModel,
): Promise<CharacterInvitationTickResult> {
  const pending = await db
    .select({
      request: friendRequests,
      recipientType: actors.type,
      recipientStatus: actors.status,
      socialGraphId: actors.socialGraphId,
    })
    .from(friendRequests)
    .innerJoin(actors, eq(actors.id, friendRequests.recipientActorId))
    .where(
      and(
        eq(friendRequests.status, 'pending'),
        eq(actors.type, 'character'),
        sql`(${friendRequests.expiresAt} IS NULL OR ${friendRequests.expiresAt} > ${now.toISOString()})`,
      ),
    )
    .orderBy(desc(friendRequests.createdAt))
    .limit(MAX_PER_TICK);

  const result: CharacterInvitationTickResult = {
    considered: 0,
    decided: 0,
    deferred: 0,
    skipped: 0,
  };

  for (const row of pending) {
    result.considered += 1;
    const request = row.request;

    // Platform-level actor facts gate every decision path.
    if (row.recipientStatus !== 'active') {
      const applied = await applyDecision(db, request, row.socialGraphId, {
        decision: 'declined',
        reasonCode: 'character_unavailable',
        source: 'deterministic',
      }, now);
      applied ? (result.decided += 1) : (result.skipped += 1);
      continue;
    }

    const senderStatus = await db
      .select({ status: actors.status })
      .from(actors)
      .where(eq(actors.id, request.senderActorId))
      .limit(1);
    if (senderStatus[0] && senderStatus[0].status !== 'active') {
      const applied = await applyDecision(db, request, row.socialGraphId, {
        decision: 'declined',
        reasonCode: 'sender_unavailable',
        source: 'deterministic',
      }, now);
      applied ? (result.decided += 1) : (result.skipped += 1);
      continue;
    }

    const social = await loadSocialFacts(db, request);
    if (social.relationshipState === 'blocked') {
      // Contract: blocking stops future contact. No model call.
      const applied = await applyDecision(db, request, row.socialGraphId, {
        decision: 'declined',
        reasonCode: 'blocked',
        source: 'deterministic',
      }, now);
      applied ? (result.decided += 1) : (result.skipped += 1);
      continue;
    }
    if (social.relationshipState === 'accepted') {
      // Stale duplicate of an existing friendship; resolve idempotently.
      const applied = await applyDecision(db, request, row.socialGraphId, {
        decision: 'accepted',
        reasonCode: 'already_related',
        source: 'deterministic',
      }, now);
      applied ? (result.decided += 1) : (result.skipped += 1);
      continue;
    }

    const ctx = await loadDecisionContext(db, request, social);
    const decision = await decide(ctx);
    if (!decision) {
      // Contract guard: never auto-accept on failure. The request stays
      // pending for a later tick (or expires via expires_at).
      result.deferred += 1;
      continue;
    }

    const applied = await applyDecision(
      db,
      request,
      row.socialGraphId,
      decision,
      now,
    );
    applied ? (result.decided += 1) : (result.skipped += 1);
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                              social facts                                   */
/* -------------------------------------------------------------------------- */

interface SocialFacts {
  relationshipState: string | null;
  sharedGroupCount: number;
  priorRequests: Array<{ direction: 'inbound' | 'outbound'; status: string }>;
}

async function loadSocialFacts(
  db: Database,
  request: typeof friendRequests.$inferSelect,
): Promise<SocialFacts> {
  const pair = [request.senderActorId, request.recipientActorId].sort();
  const [rel] = await db
    .select({ state: relationships.state })
    .from(relationships)
    .where(
      and(
        eq(relationships.actorAId, pair[0]!),
        eq(relationships.actorBId, pair[1]!),
      ),
    )
    .limit(1);

  const priorRows = await db
    .select({
      senderActorId: friendRequests.senderActorId,
      status: friendRequests.status,
    })
    .from(friendRequests)
    .where(
      and(
        ne(friendRequests.id, request.id),
        or(
          and(
            eq(friendRequests.senderActorId, request.senderActorId),
            eq(friendRequests.recipientActorId, request.recipientActorId),
          ),
          and(
            eq(friendRequests.senderActorId, request.recipientActorId),
            eq(friendRequests.recipientActorId, request.senderActorId),
          ),
        ),
      ),
    )
    .orderBy(desc(friendRequests.createdAt))
    .limit(5);

  // Shared groups where BOTH actors are active members (social history).
  const senderMemberships = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .innerJoin(
      conversations,
      eq(conversations.id, conversationMembers.conversationId),
    )
    .where(
      and(
        eq(conversationMembers.actorId, request.senderActorId),
        eq(conversationMembers.status, 'active'),
        eq(conversations.type, 'group'),
      ),
    );
  const senderSet = new Set(senderMemberships.map((m) => m.conversationId));
  let sharedGroupCount = 0;
  if (senderSet.size > 0) {
    const shared = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.actorId, request.recipientActorId),
          eq(conversationMembers.status, 'active'),
          inArray(conversationMembers.conversationId, [...senderSet]),
        ),
      );
    sharedGroupCount = shared.length;
  }

  return {
    relationshipState: rel?.state ?? null,
    sharedGroupCount,
    priorRequests: priorRows.map((r) => ({
      direction:
        r.senderActorId === request.senderActorId ? 'inbound' : 'outbound',
      status: r.status,
    })),
  };
}

async function loadDecisionContext(
  db: Database,
  request: typeof friendRequests.$inferSelect,
  social: SocialFacts,
): Promise<DecisionContext> {
  const [sender] = await db
    .select({ publicName: actors.publicName })
    .from(actors)
    .where(eq(actors.id, request.senderActorId))
    .limit(1);
  const [character] = await db
    .select({
      publicName: actors.publicName,
      identityPrompt: personaTemplates.identityPrompt,
      speakingStyle: personaTemplates.speakingStyle,
    })
    .from(actors)
    .leftJoin(personaTemplates, eq(personaTemplates.id, actors.templateId))
    .where(eq(actors.id, request.recipientActorId))
    .limit(1);

  return {
    senderName: sender?.publicName ?? 'unknown actor',
    note: request.note,
    sharedGroupCount: social.sharedGroupCount,
    priorRequests: social.priorRequests,
    characterName: character?.publicName ?? 'the character',
    identityPrompt: (character?.identityPrompt ?? '').slice(0, 1200),
    speakingStyle: (character?.speakingStyle ?? '').slice(0, 300),
  };
}

/* -------------------------------------------------------------------------- */
/*                            model-based decision                             */
/* -------------------------------------------------------------------------- */

const DECISION_SYSTEM_PROMPT = [
  'You decide contact requests for a character in Chat Buddy, as the character.',
  'Product contract: your decision must follow from the character identity and',
  'the shared social history provided. Never accept randomly or automatically;',
  'declining or ignoring is a valid, respectful outcome when history or identity',
  'does not support a new direct relationship. Respond with ONLY a JSON object:',
  '{"decision":"accepted|declined|ignored","reason_code":"lowercase_snake_case_max_32"}',
].join(' ');

function sanitizeReasonCode(raw: unknown): string {
  if (typeof raw !== 'string') return 'unspecified';
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleaned.length < 2) return 'unspecified';
  return cleaned.slice(0, 32);
}

function extractJsonBlock(text: string): unknown | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

/** Production decider: identity + social history via the model gateway. */
export async function decideViaModel(
  ctx: DecisionContext,
): Promise<AppliedDecision | null> {
  const prompt = JSON.stringify({
    character: ctx.characterName,
    character_identity: ctx.identityPrompt,
    speaking_style: ctx.speakingStyle,
    sender: ctx.senderName,
    request_note: ctx.note,
    shared_groups: ctx.sharedGroupCount,
    prior_requests: ctx.priorRequests,
  });

  let content: string;
  try {
    const completion = await createChatCompletion({
      model: DEFAULT_GATEWAY_MODEL,
      system: DECISION_SYSTEM_PROMPT,
      prompt,
      maxTokens: 128,
      temperature: 0.4,
      timeoutMs: DECISION_TIMEOUT_MS,
    });
    content = completion.content;
  } catch {
    // Gateway unconfigured, unreachable, rate limited, or timed out:
    // the contract forbids guessing an acceptance. Defer.
    return null;
  }

  const parsed = extractJsonBlock(content);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('decision' in parsed)
  ) {
    return null;
  }
  const raw = parsed as { decision?: unknown; reason_code?: unknown };
  const decision = raw.decision;
  if (
    decision !== 'accepted' &&
    decision !== 'declined' &&
    decision !== 'ignored'
  ) {
    return null;
  }
  return {
    decision,
    reasonCode: sanitizeReasonCode(raw.reason_code),
    source: 'model',
  };
}

/* -------------------------------------------------------------------------- */
/*                            decision application                             */
/* -------------------------------------------------------------------------- */

async function applyDecision(
  db: Database,
  request: typeof friendRequests.$inferSelect,
  socialGraphId: string,
  decision: AppliedDecision,
  now: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Guarded transition: only the first writer from `pending` wins, so a
    // concurrent manual decision or duplicate tick can never double-apply.
    const updated = await tx
      .update(friendRequests)
      .set({ status: decision.decision, decidedAt: now })
      .where(
        and(
          eq(friendRequests.id, request.id),
          eq(friendRequests.status, 'pending'),
        ),
      )
      .returning({ id: friendRequests.id });
    if (updated.length === 0) return false;

    if (decision.decision === 'accepted') {
      const pair = [request.senderActorId, request.recipientActorId].sort();
      const [existing] = await tx
        .select({ id: relationships.id })
        .from(relationships)
        .where(
          and(
            eq(relationships.actorAId, pair[0]!),
            eq(relationships.actorBId, pair[1]!),
          ),
        )
        .limit(1);
      if (!existing) {
        await tx.insert(relationships).values({
          id: newId<string>(),
          socialGraphId,
          actorAId: pair[0]!,
          actorBId: pair[1]!,
          state: 'accepted',
          initiatedBy: request.senderActorId,
        });
      }
    }

    // Decisions are runtime social actions: record them (no model output,
    // no chain-of-thought — only the decision and a stable reason code).
    const eventType =
      decision.decision === 'accepted'
        ? 'friendship_accepted'
        : decision.decision === 'declined'
          ? 'friendship_declined'
          : 'friend_request_ignored';
    await tx.insert(worldEvents).values({
      id: newId<string>(),
      socialGraphId,
      type: eventType,
      actorId: request.recipientActorId,
      subjectActorIds: [request.senderActorId, request.recipientActorId],
      payload: {
        requestId: request.id,
        decision: decision.decision,
        reasonCode: decision.reasonCode,
        decisionSource: decision.source,
        source: CHARACTER_INVITATION_EVENT_SOURCE,
      },
      visibilityPolicy: {
        participants: [request.senderActorId, request.recipientActorId],
      },
      idempotencyKey: `${eventType}:worker:${request.id}`,
    });

    return true;
  });
}
