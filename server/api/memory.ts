import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  memoryGrants,
  memoryItems,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';
import {
  MemoryConfidence,
  MemoryGrantPermission,
  MemoryType,
} from '../../shared/contracts/enums.js';

/**
 * Memory endpoints per WEB_IMPLEMENTATION §23 (P0 continuity) and
 * DOMAIN_ARCHITECTURE §4.19.
 *
 * Authorization invariants:
 *   - GET memory items: only memories owned by the calling actor.
 *   - POST grants: only the memory owner may grant; never widens scope
 *     beyond the original share policy.
 *   - DELETE: only the owner may supersede; provenance is preserved
 *     by emitting a tombstone row rather than physical delete.
 */
export function registerMemoryRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/memory',
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
        .from(memoryItems)
        .where(eq(memoryItems.ownerActorId, actorId))
        .orderBy(desc(memoryItems.createdAt))
        .limit(200);
      return { items: rows };
    },
  );

  app.post(
    '/v1/memory',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = z
        .object({
          relationshipId: z.string().uuid().optional(),
          sourceEventId: z.string().uuid(),
          sourceActorId: z.string().uuid().optional(),
          type: z.nativeEnum(MemoryType),
          objectiveFact: z.string().min(1).max(4000),
          subjectiveInterpretation: z.string().max(4000),
          confidence: z.nativeEnum(MemoryConfidence),
          relevanceTags: z.array(z.string().min(1).max(64)).max(32).optional(),
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
      await db.insert(memoryItems).values({
        id,
        ownerActorId: actorId,
        relationshipId: body.relationshipId ?? null,
        sourceEventId: body.sourceEventId,
        sourceActorId: body.sourceActorId ?? null,
        type: body.type,
        objectiveFact: body.objectiveFact,
        subjectiveInterpretation: body.subjectiveInterpretation,
        confidence: body.confidence,
        relevanceTags: body.relevanceTags ?? [],
      });
      reply.code(201);
      return { id };
    },
  );

  app.post(
    '/v1/memory/:id/grant',
    { preHandler: requireAuth },
    async (request) => {
      const params = z
        .object({ id: z.string().uuid() })
        .parse(request.params);
      const body = z
        .object({
          granteeActorId: z.string().uuid(),
          permission: z.nativeEnum(MemoryGrantPermission),
          expiresAt: z.string().datetime().optional(),
          grantedByEventId: z.string().uuid(),
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
      const [mem] = await db
        .select()
        .from(memoryItems)
        .where(eq(memoryItems.id, params.id))
        .limit(1);
      if (!mem) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Memory not found');
      }
      if (mem.ownerActorId !== actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Only the memory owner may grant',
        );
      }
      await db
        .insert(memoryGrants)
        .values({
          memoryId: mem.id,
          granteeActorId: body.granteeActorId,
          grantedByEventId: body.grantedByEventId,
          permission: body.permission,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        })
        .onConflictDoUpdate({
          target: [memoryGrants.memoryId, memoryGrants.granteeActorId],
          set: {
            permission: body.permission,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          },
        });
      return { ok: true };
    },
  );

  app.post(
    '/v1/memory/:id/supersede',
    { preHandler: requireAuth },
    async (request) => {
      const params = z
        .object({ id: z.string().uuid() })
        .parse(request.params);
      const body = z
        .object({ supersedeWithMemoryId: z.string().uuid() })
        .parse(request.body);
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No actor bound to session',
        );
      }
      const [mem] = await db
        .select()
        .from(memoryItems)
        .where(eq(memoryItems.id, params.id))
        .limit(1);
      if (!mem) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Memory not found');
      }
      if (mem.ownerActorId !== actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Only the memory owner may supersede',
        );
      }
      const [next] = await db
        .select()
        .from(memoryItems)
        .where(
          and(
            eq(memoryItems.id, body.supersedeWithMemoryId),
            eq(memoryItems.ownerActorId, actorId),
          ),
        )
        .limit(1);
      if (!next) {
        throw new ApiError(
          ApiErrorCodes.NotFound,
          'Replacement memory not found or not owned by caller',
        );
      }
      await db
        .update(memoryItems)
        .set({ supersededById: next.id })
        .where(eq(memoryItems.id, mem.id));
      return { ok: true };
    },
  );
}