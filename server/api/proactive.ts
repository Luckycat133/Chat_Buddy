import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import { actors, proactiveIntents, worldEvents } from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';
import { ProactiveStatus } from '../../shared/contracts/enums.js';
import {
  parseQuietHoursPolicy,
  shiftOutOfQuietHours,
} from '../workers/quiet-hours.js';

interface PgErrorShape {
  code?: string;
  cause?: unknown;
}

/** Drizzle wraps driver failures; walk the cause chain to reach PG 23505. */
function isUniqueViolation(err: unknown, depth = 0): boolean {
  if (depth > 5 || !err || typeof err !== 'object') return false;
  const current = err as PgErrorShape;
  return current.code === '23505' || isUniqueViolation(current.cause, depth + 1);
}

/**
 * Proactive intent endpoints per WEB_IMPLEMENTATION §15 and
 * DOMAIN_ARCHITECTURE §4.21.
 *
 * Invariants:
 *   - A durable `ProactiveIntent` is created with not-before and
 *     expiration times; the model alone cannot remember to wake later.
 *   - Dedupe key + (source, target) is unique so retries don't double-post.
 *   - Creation shifts `notBefore` out of the configured quiet-hours window
 *     (user-local basis when a valid IANA zone is supplied) so an intent
 *     is never born already due inside the user's quiet time.
 *   - The worker (`server/workers/proactive.ts`) claims, validates, and
 *     sends. Status transitions are server-authoritative.
 *   - The inspector exposes reason/schedule/status to participants and
 *     never the privateContext.
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
      const quietPolicy = parseQuietHoursPolicy(body.quietHoursPolicy);
      const effectiveNotBefore = shiftOutOfQuietHours(
        new Date(body.notBefore),
        quietPolicy,
      );
      // The event projection carries the source actor's social graph.
      const [sourceActor] = await db
        .select({ socialGraphId: actors.socialGraphId })
        .from(actors)
        .where(eq(actors.id, actorId))
        .limit(1);
      if (!sourceActor) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Actor not found');
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
          notBefore: effectiveNotBefore,
          expiresAt: new Date(body.expiresAt),
          priority: body.priority,
          dedupeKey: body.dedupeKey,
          quietHoursPolicy: body.quietHoursPolicy ?? {},
          privateContext: body.privateContext ?? {},
          status: ProactiveStatus.Pending,
        });
      } catch (err) {
        // Dedupe conflict: another request with the same dedupe key exists.
        if (isUniqueViolation(err)) {
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
      // Durable event projection so social-graph consumers can observe
      // the intent's creation (never carries the privateContext).
      await db.insert(worldEvents).values({
        id: newId<string>(),
        socialGraphId: sourceActor.socialGraphId,
        type: 'proactive_intent_created',
        actorId,
        subjectActorIds: [body.targetActorId],
        payload: { intentId: id, dedupeKey: body.dedupeKey },
        visibilityPolicy: {},
        idempotencyKey: `proactive_intent_created:${id}`,
      });
      reply.code(201);
      return { id, deduped: false };
    },
  );

  /** Inspector: participants see schedule/status, never privateContext. */
  app.get(
    '/v1/proactive-intents/:id',
    { preHandler: requireAuth },
    async (request) => {
      const params = z
        .object({ id: z.string().uuid() })
        .parse(request.params);
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
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
          'Only source or target may inspect the intent',
        );
      }
      return {
        id: intent.id,
        status: intent.status,
        reason: intent.reason,
        desiredEffect: intent.desiredEffect,
        notBefore: intent.notBefore.toISOString(),
        expiresAt: intent.expiresAt.toISOString(),
        createdAt: intent.createdAt.toISOString(),
      };
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
