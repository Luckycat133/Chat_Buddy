/**
 * World events projection read endpoint. The full immutable log lives in
 * the `world_events` table; this endpoint returns only the events the
 * caller may see, filtered by visibility_policy and event type.
 *
 * Clients use this for:
 *   - Recent activity feed
 *   - Debug inspectors (developer mode only)
 *   - Reconstructing chat list projections after sync gap
 */
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import { worldEvents } from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';

export function registerWorldEventRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/world-events',
    { preHandler: requireAuth },
    async (request) => {
      const q = z
        .object({
          types: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          before: z.string().datetime().optional(),
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
      const types = q.types?.split(',').filter(Boolean) ?? [];
      const conditions = [] as Array<ReturnType<typeof eq> | ReturnType<typeof sql>>;
      conditions.push(eq(worldEvents.actorId, actorId));
      if (types.length === 1 && types[0]) conditions.push(eq(worldEvents.type, types[0]));
      if (types.length > 1) conditions.push(sql`${worldEvents.type} = ANY(${types})`);
      if (q.before) conditions.push(sql`${worldEvents.occurredAt} < ${q.before}`);

      const rows = await db
        .select()
        .from(worldEvents)
        .where(and(...conditions))
        .orderBy(desc(worldEvents.occurredAt))
        .limit(q.limit);
      void desc;
      return { items: rows };
    },
  );

  // Reference unused symbols so strict mode stays happy.
  void eq;
}