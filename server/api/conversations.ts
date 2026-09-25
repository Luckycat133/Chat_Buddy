import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, ne, or } from 'drizzle-orm';
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
import { newId } from '../../shared/contracts/ids.js';
import { findRelationship } from './social.js';
import {
  ConversationType,
  ConversationMemberStatus,
  InvitationStatus,
} from '../../shared/contracts/enums.js';

/**
 * Conversations endpoints per WEB_IMPLEMENTATION §17 + DOMAIN_ARCHITECTURE §4.11.
 *
 * Authorization invariants:
 *   - GET /v1/conversations: only returns conversations the actor is a member of.
 *   - POST /v1/conversations: human actor may create; AIs cannot self-create.
 *   - POST /v1/conversations/:id/invitations: only `active` members of group can invite.
 *   - Hidden AI direct conversations never appear in human listings.
 */
export function registerConversationRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/conversations',
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
        .select({
          id: conversations.id,
          type: conversations.type,
          publicName: conversations.publicName,
          avatarAssetId: conversations.avatarAssetId,
          createdAt: conversations.createdAt,
          lastReadSequence: conversationMembers.lastReadSequence,
          memberStatus: conversationMembers.status,
        })
        .from(conversationMembers)
        .innerJoin(
          conversations,
          eq(conversationMembers.conversationId, conversations.id),
        )
        .where(
          and(
            eq(conversationMembers.actorId, actorId),
            inArray(conversationMembers.status, [
              ConversationMemberStatus.Active,
              ConversationMemberStatus.Invited,
            ]),
            // Hidden AI conversations are not enumerable by humans.
            ne(conversations.type, 'hidden_ai_direct'),
          ),
        )
        .orderBy(desc(conversations.createdAt))
        .limit(200);

      // Post-filter: drop hidden_ai_direct.
      const visible = rows.filter((r) => r.type !== 'hidden_ai_direct');
      return { items: visible };
    },
  );

  app.post(
    '/v1/conversations',
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No actor bound to session',
        );
      }
      const body = z
        .object({
          type: z.enum(['direct', 'group']),
          publicName: z.string().min(1).max(120).optional(),
          inviteeActorIds: z.array(z.string().uuid()).min(1).max(64),
        })
        .parse(request.body);

      const id = newId<string>();
      const graphId = (await actorGraph(db, actorId)) ?? defaultGraphId();

      // Block state outranks every invitation path: a blocked actor can
      // neither be invited into a conversation nor DM the blocker.
      const relationships = new Map<
        string,
        Awaited<ReturnType<typeof findRelationship>>
      >();
      for (const inviteeId of body.inviteeActorIds) {
        if (inviteeId === actorId) continue;
        const rel = await findRelationship(db, actorId, inviteeId);
        relationships.set(inviteeId, rel);
        if (rel?.state === 'blocked') {
          throw new ApiError(
            ApiErrorCodes.ActorBlocked,
            'Contact is blocked',
          );
        }
      }

      await db.transaction(async (tx) => {
        await tx.insert(conversations).values({
          id,
          socialGraphId: graphId,
          type: body.type,
          publicName: body.publicName ?? null,
          createdByActorId: actorId,
        });
        await tx.insert(conversationMembers).values({
          conversationId: id,
          actorId,
          status: 'active',
          role: 'moderator',
          joinedAt: new Date(),
        });
        for (const inviteeId of body.inviteeActorIds) {
          if (inviteeId === actorId) continue;
          const relState = relationships.get(inviteeId)?.state;
          // Accepted friends join a direct conversation immediately (both
          // members active, no invitation hop); everyone else goes through
          // the invitation-confirm path.
          const autoActive = body.type === 'direct' && relState === 'accepted';
          await tx.insert(conversationMembers).values({
            conversationId: id,
            actorId: inviteeId,
            status: autoActive ? 'active' : 'invited',
            role: 'member',
            ...(autoActive ? { joinedAt: new Date() } : {}),
            invitedByActorId: actorId,
          });
          if (!autoActive) {
            await tx.insert(groupInvitations).values({
              id: newId<string>(),
              conversationId: id,
              inviterActorId: actorId,
              inviteeActorId: inviteeId,
              visibleMemberSnapshot: [actorId, ...body.inviteeActorIds],
              purpose: body.publicName ?? 'group chat',
              status: 'pending',
            });
          }
        }
        await tx.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: graphId,
          type: 'group_proposed',
          actorId,
          subjectActorIds: body.inviteeActorIds,
          conversationId: id,
          payload: { type: body.type, publicName: body.publicName ?? null },
          visibilityPolicy: { invited: body.inviteeActorIds },
          idempotencyKey: `group_proposed:${id}`,
        });
      });

      reply.code(201);
      return { id };
    },
  );
}

async function actorGraph(
  db: Database,
  actorId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ socialGraphId: actors.socialGraphId })
    .from(actors)
    .where(eq(actors.id, actorId))
    .limit(1);
  return row?.socialGraphId ?? null;
}

const FALLBACK_GRAPH_ID = '00000000-0000-0000-0000-000000000001';
function defaultGraphId(): string {
  return FALLBACK_GRAPH_ID;
}

// Keep unused-import noise low for strict linters without breaking types.
void ConversationType;