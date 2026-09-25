/**
 * Hidden AI conversation endpoints per DOMAIN_ARCHITECTURE §8.3.
 *
 * - Human endpoints never return these conversations.
 * - Only participating characters can read; the reader authorizes by
 *   membership in the hidden conversation shared with the requested peer.
 * - The audit endpoint is administrative: it is authorized exclusively by
 *   the server-side audit token (never by a user session) and is
 *   hard-disabled when no audit token is configured.
 */
import type { FastifyInstance } from 'fastify';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  conversations,
  messages,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { serverEnv } from '../config.js';

/**
 * A "hidden AI direct" conversation has exactly two members, both
 * characters. Humans never appear as members; their involvement is
 * indirect (they are the subject of conversations but never listed).
 */
export function registerHiddenAiRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/hidden-ai/messages',
    { preHandler: requireAuth },
    async (request) => {
      const q = z
        .object({ with: z.string().uuid() })
        .parse(request.query);
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No actor bound to session',
        );
      }

      // Membership-authorized read: the caller and the requested peer must
      // both be members of the same hidden_ai_direct conversation. Humans
      // are never members, so they are rejected by the same predicate.
      const memberOf = (actor: string) =>
        sql`EXISTS (
          SELECT 1 FROM conversation_members cm
          WHERE cm.conversation_id = ${conversations.id}
            AND cm.actor_id = ${actor}::uuid
        )`;
      const [hidden] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          sql`${conversations.type} = 'hidden_ai_direct'
            AND ${memberOf(actorId)}
            AND ${memberOf(q.with)}`,
        )
        .limit(1);
      if (!hidden) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Not a participant in the requested hidden conversation',
        );
      }

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, hidden.id))
        .orderBy(asc(messages.sequence))
        .limit(200);
      return { items: rows };
    },
  );

  /**
   * Administrative audit read. Authorization ladder:
   *   - no SERVER_AUDIT_TOKEN configured → hard-disabled (403 always);
   *   - missing x-audit-token header → 401;
   *   - wrong token → 403;
   *   - correct token → the hidden messages.
   * A user session (any bearer token) never grants audit access.
   */
  app.get(
    '/v1/audit/hidden-ai-conversations/:id/messages',
    async (request) => {
      const params = z
        .object({ id: z.string().uuid() })
        .parse(request.params);
      const env = serverEnv();
      if (!env.SERVER_AUDIT_TOKEN) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Audit endpoint is disabled (no audit token configured)',
        );
      }
      const header = request.headers['x-audit-token'];
      if (typeof header !== 'string' || header.length === 0) {
        throw new ApiError(
          ApiErrorCodes.Unauthorized,
          'Missing audit token',
        );
      }
      if (header !== env.SERVER_AUDIT_TOKEN) {
        throw new ApiError(ApiErrorCodes.Forbidden, 'Invalid audit token');
      }

      const db = request.server.db as Database;
      const [conversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          sql`${conversations.id} = ${params.id}::uuid
            AND ${conversations.type} = 'hidden_ai_direct'`,
        )
        .limit(1);
      if (!conversation) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Conversation not found');
      }

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(asc(messages.sequence))
        .limit(500);
      return { items: rows };
    },
  );
}
