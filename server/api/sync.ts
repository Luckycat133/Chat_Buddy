import type { FastifyInstance } from 'fastify';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { worldEvents, syncCursor } from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';

/**
 * Delta sync endpoint per DOMAIN_ARCHITECTURE §13.
 *
 * The server returns a monotonically ordered envelope of upserts and
 * tombstones; the client advances its cursor only after a successful
 * commit to its local IndexedDB cache.
 *
 * Cursor format: opaque base64url-encoded JSON `{ "eventId": "uuid",
 * "occurredAt": "iso" }`. Sorting by `occurred_at ASC, id ASC` is
 * total even across clock skew and DST gaps; the JSON envelope keeps
 * the cursor opaque so future changes do not break older clients.
 */
export function registerSyncRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/sync',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const accountId = request.requestContext.accountId;
      const graphId = request.requestContext.socialGraphId;
      if (!accountId || !graphId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No social graph bound to actor',
        );
      }

      const queryCursor = String(
        (request.query as { cursor?: string } | undefined)?.cursor ?? '',
      );
      const rows = await db
        .select({ cursor: syncCursor.cursor })
        .from(syncCursor)
        .where(eq(syncCursor.accountId, accountId))
        .limit(1);
      const last = rows[0];
      const since = decodeCursor(queryCursor) ?? decodeCursor(last?.cursor);

      const baseWhere = since
        ? sql`(${worldEvents.occurredAt}, ${worldEvents.id}) > (${new Date(
            since.occurredAt,
          )}, ${since.eventId}::uuid)`
        : sql`TRUE`;

      const events = await db
        .select({
          id: worldEvents.id,
          type: worldEvents.type,
          actorId: worldEvents.actorId,
          subjectActorIds: worldEvents.subjectActorIds,
          conversationId: worldEvents.conversationId,
          momentId: worldEvents.momentId,
          payload: worldEvents.payload,
          visibilityPolicy: worldEvents.visibilityPolicy,
          occurredAt: worldEvents.occurredAt,
          causedByEventId: worldEvents.causedByEventId,
          idempotencyKey: worldEvents.idempotencyKey,
        })
        .from(worldEvents)
        .where(
          and(eq(worldEvents.socialGraphId, graphId), baseWhere),
        )
        .orderBy(worldEvents.occurredAt, worldEvents.id)
        .limit(500);

      const upserts = events.map((e) => ({
        table: 'world_events',
        id: e.id,
        payload: { ...e, occurredAt: e.occurredAt.toISOString() },
      }));

      const tombstones = events
        .filter((e) => isTombstone(e.type))
        .map((e) => ({
          table: 'world_events',
          id: e.id,
          deletedAt: e.occurredAt.toISOString(),
        }));

      const lastEvent = events.at(-1);
      const nextCursor = lastEvent
        ? encodeCursor(lastEvent.id, lastEvent.occurredAt)
        : encodeCursor('00000000-0000-0000-0000-000000000000', new Date());

      if (lastEvent) {
        try {
          await db
            .insert(syncCursor)
            .values({ accountId, cursor: nextCursor })
            .onConflictDoUpdate({
              target: syncCursor.accountId,
              set: { cursor: nextCursor, updatedAt: new Date() },
            });
        } catch (err) {
          request.log.warn({ err }, 'failed to persist sync cursor');
        }
      }

      return {
        cursor: nextCursor,
        upserts,
        tombstones,
        serverTime: new Date().toISOString(),
        hasMore: events.length === 500,
      };
    },
  );

  void isNotNull;
}

interface CursorState {
  eventId: string;
  occurredAt: string;
}

function encodeCursor(eventId: string, occurredAt: Date): string {
  const payload: CursorState = {
    eventId,
    occurredAt: occurredAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw: string | undefined): CursorState | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as CursorState;
    if (
      typeof parsed.eventId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        parsed.eventId,
      )
    ) {
      return null;
    }
    if (typeof parsed.occurredAt !== 'string' || Number.isNaN(Date.parse(parsed.occurredAt))) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isTombstone(eventType: string): boolean {
  return (
    eventType === 'friendship_deleted' ||
    eventType === 'actor_blocked' ||
    eventType === 'group_left'
  );
}
