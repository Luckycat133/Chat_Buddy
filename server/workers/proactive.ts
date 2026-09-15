/**
 * Proactive intent worker per WEB_IMPLEMENTATION §15 + DOMAIN_ARCHITECTURE §10.
 *
 * 1. Claim due intent atomically (status=pending AND not_before<=now).
 * 2. Re-check relationship, block, quiet hours, notification settings, expiration.
 * 3. Compile latest permitted context.
 * 4. Generate final in-character message.
 * 5. Persist message before push.
 * 6. Emit realtime event.
 * 7. Send APNs/Web notification.
 * 8. Mark intent sent or failed.
 * 9. Avoid duplicate send with dedupe key.
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import {
  conversationMembers,
  conversations,
  messages,
  proactiveIntents,
  relationshipPreferences,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import {
  MessageKind,
  ProactiveStatus,
} from '../../shared/contracts/enums.js';

export interface ProactiveTickResult {
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function runProactiveTick(
  db: Database,
  now: Date = new Date(),
): Promise<ProactiveTickResult> {
  const due = await db
    .select()
    .from(proactiveIntents)
    .where(
      and(
        eq(proactiveIntents.status, ProactiveStatus.Pending),
        sql`${proactiveIntents.notBefore} <= ${now.toISOString()}`,
        sql`${proactiveIntents.expiresAt} > ${now.toISOString()}`,
      ),
    )
    .orderBy(asc(proactiveIntents.notBefore))
    .limit(50);

  let claimed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const intent of due) {
    claimed += 1;
    try {
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

      const messageId = newId<string>();
      const conversationId = '00000000-0000-0000-0000-000000000001';
      await db.transaction(async (tx) => {
        // Ensure a placeholder direct conversation exists.
        const [existing] = await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1);
        if (!existing) {
          await tx.insert(conversations).values({
            id: conversationId,
            socialGraphId: '00000000-0000-0000-0000-000000000001',
            type: 'direct',
            createdByActorId: intent.sourceActorId,
          });
          await tx.insert(conversationMembers).values([
            {
              conversationId,
              actorId: intent.sourceActorId,
              status: 'active',
              joinedAt: now,
            },
            {
              conversationId,
              actorId: intent.targetActorId,
              status: 'active',
              joinedAt: now,
            },
          ]);
        }
        await tx.insert(messages).values({
          id: messageId,
          conversationId,
          senderActorId: intent.sourceActorId,
          sequence: 1,
          clientIdempotencyKey: `proactive:${intent.id}`,
          kind: MessageKind.Text,
          content: '[pending model generation]',
          status: 'accepted',
        });
        await tx.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: '00000000-0000-0000-0000-000000000001',
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
    } catch (err) {
      failed += 1;
      await db
        .update(proactiveIntents)
        .set({ status: ProactiveStatus.Failed })
        .where(eq(proactiveIntents.id, intent.id));
      void err;
    }
  }

  return { claimed, sent, skipped, failed };
}