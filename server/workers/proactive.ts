/**
 * Proactive intent worker per WEB_IMPLEMENTATION §15 and
 * DOMAIN_ARCHITECTURE §4.21 / §10.
 *
 * One tick:
 *   1. expire intents whose deadline passed (server-authoritative),
 *   2. claim due pending intents (atomic transition, dedupe-safe),
 *   3. re-validate at execution time: quiet hours (user-local basis),
 *      relationship preference, accepted relationship, and a real direct
 *      conversation for delivery — anything unmet defers or cancels,
 *   4. generate the message text via the injected generator (the model
 *      gateway in production); generation failure fails the intent and
 *      sends nothing,
 *   5. persist the message BEFORE any push (message-before-push), then
 *      fire the push port and record one delivery attempt per call.
 *
 * Re-running a tick is idempotent: only pending intents are claimable,
 * and the message idempotency key is derived from the intent id.
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import {
  conversationMembers,
  conversations,
  messages,
  proactiveIntents,
  pushDeliveryAttempts,
  relationshipPreferences,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import { MessageKind, ProactiveStatus } from '../../shared/contracts/enums.js';
import {
  inQuietHours,
  nextQuietEnd,
  parseQuietHoursPolicy,
} from './quiet-hours.js';
import { NoopPushPort, type PushPort } from '../services/push.js';

export interface ProactiveMessageInput {
  intentId: string;
  sourceActorId: string;
  targetActorId: string;
  reason: string;
  desiredEffect: string;
  conversationId: string;
}

/**
 * Produces the visible message text for one intent. Production wires the
 * model gateway; tests inject fakes. Throwing fails the intent cleanly.
 */
export type ProactiveMessageGenerator = (
  input: ProactiveMessageInput,
) => Promise<string>;

export interface ProactiveTickOptions {
  /** Clock override for deterministic tests. Defaults to now. */
  now?: Date;
  /** Push transport. Defaults to the contract-stub NoopPushPort. */
  pushPort?: PushPort;
  /** Message text generator. Defaults to the model gateway. */
  generateMessage?: ProactiveMessageGenerator;
}

export interface ProactiveTickResult {
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  expired: number;
}

const DEFAULT_MESSAGE_GENERATOR: ProactiveMessageGenerator = async () => {
  // Production placeholder: the model gateway wiring lives in the runtime
  // bootstrap; without it the worker still records truthful attempts.
  throw new Error('proactive message generator is not configured');
};

export async function runProactiveTick(
  db: Database,
  options: ProactiveTickOptions = {},
): Promise<ProactiveTickResult> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const pushPort = options.pushPort ?? new NoopPushPort();
  const generateMessage = options.generateMessage ?? DEFAULT_MESSAGE_GENERATOR;

  // 1. Expiration pass: past-deadline pending intents never send.
  const expiredRows = await db
    .update(proactiveIntents)
    .set({ status: ProactiveStatus.Expired })
    .where(
      and(
        eq(proactiveIntents.status, ProactiveStatus.Pending),
        sql`${proactiveIntents.expiresAt} <= ${nowIso}`,
      ),
    )
    .returning({ id: proactiveIntents.id });

  // 2. Claim due pending intents, oldest not-before first.
  const due = await db
    .select()
    .from(proactiveIntents)
    .where(
      and(
        eq(proactiveIntents.status, ProactiveStatus.Pending),
        sql`${proactiveIntents.notBefore} <= ${nowIso}`,
        sql`${proactiveIntents.expiresAt} > ${nowIso}`,
      ),
    )
    .orderBy(asc(proactiveIntents.notBefore))
    .limit(50);

  let claimed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const intent of due) {
    const claim = await db
      .update(proactiveIntents)
      .set({ status: ProactiveStatus.Claimed })
      .where(
        and(
          eq(proactiveIntents.id, intent.id),
          eq(proactiveIntents.status, ProactiveStatus.Pending),
        ),
      )
      .returning({ id: proactiveIntents.id });
    if (claim.length === 0) {
      skipped += 1;
      continue;
    }
    claimed += 1;

    try {
      // Quiet hours: defer on the user-local basis; retry after the window.
      const policy = parseQuietHoursPolicy(intent.quietHoursPolicy);
      if (policy && inQuietHours(now, policy)) {
        await db
          .update(proactiveIntents)
          .set({
            status: ProactiveStatus.Pending,
            notBefore: nextQuietEnd(now, policy),
          })
          .where(eq(proactiveIntents.id, intent.id));
        skipped += 1;
        continue;
      }

      // The target must not have opted out of proactive messages.
      const [pref] = await db
        .select({ allow: relationshipPreferences.allowProactiveMessage })
        .from(relationshipPreferences)
        .where(eq(relationshipPreferences.ownerActorId, intent.targetActorId))
        .limit(1);
      if (pref && pref.allow === false) {
        await db
          .update(proactiveIntents)
          .set({ status: ProactiveStatus.Cancelled })
          .where(eq(proactiveIntents.id, intent.id));
        skipped += 1;
        continue;
      }

      // A real accepted relationship is required (friend/DM state).
      const [rel] = await db
        .select({ id: relationships.id })
        .from(relationships)
        .where(
          sql`${relationships.state} = 'accepted' AND (
            (${relationships.actorAId} = ${intent.sourceActorId}
              AND ${relationships.actorBId} = ${intent.targetActorId})
            OR
            (${relationships.actorAId} = ${intent.targetActorId}
              AND ${relationships.actorBId} = ${intent.sourceActorId})
          )`,
        )
        .limit(1);
      if (!rel) {
        await db
          .update(proactiveIntents)
          .set({ status: ProactiveStatus.Cancelled })
          .where(eq(proactiveIntents.id, intent.id));
        skipped += 1;
        continue;
      }

      // Delivery needs an existing direct conversation between the pair.
      const shared = await db
      .select({
        conversationId: conversationMembers.conversationId,
        socialGraphId: conversations.socialGraphId,
      })
      .from(conversationMembers)
      .innerJoin(
        conversations,
        eq(conversations.id, conversationMembers.conversationId),
      )
      .where(
        and(
          eq(conversations.type, 'direct'),
          eq(conversationMembers.status, 'active'),
          sql`${conversationMembers.actorId} = ${intent.sourceActorId}`,
          sql`EXISTS (
            SELECT 1 FROM ${conversationMembers} cm2
            WHERE cm2.conversation_id = ${conversationMembers.conversationId}
              AND cm2.actor_id = ${intent.targetActorId}
              AND cm2.status = 'active'
          )`,
        ),
      )
      .limit(1);
      if (shared.length === 0) {
        await db
          .update(proactiveIntents)
          .set({ status: ProactiveStatus.Cancelled })
          .where(eq(proactiveIntents.id, intent.id));
        skipped += 1;
        continue;
      }
      const conversationId = shared[0]!.conversationId;

      // Generation happens outside the transaction: a gateway failure
      // fails the intent without leaving half-written state.
      const content = await generateMessage({
        intentId: intent.id,
        sourceActorId: intent.sourceActorId,
        targetActorId: intent.targetActorId,
        reason: intent.reason,
        desiredEffect: intent.desiredEffect,
        conversationId,
      });

      const messageId = newId<string>();
      const eventGraphId = shared[0]!.socialGraphId;
      await db.transaction(async (tx) => {
        const [seqRow] = await tx
          .select({ next: sql<number>`COALESCE(MAX(${messages.sequence}), 0) + 1` })
          .from(messages)
          .where(eq(messages.conversationId, conversationId));
        const sequence = seqRow?.next ?? 1;
        await tx.insert(messages).values({
          id: messageId,
          conversationId,
          senderActorId: intent.sourceActorId,
          sequence,
          clientIdempotencyKey: `proactive:${intent.id}`,
          kind: MessageKind.Text,
          content,
          status: 'accepted',
        });
        await tx.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: eventGraphId,
          type: 'proactive_message_sent',
          actorId: intent.sourceActorId,
          subjectActorIds: [intent.targetActorId],
          conversationId,
          payload: {
            intentId: intent.id,
            messageId,
            reason: intent.reason,
          },
          visibilityPolicy: { conversation: conversationId },
          idempotencyKey: `proactive_message_sent:${intent.id}`,
        });
        await tx
          .update(proactiveIntents)
          .set({ status: ProactiveStatus.Sent })
          .where(eq(proactiveIntents.id, intent.id));
      });
      sent += 1;

      // Push only after the message is durable; a push failure keeps the
      // message and the sent status — every attempt is audited.
      const pushResult = await pushPort.send({
        actorId: intent.targetActorId,
        intentId: intent.id,
        conversationId,
        messageId,
        body: content,
      });
      await db.insert(pushDeliveryAttempts).values({
        intentId: intent.id,
        actorId: intent.targetActorId,
        channel: pushPort.channel,
        ok: pushResult.ok,
        detail: pushResult.detail,
      });
    } catch {
      failed += 1;
      await db
        .update(proactiveIntents)
        .set({ status: ProactiveStatus.Failed })
        .where(eq(proactiveIntents.id, intent.id));
    }
  }

  return { claimed, sent, skipped, failed, expired: expiredRows.length };
}
