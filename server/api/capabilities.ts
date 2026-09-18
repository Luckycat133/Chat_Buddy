import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import { toolExecutions } from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';
import {
  ToolExecutionStatus,
} from '../../shared/contracts/enums.js';
import {
  fetchWeather,
  fetchLightSearch,
  requestCalendarAction,
} from '../capabilities/index.js';

/**
 * Capabilities endpoints per WEB_IMPLEMENTATION §19 + DOMAIN_ARCHITECTURE §11.
 *
 * Every capability call is recorded as a `tool_executions` row so the
 * runtime can prove what was attempted and what was confirmed. Calendar
 * writes require an explicit confirmation step before success is claimed.
 */
export function registerCapabilityRoutes(app: FastifyInstance): void {
  app.post(
    '/v1/capabilities/weather',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({ city: z.string().min(1).max(120) })
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
      await db.insert(toolExecutions).values({
        id,
        requestingActorId: actorId,
        targetHumanActorId: actorId,
        conversationId: null, // capability calls may run outside any conversation
        toolName: 'weather',
        arguments: { city: body.city },
        permissionState: ToolExecutionStatus.Confirmed,
      });
      try {
        const result = await fetchWeather(body.city);
        await db
          .update(toolExecutions)
          .set({ result, completedAt: new Date(), permissionState: ToolExecutionStatus.Succeeded })
          .where(eq(toolExecutions.id, id));
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(toolExecutions)
          .set({ result: { error: message }, completedAt: new Date(), permissionState: ToolExecutionStatus.Failed })
          .where(eq(toolExecutions.id, id));
        throw new ApiError(ApiErrorCodes.ToolFailure, `weather failed: ${message}`);
      }
    },
  );

  app.post(
    '/v1/capabilities/search',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({ query: z.string().min(1).max(400) })
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
      await db.insert(toolExecutions).values({
        id,
        requestingActorId: actorId,
        targetHumanActorId: actorId,
        conversationId: null, // capability calls may run outside any conversation
        toolName: 'light_search',
        arguments: { query: body.query },
        permissionState: ToolExecutionStatus.Confirmed,
      });
      try {
        const result = await fetchLightSearch(body.query);
        await db
          .update(toolExecutions)
          .set({ result, completedAt: new Date(), permissionState: ToolExecutionStatus.Succeeded })
          .where(eq(toolExecutions.id, id));
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(toolExecutions)
          .set({ result: { error: message }, completedAt: new Date(), permissionState: ToolExecutionStatus.Failed })
          .where(eq(toolExecutions.id, id));
        throw new ApiError(ApiErrorCodes.ToolFailure, `search failed: ${message}`);
      }
    },
  );

  app.post(
    '/v1/capabilities/calendar/propose',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({
          operation: z.enum(['read', 'create', 'update', 'delete']),
          title: z.string().max(200).optional(),
          start: z.string().datetime().optional(),
          end: z.string().datetime().optional(),
          notes: z.string().max(2000).optional(),
          eventId: z.string().optional(),
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
      await db.insert(toolExecutions).values({
        id,
        requestingActorId: actorId,
        targetHumanActorId: actorId,
        conversationId: null, // capability calls may run outside any conversation
        toolName: `calendar.${body.operation}`,
        arguments: body,
        permissionState:
          body.operation === 'read'
            ? ToolExecutionStatus.Confirmed
            : ToolExecutionStatus.AwaitingConfirmation,
      });
      if (body.operation !== 'read') {
        // Writes require explicit client confirmation via /result endpoint.
        return {
          toolExecutionId: id,
          requiresConfirmation: true,
          proposed: body,
        };
      }
      const result = await requestCalendarAction(body);
      await db
        .update(toolExecutions)
        .set({ result, completedAt: new Date(), permissionState: ToolExecutionStatus.Succeeded })
        .where(eq(toolExecutions.id, id));
      return result;
    },
  );

  app.post(
    '/v1/capabilities/calendar/result',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({
          toolExecutionId: z.string().uuid(),
          result: z.record(z.unknown()),
        })
        .parse(request.body);
      const db = request.server.db as Database;
      const [row] = await db
        .select()
        .from(toolExecutions)
        .where(eq(toolExecutions.id, body.toolExecutionId))
        .limit(1);
      if (!row) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Tool execution not found');
      }
      const status = (body.result as { ok?: boolean }).ok === false
        ? ToolExecutionStatus.Failed
        : ToolExecutionStatus.Succeeded;
      await db
        .update(toolExecutions)
        .set({
          result: body.result,
          completedAt: new Date(),
          permissionState: status,
        })
        .where(eq(toolExecutions.id, body.toolExecutionId));
      return { ok: true };
    },
  );
}