import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  conversationMembers,
  conversations,
  groupInvitations,
  worldEvents,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { actorGraphId } from '../services/graph.js';
import { newId } from '../../shared/contracts/ids.js';
import { InvitationStatus } from '../../shared/contracts/enums.js';

/**
 * Group invitation endpoints per WEB_IMPLEMENTATION §17 + DOMAIN_ARCHITECTURE §4.13.
 *
 * Decisions can be 'accepted' or 'declined'. On accept, the member row is
 * promoted to `active` and `joined_at` is stamped; on decline, the row
 * moves to `declined` and the world event records the decision code.
 */
export function registerGroupInvitationRoutes(app: FastifyInstance): void {
  app.post(
    '/v1/invitations/:id/decision',
    { preHandler: requireAuth },
    async (request) => {
      const params = z
        .object({ id: z.string().uuid() })
        .parse(request.params);
      const body = z
        .object({
          decision: z.enum(['accepted', 'declined']),
          reasonCode: z.string().max(64).optional(),
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

      const decided = await db.transaction(async (tx) => {
        const [inv] = await tx
          .select()
          .from(groupInvitations)
          .where(eq(groupInvitations.id, params.id))
          .limit(1);
        if (!inv) {
          throw new ApiError(
            ApiErrorCodes.NotFound,
            'Invitation not found',
          );
        }
        if (inv.inviteeActorId !== actorId) {
          throw new ApiError(
            ApiErrorCodes.Forbidden,
            'Only the invitee may decide',
          );
        }
        if (inv.status !== InvitationStatus.Pending) {
          return { id: inv.id, status: inv.status, idempotent: true };
        }

        const newStatus =
          body.decision === 'accepted'
            ? InvitationStatus.Accepted
            : InvitationStatus.Declined;

        await tx
          .update(groupInvitations)
          .set({
            status: newStatus,
            decidedAt: new Date(),
            decisionReasonCode: body.reasonCode ?? null,
          })
          .where(eq(groupInvitations.id, params.id));

        if (body.decision === 'accepted') {
          await tx
            .update(conversationMembers)
            .set({ status: 'active', joinedAt: new Date() })
            .where(
              and(
                eq(conversationMembers.conversationId, inv.conversationId),
                eq(conversationMembers.actorId, actorId),
              ),
            );
        } else {
          await tx
            .update(conversationMembers)
            .set({ status: 'declined' })
            .where(
              and(
                eq(conversationMembers.conversationId, inv.conversationId),
                eq(conversationMembers.actorId, actorId),
              ),
            );
        }

        // A group is "active" once at least the organizer and one invitee accept.
        // We don't try to derive complete membership rules here; runtime
        // visibility is enforced on each read.
        const [conv] = await tx
          .select()
          .from(conversations)
          .where(eq(conversations.id, inv.conversationId))
          .limit(1);
        void conv;

        const eventGraphId = await actorGraphId(db, actorId);
        await tx.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: eventGraphId,
          type: 'group_invitation_decided',
          actorId,
          subjectActorIds: [inv.inviterActorId, actorId],
          conversationId: inv.conversationId,
          payload: {
            invitationId: inv.id,
            decision: body.decision,
            reasonCode: body.reasonCode ?? null,
          },
          visibilityPolicy: { conversation: inv.conversationId },
          idempotencyKey: `invite_decided:${inv.id}:${body.decision}`,
        });

        // Probe: satisfies the strict-typing noUnusedParameters TS hint.
        void sql`1`;

        return { id: inv.id, status: newStatus, idempotent: false };
      });

      return decided;
    },
  );
}