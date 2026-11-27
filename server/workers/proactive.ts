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
  proactiveIntents,
  pushDeliveryAttempts,
  relationshipPreferences,
} from '../../db/schema.js';
import { MessageKind, ProactiveStatus } from '../../shared/contracts/enums.js';
import {
  inQuietHours,
  nextQuietEnd,
  parseQuietHoursPolicy,
} from './quiet-hours.js';
import { NoopPushPort, type PushPort } from '../services/push.js';
import { appendConversationMessage, findConversationEvent, withConversationWrite } from '../services/conversation-writes.js';
import { readPromptAudience } from '../runtime/prompts/privacy.js';

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

    let appending = false;
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

      // Delivery needs an existing direct conversation between the pair.
      const shared = await db
      .select({
        conversationId: conversationMembers.conversationId,
      })
      .from(conversationMembers)
      .innerJoin(
        conversations,
        eq(conversations.id, conversationMembers.conversationId),
      )
      .where(
        and(
          eq(conversations.type, 'direct'),
          eq(conversations.status, 'active'),
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
      .orderBy(conversations.createdAt, conversations.id);
      const candidate = shared[0]?.conversationId;
      if (!candidate || !(await proactiveDeliveryAllowed(db, candidate, intent))) {
        await db
          .update(proactiveIntents)
          .set({ status: ProactiveStatus.Cancelled })
          .where(eq(proactiveIntents.id, intent.id));
        skipped += 1;
        continue;
      }
      const conversationId = candidate;

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

      appending = true;
      const message = await withConversationWrite(db, conversationId, async (tx, conversation) => {
        const [current] = await tx.select({ status: proactiveIntents.status }).from(proactiveIntents)
          .where(eq(proactiveIntents.id, intent.id)).for('update');
        if (!conversation || current?.status !== ProactiveStatus.Claimed) return null;

        const eventKey = `proactive_message_sent:${intent.id}`;
        const finish = (status: typeof proactiveIntents.$inferSelect.status) =>
          tx.update(proactiveIntents).set({ status }).where(eq(proactiveIntents.id, intent.id));
        if (await findConversationEvent(tx, conversation, eventKey)) {
          await finish(ProactiveStatus.Sent);
          return null;
        }
        if (intent.expiresAt <= (options.now ?? new Date())) {
          await finish(ProactiveStatus.Expired);
          return null;
        }
        if (!(await proactiveDeliveryAllowed(tx, conversationId, intent))) {
          await finish(ProactiveStatus.Cancelled);
          return null;
        }

        const persisted = await appendConversationMessage(tx, conversation, {
          senderActorId: intent.sourceActorId,
          clientIdempotencyKey: `proactive:${intent.id}`,
          kind: MessageKind.Text,
          content,
        }, {
          openBurst: false,
          event: {
            type: 'proactive_message_sent',
            idempotencyKey: eventKey,
            subjectActorIds: [intent.targetActorId],
            payload: { intentId: intent.id, reason: intent.reason },
          },
        });
        await finish(ProactiveStatus.Sent);
        return persisted;
      });
      if (!message) {
        skipped += 1;
        continue;
      }
      sent += 1;

      // A post-commit transport or audit failure cannot undo a sent message
      // or put the intent back into the writer's retry queue.
      const result = await pushPort.send({
        actorId: intent.targetActorId,
        intentId: intent.id,
        conversationId,
        messageId: message.id,
        body: content,
      }).catch(() => ({ ok: false, detail: 'Push transport failed' }));
      await db.insert(pushDeliveryAttempts).values({
        intentId: intent.id,
        actorId: intent.targetActorId,
        channel: pushPort.channel,
        ok: result.ok,
        detail: result.detail,
      });
    } catch {
      failed += 1;
      await db.update(proactiveIntents)
        .set({ status: appending ? ProactiveStatus.Pending : ProactiveStatus.Failed })
        .where(and(eq(proactiveIntents.id, intent.id), eq(proactiveIntents.status, ProactiveStatus.Claimed)));
    }
  }

  return { claimed, sent, skipped, failed, expired: expiredRows.length };
}

async function proactiveDeliveryAllowed(
  db: Pick<Database, 'select' | 'selectDistinct'>,
  conversationId: string,
  intent: typeof proactiveIntents.$inferSelect,
) {
  const audience = await readPromptAudience(db, conversationId);
  if (audience?.type !== 'direct' || !audience.relationshipId ||
    !audience.members.some((m) => m.id === intent.sourceActorId) ||
    !audience.members.some((m) => m.id === intent.targetActorId)) return false;
  const [preference] = await db
    .select({ allow: relationshipPreferences.allowProactiveMessage })
    .from(relationshipPreferences)
    .where(and(
      eq(relationshipPreferences.relationshipId, audience.relationshipId),
      eq(relationshipPreferences.ownerActorId, intent.targetActorId),
    ));
  return preference?.allow !== false;
}
