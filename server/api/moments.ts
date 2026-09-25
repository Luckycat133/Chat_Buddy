import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  momentInteractions,
  moments,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * Moments endpoints per WEB_IMPLEMENTATION §16 and DOMAIN_ARCHITECTURE §4.16-§4.17.
 *
 * Invariants:
 *   - Server enforces audience policy and block state at delivery time:
 *     `public_within_graph` reaches every actor in the author's graph,
 *     `familiar` only actors with an `accepted` relationship to the author,
 *     `restricted` only actors listed in `allowed_actor_ids`; moments by a
 *     blocked author are hidden from the blocker entirely, and cross-graph
 *     or deleted moments behave as non-existent (404, no enumeration oracle).
 *   - Feed pagination is keyset-based on (created_at DESC, id DESC); the
 *     cursor is the last moment id of the previous page.
 *   - Posts by AI characters may reference a `source_event_id` only when the
 *     event is owned by the caller; human posts pass none.
 *   - Interactions (view/reaction/comment/reply) are idempotent per
 *     `client_idempotency_key` for optimistic clients; requests without a
 *     key are never deduped.
 */

const AUDIENCE_CLASSES = ['public_within_graph', 'familiar', 'restricted'] as const;
type AudienceClass = (typeof AUDIENCE_CLASSES)[number];

interface AudiencePolicy {
  allowedActorIds?: string[];
  class?: AudienceClass;
}

export function registerMomentRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/moments',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const viewerId = requireActorId(request);
      const graphId = requireGraphId(request);

      const q = z
        .object({
          cursor: z.string().uuid().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(request.query);

      // Keyset cursor: must reference a known moment, otherwise the client
      // would silently restart the feed and see duplicates.
      let cursorCreatedAt: Date | null = null;
      if (q.cursor) {
        const [cursorRow] = await db
          .select({ createdAt: moments.createdAt })
          .from(moments)
          .where(eq(moments.id, q.cursor))
          .limit(1);
        if (!cursorRow) {
          throw new ApiError(
            ApiErrorCodes.ValidationFailed,
            'cursor does not reference a known moment',
          );
        }
        cursorCreatedAt = cursorRow.createdAt;
      }

      const conditions: SQL[] = [
        eq(moments.socialGraphId, graphId),
        isNull(moments.deletedAt),
        blockedPairExcludes(viewerId),
        audienceVisibleTo(viewerId),
      ];
      if (cursorCreatedAt && q.cursor) {
        conditions.push(
          sql`(${moments.createdAt}, ${moments.id}) < (${cursorCreatedAt.toISOString()}::timestamptz, ${q.cursor}::uuid)`,
        );
      }

      // Fetch one extra row to detect whether a next page exists.
      const rows = await db
        .select()
        .from(moments)
        .where(and(...conditions))
        .orderBy(desc(moments.createdAt), desc(moments.id))
        .limit(q.limit + 1);

      const page = rows.slice(0, q.limit);
      const nextCursor =
        rows.length > q.limit && page.length > 0
          ? page[page.length - 1]!.id
          : null;

      const items = await withFeedCounts(db, page, viewerId);
      return { items, nextCursor };
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
            class: z.enum(AUDIENCE_CLASSES),
          }),
          sourceEventId: z.string().uuid().optional(),
        })
        .parse(request.body);
      const db = request.server.db as Database;
      const actorId = requireActorId(request);
      const graphId = requireGraphId(request);

      // A moment may only be attributed to an event the caller owns.
      if (body.sourceEventId) {
        const [event] = await db
          .select({ id: worldEvents.id, actorId: worldEvents.actorId })
          .from(worldEvents)
          .where(eq(worldEvents.id, body.sourceEventId))
          .limit(1);
        if (!event || event.actorId !== actorId) {
          throw new ApiError(
            ApiErrorCodes.ValidationFailed,
            'sourceEventId must reference a caller-owned event',
          );
        }
      }

      const id = newId<string>();
      const [moment] = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(moments)
          .values({
            id,
            actorId,
            socialGraphId: graphId,
            content: body.content,
            mediaAssets: body.mediaAssets ?? [],
            audiencePolicy: body.audiencePolicy,
            sourceEventId: body.sourceEventId ?? null,
          })
          .returning();
        await tx.insert(worldEvents).values({
          id: newId<string>(),
          socialGraphId: graphId,
          type: 'moment_posted',
          actorId,
          subjectActorIds: body.audiencePolicy.allowedActorIds,
          momentId: id,
          payload: { audience: body.audiencePolicy.class },
          visibilityPolicy: body.audiencePolicy,
          idempotencyKey: `moment_posted:${id}`,
        });
        return [row];
      });

      reply.code(201);
      return { moment };
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
          clientIdempotencyKey: z.string().min(8).max(128).optional(),
        })
        .parse(request.body);
      const db = request.server.db as Database;
      const actorId = requireActorId(request);
      const graphId = requireGraphId(request);

      const [moment] = await db
        .select()
        .from(moments)
        .where(eq(moments.id, params.id))
        .limit(1);
      // 404 (not 403) for cross-graph or deleted moments: no enumeration oracle.
      if (!moment || moment.socialGraphId !== graphId || moment.deletedAt) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Moment not found');
      }

      if (await pairIsBlocked(db, graphId, actorId, moment.actorId)) {
        throw new ApiError(
          ApiErrorCodes.ActorBlocked,
          'Moment author is blocked',
        );
      }
      if (!(await audienceAllows(db, moment, actorId))) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'Moment not visible to caller',
        );
      }

      // Optimistic clients replay the same client key; replay returns the
      // original interaction instead of writing a second copy.
      if (body.clientIdempotencyKey) {
        const [existing] = await db
          .select()
          .from(momentInteractions)
          .where(
            and(
              eq(momentInteractions.momentId, moment.id),
              eq(momentInteractions.actorId, actorId),
              eq(momentInteractions.clientIdempotencyKey, body.clientIdempotencyKey),
            ),
          )
          .limit(1);
        if (existing) {
          return { interaction: existing, duplicate: true };
        }
      }

      const id = newId<string>();
      const eventType =
        body.type === 'view'
          ? 'moment_viewed'
          : body.type === 'reaction'
            ? 'moment_reacted'
            : 'moment_commented';
      try {
        await db.transaction(async (tx) => {
          await tx.insert(momentInteractions).values({
            id,
            momentId: moment.id,
            actorId,
            type: body.type,
            content: body.content ?? null,
            parentInteractionId: body.parentInteractionId ?? null,
            clientIdempotencyKey: body.clientIdempotencyKey ?? null,
          });
          await tx.insert(worldEvents).values({
            id: newId<string>(),
            socialGraphId: graphId,
            type: eventType,
            actorId,
            subjectActorIds: [moment.actorId],
            momentId: moment.id,
            payload: { interactionType: body.type },
            visibilityPolicy: moment.audiencePolicy,
            idempotencyKey: `${eventType}:${id}`,
          });
        });
      } catch (err) {
        // Concurrent replay of the same client key lost the race on the
        // unique index; replay the original row instead of surfacing a 500.
        if (
          isUniqueViolation(err, 'moment_interactions_client_key_idx') &&
          body.clientIdempotencyKey
        ) {
          const [existing] = await db
            .select()
            .from(momentInteractions)
            .where(
              and(
                eq(momentInteractions.momentId, moment.id),
                eq(momentInteractions.actorId, actorId),
                eq(momentInteractions.clientIdempotencyKey, body.clientIdempotencyKey),
              ),
            )
            .limit(1);
          if (existing) {
            return { interaction: existing, duplicate: true };
          }
        }
        throw err;
      }

      const [interaction] = await db
        .select()
        .from(momentInteractions)
        .where(eq(momentInteractions.id, id))
        .limit(1);
      return { interaction, duplicate: false };
    },
  );
}

/* ----------------------------- authorization ------------------------------ */

function requireActorId(request: { requestContext: { actorId?: string | null } }): string {
  const actorId = request.requestContext.actorId;
  if (!actorId) {
    throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
  }
  return actorId;
}

function requireGraphId(request: { requestContext: { socialGraphId?: string | null } }): string {
  const graphId = request.requestContext.socialGraphId;
  if (!graphId) {
    throw new ApiError(ApiErrorCodes.Forbidden, 'No social graph bound to actor');
  }
  return graphId;
}

/** Relationship row for an unordered actor pair, when one exists. */
async function findPairRelationship(
  db: Database,
  graphId: string,
  a: string,
  b: string,
): Promise<{ state: string } | null> {
  // actor_a/actor_b order is not canonical on write, so match either layout.
  const [row] = await db
    .select({ state: relationships.state })
    .from(relationships)
    .where(
      and(
        eq(relationships.socialGraphId, graphId),
        or(
          and(
            eq(relationships.actorAId, a),
            eq(relationships.actorBId, b),
          ),
          and(
            eq(relationships.actorAId, b),
            eq(relationships.actorBId, a),
          ),
        ),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function pairIsBlocked(
  db: Database,
  graphId: string,
  a: string,
  b: string,
): Promise<boolean> {
  const rel = await findPairRelationship(db, graphId, a, b);
  return rel?.state === 'blocked';
}

/**
 * Audience decision for one moment: `restricted` requires an explicit
 * allowlist hit, `familiar` an accepted relationship, `public_within_graph`
 * passes for anyone in the author's graph (block state is checked first).
 */
async function audienceAllows(
  db: Database,
  moment: typeof moments.$inferSelect,
  actorId: string,
): Promise<boolean> {
  const policy = moment.audiencePolicy as AudiencePolicy | null;
  if (moment.actorId === actorId) return true;
  if (!policy || typeof policy !== 'object') return false;
  if (Array.isArray(policy.allowedActorIds) && policy.allowedActorIds.includes(actorId)) {
    return true;
  }
  if (policy.class === 'public_within_graph') return true;
  if (policy.class === 'familiar') {
    const rel = await findPairRelationship(
      db,
      moment.socialGraphId,
      actorId,
      moment.actorId,
    );
    return rel?.state === 'accepted';
  }
  return false;
}

/* ------------------------------ SQL fragments ----------------------------- */

/**
 * SQL: exclude moments whose author has a `blocked` relationship with the
 * viewer — block wins even over `public_within_graph`.
 */
function blockedPairExcludes(viewerId: string): SQL {
  const pairBlocked = (alias: string): SQL =>
    sql`EXISTS (
      SELECT 1 FROM relationships ${sql.raw(alias)}
      WHERE ${sql.raw(alias)}.social_graph_id = ${moments.socialGraphId}
        AND ((${sql.raw(alias)}.actor_a_id = ${moments.actorId} AND ${sql.raw(alias)}.actor_b_id = ${viewerId}::uuid)
          OR (${sql.raw(alias)}.actor_a_id = ${viewerId}::uuid AND ${sql.raw(alias)}.actor_b_id = ${moments.actorId}))
        AND ${sql.raw(alias)}.state = 'blocked'
    )`;
  return sql`NOT ${pairBlocked('rel_blocked')}`;
}

/**
 * SQL: the audience policy union — author, explicit allowlist hit,
 * public-within-graph, or familiar with an accepted relationship.
 */
function audienceVisibleTo(viewerId: string): SQL {
  const pairAccepted = (alias: string): SQL =>
    sql`EXISTS (
      SELECT 1 FROM relationships ${sql.raw(alias)}
      WHERE ${sql.raw(alias)}.social_graph_id = ${moments.socialGraphId}
        AND ((${sql.raw(alias)}.actor_a_id = ${moments.actorId} AND ${sql.raw(alias)}.actor_b_id = ${viewerId}::uuid)
          OR (${sql.raw(alias)}.actor_a_id = ${viewerId}::uuid AND ${sql.raw(alias)}.actor_b_id = ${moments.actorId}))
        AND ${sql.raw(alias)}.state = 'accepted'
    )`;
  return sql`(
    ${moments.actorId} = ${viewerId}::uuid
    OR (${moments.audiencePolicy}->>'class' = 'restricted'
      AND (${moments.audiencePolicy}->'allowedActorIds') @> to_jsonb(${viewerId}::text))
    OR ${moments.audiencePolicy}->>'class' = 'public_within_graph'
    OR (${moments.audiencePolicy}->>'class' = 'familiar' AND ${pairAccepted('rel_familiar')})
  )`;
}

/* ------------------------------ feed envelope ----------------------------- */

type FeedItem = {
  moment: typeof moments.$inferSelect;
  reactionCount: number;
  commentCount: number;
  viewerInteractions: Array<typeof momentInteractions.$inferSelect>;
};

/**
 * Counts and the viewer's own interactions for one page of moments.
 * `viewerInteractions` is the reconciliation source for optimistic clients,
 * so only the caller's own rows are echoed back.
 */
async function withFeedCounts(
  db: Database,
  page: Array<typeof moments.$inferSelect>,
  viewerId: string,
): Promise<FeedItem[]> {
  const items: FeedItem[] = page.map((moment) => ({
    moment,
    reactionCount: 0,
    commentCount: 0,
    viewerInteractions: [],
  }));
  if (page.length === 0) return items;

  const counts = new Map(items.map((item) => [item.moment.id, item]));
  const interactions = await db
    .select()
    .from(momentInteractions)
    .where(inArray(momentInteractions.momentId, [...counts.keys()]));
  for (const row of interactions) {
    const item = counts.get(row.momentId);
    if (!item) continue;
    if (row.type === 'reaction') item.reactionCount += 1;
    if (row.type === 'comment' || row.type === 'reply') item.commentCount += 1;
    if (row.actorId === viewerId) item.viewerInteractions.push(row);
  }
  return items;
}

/* -------------------------------- helpers --------------------------------- */

interface PgErrorShape {
  code?: string;
  constraint?: string;
  constraint_name?: string;
}

/** Drizzle wraps driver errors, so walk the `cause` chain for 23505. */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  let cur = err as PgErrorShape | null | undefined;
  for (let depth = 0; cur && depth < 5; depth += 1) {
    if (
      cur.code === '23505' &&
      (cur.constraint === constraint ||
        cur.constraint_name === constraint ||
        typeof (cur as { message?: string }).message === 'string' &&
          ((cur as { message?: string }).message ?? '').includes(constraint))
    ) {
      return true;
    }
    cur = (cur as { cause?: unknown }).cause as PgErrorShape | null | undefined;
  }
  return false;
}
