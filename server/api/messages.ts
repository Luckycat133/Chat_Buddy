import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  conversationMembers,
  conversations,
  messageBursts,
  messages,
  worldEvents,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';
import {
  BurstClosedReason,
  MessageKind,
  MessageStatus,
} from '../../shared/contracts/enums.js';

/**
 * Message endpoints per WEB_IMPLEMENTATION §12 and DOMAIN_ARCHITECTURE §4.14-§4.15.
 *
 * Invariants:
 *   - Sender must be an `active` member of the conversation.
 *   - Idempotency key + (conversation_id) is unique; replays return existing row.
 *   - Hidden AI conversations reject writes from human endpoints.
 *   - On burst close, server emits `message_burst_closed` and wakes attention
 *     for eligible actors (delegated to the attention worker).
 */
export function registerMessageRoutes(app: FastifyInstance): void {
  app.post(
    '/v1/conversations/:conversationId/messages',
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = z
        .object({ conversationId: z.string().uuid() })
        .parse(request.params);
      const body = z
        .object({
          clientIdempotencyKey: z.string().min(8).max(128),
          kind: z.nativeEnum(MessageKind).default('text'),
          content: z.string().min(1).max(32_000),
          replyToMessageId: z.string().uuid().optional(),
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

      // Reject hidden AI direct from human writes.
      const [conv] = await db
        .select({ type: conversations.type })
        .from(conversations)
        .where(eq(conversations.id, params.conversationId))
        .limit(1);
      if (!conv) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Conversation not found');
      }
      if (conv.type === 'hidden_ai_direct') {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Hidden AI conversation is not human-writable',
        );
      }

      const [membership] = await db
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, params.conversationId),
            eq(conversationMembers.actorId, actorId),
          ),
        )
        .limit(1);
      if (!membership || membership.status !== 'active') {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Sender is not an active member',
        );
      }

      const result = await db.transaction(async (tx) => {
        // Idempotency replay: if same (conversation, key) exists, return it.
        const [existing] = await tx
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, params.conversationId),
              eq(
                messages.clientIdempotencyKey,
                body.clientIdempotencyKey,
              ),
            ),
          )
          .limit(1);
        if (existing) return existing;

        const [seqRow] = await tx
          .select({ next: sql<number>`COALESCE(MAX(${messages.sequence}), 0) + 1` })
          .from(messages)
          .where(eq(messages.conversationId, params.conversationId));
        const sequence = seqRow?.next ?? 1;

        const burstId = await openOrExtendBurst(
          tx,
          params.conversationId,
          actorId,
          sequence,
        );

        const id = newId<string>();
        const [inserted] = await tx
          .insert(messages)
          .values({
            id,
            conversationId: params.conversationId,
            senderActorId: actorId,
            sequence,
            clientIdempotencyKey: body.clientIdempotencyKey,
            kind: body.kind,
            content: body.content,
            replyToMessageId: body.replyToMessageId ?? null,
            burstId,
            status: MessageStatus.Accepted,
          })
          .returning();
        return inserted!;
      });

      // Fire-and-forget event for projections; failure must not block response.
      try {
        await db.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: '00000000-0000-0000-0000-000000000001',
          type: 'message_sent',
          actorId,
          subjectActorIds: [actorId],
          conversationId: params.conversationId,
          payload: {
            messageId: result.id,
            sequence: result.sequence,
            burstId: result.burstId,
          },
          visibilityPolicy: { conversation: params.conversationId },
          idempotencyKey: `message_sent:${result.id}`,
        });
      } catch {
        // ignored: events table may not be reachable in tests
      }

      reply.code(201);
      return { id: result.id, sequence: result.sequence };
    },
  );

  app.get(
    '/v1/conversations/:conversationId/messages',
    { preHandler: requireAuth },
    async (request) => {
      const params = z
        .object({ conversationId: z.string().uuid() })
        .parse(request.params);
      const q = z
        .object({
          cursor: z.coerce.number().int().min(0).optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        })
        .parse(request.query);

      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No actor bound to session',
        );
      }

      // Authorize: must be an active member.
      const [member] = await db
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, params.conversationId),
            eq(conversationMembers.actorId, actorId),
          ),
        )
        .limit(1);
      if (!member || member.status !== 'active') {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Not a member of this conversation',
        );
      }

      const where = q.cursor !== undefined
        ? and(
            eq(messages.conversationId, params.conversationId),
            gte(messages.sequence, q.cursor),
          )
        : eq(messages.conversationId, params.conversationId);

      const rows = await db
        .select()
        .from(messages)
        .where(where)
        .orderBy(asc(messages.sequence))
        .limit(q.limit);
      return { items: rows };
    },
  );

  /**
   * Close the current burst for the sender in this conversation. The
   * attention worker will pick up `message_burst_closed` events and
   * produce independent decisions for eligible actors.
   */
  app.post(
    '/v1/conversations/:conversationId/bursts/close',
    { preHandler: requireAuth },
    async (request) => {
      const params = z
        .object({ conversationId: z.string().uuid() })
        .parse(request.params);
      const body = z
        .object({
          reason: z.nativeEnum(BurstClosedReason).default('manual'),
        })
        .parse(request.body ?? {});

      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No actor bound to session',
        );
      }

      const closed = await db.transaction(async (tx) => {
        const [open] = await tx
          .select()
          .from(messageBursts)
          .where(
            and(
              eq(messageBursts.conversationId, params.conversationId),
              eq(messageBursts.senderActorId, actorId),
              sql`${messageBursts.closedAt} IS NULL`,
            ),
          )
          .orderBy(sql`${messageBursts.openedAt} DESC`)
          .limit(1);
        if (!open) return null;
        await tx
          .update(messageBursts)
          .set({ closedAt: new Date(), closedReason: body.reason })
          .where(eq(messageBursts.id, open.id));
        return open;
      });

      if (closed) {
        try {
          await db.insert(worldEvents).values({
            id: newId<string>(),
            socialGraphId: '00000000-0000-0000-0000-000000000001',
            type: 'message_burst_closed',
            actorId,
            subjectActorIds: [actorId],
            conversationId: params.conversationId,
            payload: { burstId: closed.id, reason: body.reason },
            visibilityPolicy: { conversation: params.conversationId },
            idempotencyKey: `burst_closed:${closed.id}`,
          });
        } catch {
          /* events are best-effort */
        }
      }

      return { closed: closed?.id ?? null };
    },
  );
}

async function openOrExtendBurst(
  tx: Parameters<Parameters<Database['transaction']>[0]>[0],
  conversationId: string,
  senderActorId: string,
  sequence: number,
): Promise<string> {
  const [open] = await tx
    .select()
    .from(messageBursts)
    .where(
      and(
        eq(messageBursts.conversationId, conversationId),
        eq(messageBursts.senderActorId, senderActorId),
        sql`${messageBursts.closedAt} IS NULL`,
      ),
    )
    .orderBy(sql`${messageBursts.openedAt} DESC`)
    .limit(1);
  if (open) {
    await tx
      .update(messageBursts)
      .set({ lastMessageSequence: sequence })
      .where(eq(messageBursts.id, open.id));
    return open.id;
  }
  const id = newId<string>();
  await tx.insert(messageBursts).values({
    id,
    conversationId,
    senderActorId,
    firstMessageSequence: sequence,
    lastMessageSequence: sequence,
    openedAt: new Date(),
  });
  return id;
}