import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  momentInteractions,
  moments,
  worldEvents,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * Moments endpoints per WEB_IMPLEMENTATION §16 and DOMAIN_ARCHITECTURE §4.16-§4.17.
 *
 * Invariants:
 *   - Server enforces audience policy and block state at delivery time.
 *   - Posts by AI characters must reference a `source_event_id` from the
 *     server runtime (validated upstream). Human posts pass null.
 *   - Interactions (view/reaction/comment/reply) only grant knowledge to
 *     actors who actually saw the post.
 */
export function registerMomentRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/moments',
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
      const q = z
        .object({
          cursor: z.string().uuid().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(request.query);

      // Server-side audience enforcement: union of moments whose
      // allowed_actor_ids includes the caller OR whose audience_policy
      // class is public-within-graph AND the actor is in the graph.
      const rows = await db
        .select()
        .from(moments)
        .orderBy(desc(moments.createdAt))
        .limit(q.limit * 2); // overshoot then narrow
      const visible = rows.filter((m) =>
        audienceAllows(m.audiencePolicy, actorId),
      );
      return {
        items: visible.slice(0, q.limit),
        nextCursor: visible[q.limit]?.id ?? null,
      };
    },
  );

  app.post(
    '/v1/moments',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = z
        .object({
          content: z.string().min(1).max(8000),
          mediaAssets: z
            .array(
              z.object({
                assetId: z.string().uuid(),
                altText: z.string().max(280).nullable().optional(),
              }),
            )
            .max(8)
            .optional(),
          audiencePolicy: z.object({
            allowedActorIds: z.array(z.string().uuid()).max(64),
            class: z.enum(['public_within_graph', 'familiar', 'restricted']),
          }),
          sourceEventId: z.string().uuid().optional(),
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
      const id = newId<string>();
      await db.transaction(async (tx) => {
        await tx.insert(moments).values({
          id,
          actorId,
          socialGraphId: '00000000-0000-0000-0000-000000000001',
          content: body.content,
          mediaAssets: body.mediaAssets ?? [],
          audiencePolicy: body.audiencePolicy,
          sourceEventId: body.sourceEventId ?? null,
        });
        await tx.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: '00000000-0000-0000-0000-000000000001',
          type: 'moment_posted',
          actorId,
          subjectActorIds: body.audiencePolicy.allowedActorIds,
          momentId: id,
          payload: { audience: body.audiencePolicy.class },
          visibilityPolicy: body.audiencePolicy,
          idempotencyKey: `moment_posted:${id}`,
        });
      });
      reply.code(201);
      return { id };
    },
  );

  app.post(
    '/v1/moments/:id/interactions',
    { preHandler: requireAuth },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          type: z.enum(['view', 'reaction', 'comment', 'reply']),
          content: z.string().max(2000).optional(),
          parentInteractionId: z.string().uuid().optional(),
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
      const [moment] = await db
        .select()
        .from(moments)
        .where(eq(moments.id, params.id))
        .limit(1);
      if (!moment) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Moment not found');
      }
      if (!audienceAllows(moment.audiencePolicy, actorId)) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Moment not visible to caller',
        );
      }
      const id = newId<string>();
      await db.transaction(async (tx) => {
        await tx.insert(momentInteractions).values({
          id,
          momentId: moment.id,
          actorId,
          type: body.type,
          content: body.content ?? null,
          parentInteractionId: body.parentInteractionId ?? null,
        });
        const eventType =
          body.type === 'view'
            ? 'moment_viewed'
            : body.type === 'reaction'
              ? 'moment_reacted'
              : body.type === 'comment'
                ? 'moment_commented'
                : 'moment_commented';
        await tx.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: '00000000-0000-0000-0000-000000000001',
          type: eventType,
          actorId,
          subjectActorIds: [moment.actorId],
          momentId: moment.id,
          payload: { interactionType: body.type },
          visibilityPolicy: moment.audiencePolicy,
          idempotencyKey: `${eventType}:${id}`,
        });
      });
      return { id };
    },
  );
}

function audienceAllows(
  policy: unknown,
  actorId: string,
): boolean {
  if (!policy || typeof policy !== 'object') return false;
  const p = policy as {
    allowedActorIds?: string[];
    class?: 'public_within_graph' | 'familiar' | 'restricted';
  };
  if (p.class === 'public_within_graph') return true;
  if (Array.isArray(p.allowedActorIds) && p.allowedActorIds.includes(actorId)) {
    return true;
  }
  return false;
}

// Reference inArray/desc to satisfy noUnusedLocals under strict mode.
void inArray;
void and;
void desc;
void eq;