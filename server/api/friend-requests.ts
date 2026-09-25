import type { FastifyInstance } from 'fastify';
import { and, desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  actors,
  friendRequests,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import { actorGraphId } from '../services/graph.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * Friend request endpoints per DEMO_EXPERIENCE §6 + DOMAIN_ARCHITECTURE §4.10.
 *
 * Either human or character may send; either side may accept/decline.
 * Decisions for AI recipients are normally produced by the runtime; this
 * endpoint is for UI-driven accept/decline by humans and for AI runtimes
 * that call back with a decision.
 */
export function registerFriendRequestRoutes(app: FastifyInstance): void {
  app.post(
    '/v1/friend-requests',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = z
        .object({
          recipientActorId: z.string().uuid(),
          note: z.string().max(800).optional(),
          introductionEventId: z.string().uuid().optional(),
        })
        .parse(request.body);
      const db = request.server.db as Database;
      const senderId = request.requestContext.actorId;
      if (!senderId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No actor bound to session',
        );
      }
      if (senderId === body.recipientActorId) {
        throw new ApiError(
          ApiErrorCodes.ValidationFailed,
          'Cannot send a friend request to yourself',
        );
      }

      // A blocked relationship refuses contact in either direction.
      const [blockedRel] = await db
        .select({ id: relationships.id })
        .from(relationships)
        .where(
          and(
            or(
              and(
                eq(relationships.actorAId, senderId),
                eq(relationships.actorBId, body.recipientActorId),
              ),
              and(
                eq(relationships.actorAId, body.recipientActorId),
                eq(relationships.actorBId, senderId),
              ),
            ),
            eq(relationships.state, 'blocked'),
          ),
        )
        .limit(1);
      if (blockedRel) {
        throw new ApiError(
          ApiErrorCodes.ActorBlocked,
          'A blocked relationship prevents contact',
        );
      }

      // Reject if a non-terminal request already exists in either direction.
      const existing = await db
        .select({ id: friendRequests.id })
        .from(friendRequests)
        .where(
          or(
            and(
              eq(friendRequests.senderActorId, senderId),
              eq(friendRequests.recipientActorId, body.recipientActorId),
            ),
            and(
              eq(friendRequests.senderActorId, body.recipientActorId),
              eq(friendRequests.recipientActorId, senderId),
            ),
          ),
        )
        .orderBy(desc(friendRequests.createdAt))
        .limit(1);
      if (existing.length > 0) {
        const row = existing[0];
        if (!row) {
          throw new ApiError(
            ApiErrorCodes.Internal,
            'Existing friend request row missing',
          );
        }
        reply.code(200);
        return { id: row.id, deduped: true };
      }

      const id = newId<string>();
      const graphId = await actorGraphId(db, senderId);
      await db.transaction(async (tx) => {
        await tx.insert(friendRequests).values({
          id,
          senderActorId: senderId,
          recipientActorId: body.recipientActorId,
          note: body.note ?? null,
          introductionEventId: body.introductionEventId ?? null,
          status: 'pending',
        });
        await tx.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: graphId,
          type: 'friendship_requested',
          actorId: senderId,
          subjectActorIds: [body.recipientActorId],
          payload: { requestId: id, note: body.note ?? null },
          visibilityPolicy: {
            sender: senderId,
            recipient: body.recipientActorId,
          },
          idempotencyKey: `friend_requested:${id}`,
        });
      });

      reply.code(201);
      return { id, deduped: false };
    },
  );

  app.post(
    '/v1/friend-requests/:id/decision',
    { preHandler: requireAuth },
    async (request) => {
      const params = z
        .object({ id: z.string().uuid() })
        .parse(request.params);
      const body = z
        .object({
          decision: z.enum(['accepted', 'declined', 'ignored', 'cancelled']),
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

      const [reqRow] = await db
        .select()
        .from(friendRequests)
        .where(eq(friendRequests.id, params.id))
        .limit(1);
      if (!reqRow) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Friend request not found');
      }
      if (reqRow.recipientActorId !== actorId && body.decision !== 'cancelled') {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Only the recipient can accept/decline/ignore',
        );
      }
      if (reqRow.senderActorId !== actorId && body.decision === 'cancelled') {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Only the sender can cancel',
        );
      }
      if (reqRow.status !== 'pending') {
        return { id: reqRow.id, status: reqRow.status, idempotent: true };
      }

      const decidedAt = new Date();
      const graphId = await actorGraphId(db, actorId);
      await db.transaction(async (tx) => {
        await tx
          .update(friendRequests)
          .set({ status: body.decision, decidedAt })
          .where(eq(friendRequests.id, params.id));

        const eventType =
          body.decision === 'accepted'
            ? 'friendship_accepted'
            : body.decision === 'declined' || body.decision === 'cancelled'
              ? 'friendship_declined'
              : null;

        if (body.decision === 'accepted') {
          // Promote to relationship row if not already present.
          const [a, b] = [reqRow.senderActorId, reqRow.recipientActorId].sort();
          const [existingRel] = await tx
            .select({ id: relationships.id })
            .from(relationships)
            .where(
              and(
                eq(relationships.actorAId, a!),
                eq(relationships.actorBId, b!),
              ),
            )
            .limit(1);
          if (!existingRel) {
            await tx.insert(relationships).values({
              id: newId<string>(),
              socialGraphId: graphId,
              actorAId: a!,
              actorBId: b!,
              state: 'accepted',
              initiatedBy: reqRow.senderActorId,
            });
          }
        }

        if (eventType) {
          await tx.insert(worldEvents).values({
            id: newId<string>(),
            socialGraphId: graphId,
            type: eventType,
            actorId,
            subjectActorIds: [
              reqRow.senderActorId,
              reqRow.recipientActorId,
            ],
            payload: { requestId: params.id, decision: body.decision },
            visibilityPolicy: {
              participants: [
                reqRow.senderActorId,
                reqRow.recipientActorId,
              ],
            },
            idempotencyKey: `${eventType}:${params.id}`,
          });
        }
      });

      return { id: params.id, status: body.decision };
    },
  );

  app.get(
    '/v1/friend-requests',
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
      const rows = await db
        .select()
        .from(friendRequests)
        .where(
          or(
            eq(friendRequests.senderActorId, actorId),
            eq(friendRequests.recipientActorId, actorId),
          ),
        )
        .orderBy(desc(friendRequests.createdAt))
        .limit(200);
      return { items: rows };
    },
  );

  // Suppress strict unused-import on `actors` while keeping schema reference.
  void actors;
}