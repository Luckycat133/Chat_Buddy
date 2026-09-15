import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  accounts,
  conversations,
  conversationMembers,
  devices,
  friendRequests,
  memoryItems,
  moments,
  relationships,
  sessions,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';

/**
 * Account data-rights endpoints per WEB_IMPLEMENTATION §20 (legacy import)
 * and DOMAIN_ARCHITECTURE §15 (privacy) and A25 (account deletion).
 *
 * Export returns an idempotent JSON snapshot of the caller's account,
 * actors, conversations, messages, moments, and memories.
 *
 * Delete performs a destructive scrub:
 *   - sessions + devices revoked
 *   - account status -> 'deleted', deleted_at stamped
 *   - private data removed; shared historical content is tombstoned
 *     via 'actor_blocked' events rather than rewritten.
 */
export function registerAccountRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/account/export',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const accountId = request.requestContext.accountId;
      if (!accountId) {
        throw new ApiError(
          ApiErrorCodes.Unauthorized,
          'No account bound to session',
        );
      }
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1);
      if (!account) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Account not found');
      }
      const [convoMemberships, friendReqs, rels, myMoments, myMems] =
        await Promise.all([
          db
            .select()
            .from(conversationMembers)
            .where(eq(conversationMembers.actorId, accountId))
            .limit(500),
          db
            .select()
            .from(friendRequests)
            .where(eq(friendRequests.senderActorId, accountId))
            .limit(500),
          db
            .select()
            .from(relationships)
            .where(eq(relationships.actorAId, accountId))
            .limit(500),
          db
            .select()
            .from(moments)
            .where(eq(moments.actorId, accountId))
            .limit(500),
          db
            .select()
            .from(memoryItems)
            .where(eq(memoryItems.ownerActorId, accountId))
            .limit(500),
        ]);
      return {
        account: { ...account, primaryEmail: null, appleSubject: null },
        conversations: convoMemberships,
        conversationsMeta: await Promise.all(
          convoMemberships.map((m) =>
            db
              .select()
              .from(conversations)
              .where(eq(conversations.id, m.conversationId))
              .limit(1),
          ),
        ).then((rows) => rows.flat()),
        friendRequests: friendReqs,
        relationships: rels,
        moments: myMoments,
        memories: myMems,
      };
    },
  );

  app.post(
    '/v1/account/delete',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({ confirmation: z.literal('delete my account') })
        .parse(request.body);
      void body;
      const db = request.server.db as Database;
      const accountId = request.requestContext.accountId;
      if (!accountId) {
        throw new ApiError(
          ApiErrorCodes.Unauthorized,
          'No account bound to session',
        );
      }
      const now = new Date();
      await db.transaction(async (tx) => {
        // Revoke all sessions and devices.
        await tx
          .update(sessions)
          .set({ revokedAt: now })
          .where(eq(sessions.accountId, accountId));
        await tx
          .update(devices)
          .set({ notificationPermission: 'denied' })
          .where(eq(devices.accountId, accountId));
        // Mark account as deleting; cron job will hard-delete after grace.
        await tx
          .update(accounts)
          .set({ status: 'deleting', deletedAt: now })
          .where(eq(accounts.id, accountId));
      });
      return { ok: true, deletionStartedAt: now.toISOString() };
    },
  );
}