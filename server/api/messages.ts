import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  conversations,
  conversationMembers,
  messageBursts,
  messages,
  worldEvents,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import {
  appendConversationMessage,
  findMessageByKey,
  latestOpenBurst,
  withConversationWrite,
} from '../services/conversation-writes.js';
import {
  BurstClosedReason,
  MessageKind,
} from '../../shared/contracts/enums.js';

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
          clientIdempotencyKey: z
            .string()
            .min(8)
            .max(128)
            .refine((v) => !v.includes('\u0000'), {
              message: 'clientIdempotencyKey must not contain NUL characters',
            }),
          kind: z.nativeEnum(MessageKind).default('text'),
          content: z
            .string()
            .min(1)
            .max(32_000)
            // H2 fix: Postgres `text` cannot store NUL bytes; letting one
            // through surfaces as a 500 from the driver. Reject at the
            // input layer with 422 so the client can resend clean content.
            .refine((v) => !v.includes('\u0000'), {
              message: 'content must not contain NUL (\\u0000) characters',
            }),
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

      const result = await withConversationWrite(db, params.conversationId, async (tx, conversation) => {
        if (!conversation || conversation.status !== 'active') {
          throw new ApiError(ApiErrorCodes.NotFound, 'Conversation not found');
        }
        if (conversation.type === 'hidden_ai_direct') {
          throw new ApiError(ApiErrorCodes.Forbidden, 'Hidden AI conversation is not human-writable');
        }
        const [membership] = await tx.select().from(conversationMembers).where(and(
          eq(conversationMembers.conversationId, conversation.id),
          eq(conversationMembers.actorId, actorId),
          eq(conversationMembers.status, 'active'),
        ));
        if (!membership) {
          throw new ApiError(ApiErrorCodes.Forbidden, 'Sender is not an active member');
        }

        const existing = await findMessageByKey(tx, conversation.id, body.clientIdempotencyKey);
        if (existing) {
          if (existing.senderActorId !== actorId) {
            throw new ApiError(ApiErrorCodes.Conflict, 'Message key already used by another sender');
          }
          return existing;
        }
        return appendConversationMessage(tx, conversation, {
          senderActorId: actorId,
          clientIdempotencyKey: body.clientIdempotencyKey,
          kind: body.kind,
          content: body.content,
          replyToMessageId: body.replyToMessageId ?? null,
        }, { openBurst: true });
      });

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

      // Check conversation visibility and membership in the same statement
      // as the history read, so deletion cannot race the authorization check.
      const visibility = and(eq(conversations.id, params.conversationId),
        eq(conversations.status, 'active'), eq(conversationMembers.actorId, actorId),
        eq(conversationMembers.status, 'active'));
      const list = await db.select({ message: messages }).from(conversations)
        .innerJoin(conversationMembers, eq(conversationMembers.conversationId, conversations.id))
        .innerJoin(messages, eq(messages.conversationId, conversations.id))
        .where(and(visibility, isNull(messages.deletedAt), q.cursor === undefined ? undefined : gte(messages.sequence, q.cursor)))
        .orderBy(asc(messages.sequence)).limit(q.limit);
      if (!list.length) {
        const [visible] = await db.select({ id: conversations.id }).from(conversations)
          .innerJoin(conversationMembers, eq(conversationMembers.conversationId, conversations.id))
          .where(visibility).limit(1);
        if (!visible) throw new ApiError(ApiErrorCodes.Forbidden, 'Conversation unavailable');
      }
      const rows = list.map(row => row.message);
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

      const closed = await withConversationWrite(db, params.conversationId, async (tx, conversation) => {
        if (!conversation || conversation.status !== 'active' || conversation.type === 'hidden_ai_direct') return null;
        const [membership] = await tx.select().from(conversationMembers).where(and(
          eq(conversationMembers.conversationId, conversation.id),
          eq(conversationMembers.actorId, actorId),
          eq(conversationMembers.status, 'active'),
        ));
        if (!membership) return null;

        const open = await latestOpenBurst(tx, conversation.id, actorId);
        if (!open) return null;
        await tx.update(messageBursts).set({ closedAt: new Date(), closedReason: body.reason })
          .where(eq(messageBursts.id, open.id));
        await tx.insert(worldEvents).values({
          socialGraphId: conversation.socialGraphId,
          type: 'message_burst_closed',
          actorId,
          subjectActorIds: [actorId],
          conversationId: conversation.id,
          payload: { burstId: open.id, reason: body.reason },
          visibilityPolicy: { conversation: conversation.id },
          idempotencyKey: `burst_closed:${open.id}`,
        });
        return open.id;
      });
      return { closed };
    },
  );
}
