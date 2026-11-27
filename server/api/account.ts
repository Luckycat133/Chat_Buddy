import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  accounts,
  conversations,
  conversationMembers,
  friendRequests,
  memoryItems,
  moments,
  relationships,
} from '../../db/schema.js';
import type { AccountDeletionReceipt } from '../../shared/contracts/account.js';
import { requireAuth, requireBearerToken } from '../auth/middleware.js';
import { requestAccountDeletion } from '../auth/session.js';
import { ApiError, ApiErrorCodes } from '../errors.js';

/**
 * Account data-rights endpoints per WEB_IMPLEMENTATION §20 (legacy import)
 * and DOMAIN_ARCHITECTURE §15 (privacy) and A25 (account deletion).
 *
 * Export returns an idempotent JSON snapshot of the caller's account,
 * actors, conversations, messages, moments, and memories.
 *
 * Delete starts account deletion and revokes access and push delivery.
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
    async (request): Promise<AccountDeletionReceipt> => {
      const token = requireBearerToken(request);
      z
        .object({ confirmation: z.literal('delete my account') })
        .strict()
        .parse(request.body);
      const db = request.server.db as Database;
      const startedAt = await requestAccountDeletion(db, token);
      return { ok: true, status: 'deleting', deletionStartedAt: startedAt.toISOString() };
    },
  );
}
