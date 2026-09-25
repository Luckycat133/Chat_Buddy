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
import { actorGraphId } from '../services/graph.js';
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
 *   - Per-conversation sequence allocation is serialized by a transaction-scope
 *     advisory lock (C2 fix): `COALESCE(MAX(sequence),0)+1` is only safe when
 *     concurrent inserts for the same conversation cannot interleave, otherwise
 *     the second tx hits `messages_conv_seq_idx` with a 23505 and the client
 *     sees a 500. Concurrent replays of the same idempotency key must all
 *     return the same message id, never a 500.
 */

/** Postgres unique-violation code. */
const PG_UNIQUE_VIOLATION = '23505';
/** Upper bound for sequence-collision retries under contention. */
const MAX_INSERT_ATTEMPTS = 5;

interface PgErrorShape {
  code?: string;
  constraint?: string;
  constraint_name?: string;
  message?: string;
  cause?: unknown;
}

/** Drizzle wraps driver errors, so walk the `cause` chain to find 23505. */
function findUniqueViolation(err: unknown): PgErrorShape | null {
  let cur = err as PgErrorShape | null | undefined;
  for (let depth = 0; cur && depth < 5; depth++) {
    if (cur.code === PG_UNIQUE_VIOLATION) return cur;
    cur = cur.cause as PgErrorShape | null | undefined;
  }
  return null;
}

function uniqueViolationOn(err: unknown, constraint: string): boolean {
  const pg = findUniqueViolation(err);
  if (!pg) return false;
  return (
    pg.constraint === constraint ||
    pg.constraint_name === constraint ||
    (pg.message ?? '').includes(constraint)
  );
}

/**
 * Stable bigint advisory-lock key for a conversation. Hashes the UUID to
 * a signed 63-bit integer so `pg_advisory_xact_lock` serializes all message
 * inserts for one conversation without colliding with unrelated locks in
 * any observable way (rare hash collisions only add serialization, never
 * incorrectness).
 */
export function conversationAdvisoryKey(conversationId: string): string {
  const hex = conversationId.replace(/-/g, '');
  const value = BigInt(`0x${hex}`);
  return (value & ((1n << 63n) - 1n)).toString();
}

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

      // C2 fix: bounded retry + DB-side atomic allocation. Concurrent
      // same-key writers serialize on the per-conversation advisory lock and
      // observe the committed row via idempotent replay (same id, 201).
      // Sequence collisions are still caught defensively (23505 on
      // messages_conv_seq_idx) and retried with a freshly computed sequence.
      const result = await insertMessageWithRetry(db, {
        conversationId: params.conversationId,
        actorId,
        clientIdempotencyKey: body.clientIdempotencyKey,
        kind: body.kind,
        content: body.content,
        replyToMessageId: body.replyToMessageId ?? null,
      });

      // Fire-and-forget event for projections; failure must not block response.
      try {
        const eventGraphId = await actorGraphId(db, actorId);
        await db.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: eventGraphId,
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
          const eventGraphId2 = await actorGraphId(db, actorId);
          await db.insert(worldEvents).values({
            id: newId<string>(),
            socialGraphId: eventGraphId2,
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

interface InsertMessageInput {
  conversationId: string;
  actorId: string;
  clientIdempotencyKey: string;
  kind: MessageKind;
  content: string;
  replyToMessageId: string | null;
}

async function insertMessageWithRetry(
  db: Database,
  input: InsertMessageInput,
): Promise<typeof messages.$inferSelect> {
  let lastConflictErr: unknown;
  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        // Serialize sequence allocation per conversation (DB-side atomic
        // allocation: the lock is held until this transaction commits).
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${conversationAdvisoryKey(input.conversationId)})`,
        );

        // Idempotency replay: if same (conversation, key) exists, return it.
        const [existing] = await tx
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, input.conversationId),
              eq(messages.clientIdempotencyKey, input.clientIdempotencyKey),
            ),
          )
          .limit(1);
        if (existing) return existing;

        const [seqRow] = await tx
          .select({ next: sql<number>`COALESCE(MAX(${messages.sequence}), 0) + 1` })
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId));
        const sequence = seqRow?.next ?? 1;

        const burstId = await openOrExtendBurst(
          tx,
          input.conversationId,
          input.actorId,
          sequence,
        );

        const id = newId<string>();
        const [row] = await tx
          .insert(messages)
          .values({
            id,
            conversationId: input.conversationId,
            senderActorId: input.actorId,
            sequence,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: input.kind,
            content: input.content,
            replyToMessageId: input.replyToMessageId,
            burstId,
            status: MessageStatus.Accepted,
          })
          .returning();
        return row!;
      });
    } catch (err) {
      if (uniqueViolationOn(err, 'messages_idempotency_idx')) {
        // A concurrent writer committed this exact idempotency key between
        // our snapshot and the insert (or the advisory lock was bypassed by
        // a non-locking writer): replay the committed row so the client
        // gets the same id instead of a 500.
        const [existing] = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, input.conversationId),
              eq(messages.clientIdempotencyKey, input.clientIdempotencyKey),
            ),
          )
          .limit(1);
        if (existing) return existing;
        lastConflictErr = err;
        continue;
      }
      if (uniqueViolationOn(err, 'messages_conv_seq_idx')) {
        // Lost the sequence race (defensive: the advisory lock already
        // prevents this among message inserts). Recompute and retry.
        lastConflictErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastConflictErr ?? new Error('message insert failed after retries');
}