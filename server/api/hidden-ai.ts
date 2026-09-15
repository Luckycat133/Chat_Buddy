/**
 * Hidden AI conversation endpoints per DOMAIN_ARCHITECTURE §8.3.
 *
 * - Human endpoints never return these conversations.
 * - Only participating characters and authorized audit roles can read.
 * - The human API does not include message content or opaque identifiers
 *   that enable enumeration.
 *
 * Stub endpoints:
 *   GET /v1/hidden-ai/messages?with=<characterActorId>
 *     Returns the caller's own hidden direct messages with that character.
 *     The "asking" human character in such conversations is the AI actor
 *     itself; humans cannot address these messages through normal endpoints.
 */
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  conversationMembers,
  conversations,
  messages,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';

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

      // Find a hidden conversation where both characters are members.
      const candidateConvos = await db
        .select({
          conversationId: conversationMembers.conversationId,
          actorId: conversationMembers.actorId,
          type: conversations.type,
        })
        .from(conversationMembers)
        .innerJoin(
          conversations,
          eq(conversationMembers.conversationId, conversations.id),
        )
        .where(eq(conversationMembers.actorId, actorId));
      const hidden = candidateConvos.find(
        (c) => c.type === 'hidden_ai_direct',
      );
      if (!hidden) return { items: [] };

      // Authorize: caller must be a participant.
      const memberRows = await db
        .select({ actorId: conversationMembers.actorId })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, hidden.conversationId),
            eq(conversationMembers.actorId, q.with),
          ),
        );
      if (memberRows.length === 0) {
        return { items: [] };
      }
      if (actorId !== q.with) {
        // Caller is one participant; verify the other side matches `with`.
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Not a participant in the requested hidden conversation',
        );
      }

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, hidden.conversationId))
        .limit(200);
      return { items: rows };
    },
  );
}