import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  actors,
  conversationMembers,
  conversations,
  groupInvitations,
  worldEvents,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { ensureSameTemplateIdentityLink } from './social.js';
import { newId } from '../../shared/contracts/ids.js';
import { InvitationStatus } from '../../shared/contracts/enums.js';

/**
 * Group invitation endpoints per WEB_IMPLEMENTATION §17 + DOMAIN_ARCHITECTURE §4.13.
 *
 * Decisions can be 'accepted' or 'declined'. On accept, the member row is
 * promoted to `active` and `joined_at` is stamped; on decline, the row
 * moves to `declined` and the world event records the decision code.
 *
 * Same-template identity resolution: once a group holds two active
 * character actors instantiated from the same template, an active identity
 * link is ensured (deterministic canonical = earliest-created actor) so
 * public projections show one identity. Private relationships are never
 * copied or merged by the link.
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
          return {
            id: inv.id,
            status: inv.status,
            idempotent: true,
            conversationId: inv.conversationId,
          };
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

        // Resolve inside the transaction: PGlite serializes a single
        // connection, so touching the outer `db` here would deadlock
        // against the open decision transaction.
        const [eventActor] = await tx
          .select({ socialGraphId: actors.socialGraphId })
          .from(actors)
          .where(eq(actors.id, actorId))
          .limit(1);
        if (!eventActor) {
          throw new ApiError(ApiErrorCodes.Forbidden, 'Actor not found');
        }
        const eventGraphId = eventActor.socialGraphId;
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

        return {
          id: inv.id,
          status: newStatus,
          idempotent: false,
          conversationId: inv.conversationId,
        };
      });

      // Identity resolution runs after the decision commits so its own
      // transaction never nests inside the decision tx.
      if (body.decision === 'accepted') {
        await linkSameTemplateGroupMembers(db, decided.conversationId);
      }

      return decided;
    },
  );
}

/**
 * After an acceptance, ensure identity links for every active same-template
 * character pair in the group. Idempotent; runs outside the decision
 * transaction so its own tx never nests.
 */
async function linkSameTemplateGroupMembers(
  db: Database,
  conversationId: string,
): Promise<void> {
  const [conv] = await db
    .select({ id: conversations.id, socialGraphId: conversations.socialGraphId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return;

  const members = await db
    .select({
      actorId: conversationMembers.actorId,
      type: actors.type,
      templateId: actors.templateId,
    })
    .from(conversationMembers)
    .innerJoin(actors, eq(actors.id, conversationMembers.actorId))
    .where(
      and(
        eq(conversationMembers.conversationId, conv.id),
        eq(conversationMembers.status, 'active'),
      ),
    );

  const characters = members.filter((m) => m.type === 'character' && m.templateId);
  for (let i = 0; i < characters.length; i += 1) {
    for (let j = i + 1; j < characters.length; j += 1) {
      const a = characters[i]!;
      const b = characters[j]!;
      if (a.templateId !== b.templateId) continue;
      await ensureSameTemplateIdentityLink(
        db,
        conv.socialGraphId,
        a.actorId,
        b.actorId,
      );
    }
  }
}