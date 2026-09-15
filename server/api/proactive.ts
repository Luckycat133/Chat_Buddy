import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import { proactiveIntents } from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';
import { ProactiveStatus } from '../../shared/contracts/enums.js';

/**
 * Proactive intent endpoints per WEB_IMPLEMENTATION §15 and
 * DOMAIN_ARCHITECTURE §4.21.
 *
 * Invariants:
 *   - A durable `ProactiveIntent` is created with not-before and
 *     expiration times; the model alone cannot remember to wake later.
 *   - Dedupe key + (source, target) is unique so retries don't double-post.
 *   - The worker (`server/workers/proactive.ts`) claims, validates, and
 *     sends. Status transitions are server-authoritative.
 */
export function registerProactiveRoutes(app: FastifyInstance): void {
  app.post(
    '/v1/proactive-intents',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = z
        .object({
          targetActorId: z.string().uuid(),
          sourceEventId: z.string().uuid(),
          reason: z.string().min(1).max(800),
          desiredEffect: z.string().max(800),
          notBefore: z.string().datetime(),
          expiresAt: z.string().datetime(),
          priority: z.number().int().min(0).max(100).default(50),
          dedupeKey: z.string().min(8).max(128),
          quietHoursPolicy: z.record(z.unknown()).optional(),
          privateContext: z.record(z.unknown()).optional(),
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
      if (new Date(body.expiresAt).getTime() <= new Date(body.notBefore).getTime()) {
        throw new ApiError(
          ApiErrorCodes.ValidationFailed,
          'expiresAt must be after notBefore',
        );
      }
      const id = newId<string>();
      try {
        await db.insert(proactiveIntents).values({
          id,
          sourceActorId: actorId,
          targetActorId: body.targetActorId,
          sourceEventId: body.sourceEventId,
          reason: body.reason,
          desiredEffect: body.desiredEffect,
          notBefore: new Date(body.notBefore),
          expiresAt: new Date(body.expiresAt),
          priority: body.priority,
          dedupeKey: body.dedupeKey,
          quietHoursPolicy: body.quietHoursPolicy ?? {},
          privateContext: body.privateContext ?? {},
          status: ProactiveStatus.Pending,
        });
      } catch (err) {
        // Dedupe conflict: another request with the same dedupe key exists.
        const code = (err as { code?: string }).code;
        if (code === '23505') {
          const [existing] = await db
            .select()
            .from(proactiveIntents)
            .where(
              and(
                eq(proactiveIntents.sourceActorId, actorId),
                eq(proactiveIntents.targetActorId, body.targetActorId),
                eq(proactiveIntents.dedupeKey, body.dedupeKey),
              ),
            )
            .limit(1);
          reply.code(200);
          return { id: existing?.id, deduped: true };
        }
        throw err;
      }
      reply.code(201);
      return { id, deduped: false };
    },
  );

  app.get(
    '/v1/proactive-intents/due',
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
        .from(proactiveIntents)
        .where(
          and(
            eq(proactiveIntents.targetActorId, actorId),
            eq(proactiveIntents.status, ProactiveStatus.Pending),
            sql`${proactiveIntents.notBefore} <= now()`,
            sql`${proactiveIntents.expiresAt} > now()`,
          ),
        )
        .orderBy(asc(proactiveIntents.notBefore))
        .limit(50);
      return { items: rows };
    },
  );

  app.post(
    '/v1/proactive-intents/:id/cancel',
    { preHandler: requireAuth },
    async (request) => {
      const params = z
        .object({ id: z.string().uuid() })
        .parse(request.params);
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No actor bound to session',
        );
      }
      const [intent] = await db
        .select()
        .from(proactiveIntents)
        .where(eq(proactiveIntents.id, params.id))
        .limit(1);
      if (!intent) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Intent not found');
      }
      if (
        intent.sourceActorId !== actorId &&
        intent.targetActorId !== actorId
      ) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Only source or target may cancel',
        );
      }
      if (intent.status !== ProactiveStatus.Pending) {
        return { id: intent.id, status: intent.status, idempotent: true };
      }
      await db
        .update(proactiveIntents)
        .set({ status: ProactiveStatus.Cancelled })
        .where(eq(proactiveIntents.id, intent.id));
      return { id: intent.id, status: ProactiveStatus.Cancelled };
    },
  );

  // Reference unused helpers for type-checking strict mode.
  void gt;
  void lt;
}