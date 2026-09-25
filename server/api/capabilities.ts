import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import { actorCapabilitySettings, toolExecutions } from '../../db/schema.js';
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
  generateImage,
  synthesizeSpeech,
  MediaError,
  MediaErrorCode,
  MAX_IMAGE_PROMPT_LENGTH,
  MAX_TTS_TEXT_LENGTH,
  IMAGE_ASPECT_RATIOS,
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
        .object({
          city: z.string().min(1).max(120).optional(),
          location: z
            .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
            .optional(),
          /** Set by the client only after an explicit user gesture (§19). */
          consent: z.boolean().optional(),
        })
        .refine((v) => v.city !== undefined || v.location !== undefined, {
          message: 'city or location is required',
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
      // Browser approximate location requires the user-gesture consent flag;
      // without it the server refuses rather than silently geolocating.
      if (body.location && body.consent !== true) {
        throw new ApiError(
          ApiErrorCodes.ValidationFailed,
          'approximate location requires consent',
        );
      }
      const id = newId<string>();
      await db.insert(toolExecutions).values({
        id,
        requestingActorId: actorId,
        targetHumanActorId: actorId,
        conversationId: null, // capability calls may run outside any conversation
        toolName: 'weather',
        arguments: {
          city: body.city ?? null,
          approximateLocation: body.location
            ? {
                // One-decimal coarse precision (~11 km); nothing finer stored.
                lat: Number(body.location.lat.toFixed(1)),
                lon: Number(body.location.lon.toFixed(1)),
              }
            : null,
        },
        permissionState: ToolExecutionStatus.Confirmed,
      });
      // Persist the selected default city / coarse location per §19 BEFORE
      // the provider call: the user made the choice, so it must survive a
      // provider failure (502) too.
      const now = new Date();
      await db
        .insert(actorCapabilitySettings)
        .values({
          actorId,
          weatherCity: body.city ?? null,
          weatherConsentAt: body.consent ? now : null,
          weatherLocationLat: body.location
            ? Number(body.location.lat.toFixed(1))
            : null,
          weatherLocationLon: body.location
            ? Number(body.location.lon.toFixed(1))
            : null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: actorCapabilitySettings.actorId,
          set: {
            ...(body.city !== undefined ? { weatherCity: body.city } : {}),
            ...(body.consent === true ? { weatherConsentAt: now } : {}),
            ...(body.location
              ? {
                  weatherLocationLat: Number(body.location.lat.toFixed(1)),
                  weatherLocationLon: Number(body.location.lon.toFixed(1)),
                }
              : {}),
            updatedAt: now,
          },
        });
      try {
        const result = await fetchWeather({
          city: body.city,
          location: body.location,
        });
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

  /**
   * Connect the demo/internal calendar provider (WEB_IMPLEMENTATION §19:
   * "demo/internal calendar provider for testers"). Only after connect can
   * a provider response mark a write as completed.
   */
  app.post(
    '/v1/capabilities/calendar/connect',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({ provider: z.literal('demo') })
        .parse(request.body);
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
      }
      const now = new Date();
      await db
        .insert(actorCapabilitySettings)
        .values({
          actorId,
          calendarProvider: body.provider,
          calendarConnectedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: actorCapabilitySettings.actorId,
          set: {
            calendarProvider: body.provider,
            calendarConnectedAt: now,
            updatedAt: now,
          },
        });
      return { ok: true, provider: body.provider, connectedAt: now.toISOString() };
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
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
      }
      const [settings] = await db
        .select()
        .from(actorCapabilitySettings)
        .where(eq(actorCapabilitySettings.actorId, actorId))
        .limit(1);
      if (!settings?.calendarProvider) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No calendar provider connected',
        );
      }
      const [row] = await db
        .select()
        .from(toolExecutions)
        .where(eq(toolExecutions.id, body.toolExecutionId))
        .limit(1);
      if (!row) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Tool execution not found');
      }
      if (row.requestingActorId !== actorId) {
        throw new ApiError(ApiErrorCodes.Forbidden, 'Not your tool execution');
      }
      if (row.permissionState !== ToolExecutionStatus.AwaitingConfirmation) {
        // Only a still-pending proposed write can be completed.
        throw new ApiError(
          ApiErrorCodes.Conflict,
          'Tool execution is not awaiting confirmation',
        );
      }
      const ok = (body.result as { ok?: boolean }).ok !== false;
      const status = ok
        ? ToolExecutionStatus.Succeeded
        : ToolExecutionStatus.Failed;
      await db
        .update(toolExecutions)
        .set({
          result: body.result,
          completedAt: new Date(),
          permissionState: status,
        })
        .where(eq(toolExecutions.id, body.toolExecutionId));
      return { ok, permissionState: status };
    },
  );

  /** Capability consent/defaults for the Settings UI (§3 Me/Settings). */
  app.get(
    '/v1/capabilities/settings',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
      }
      const [settings] = await db
        .select()
        .from(actorCapabilitySettings)
        .where(eq(actorCapabilitySettings.actorId, actorId))
        .limit(1);
      return {
        weatherCity: settings?.weatherCity ?? null,
        weatherConsent: settings?.weatherConsentAt != null,
        calendarProvider: settings?.calendarProvider ?? null,
        calendarConnectedAt: settings?.calendarConnectedAt?.toISOString() ?? null,
      };
    },
  );

  /**
   * Persist the capability consent toggle and default city (§19). This is
   * the pure authorization entry point — unlike POST /v1/capabilities/weather
   * it never calls a provider, so the UI can enable weather (or remember a
   * city) even while the provider is unreachable.
   */
  app.post(
    '/v1/capabilities/settings',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({
          weatherConsent: z.boolean().optional(),
          weatherCity: z.string().min(1).max(120).nullable().optional(),
        })
        .refine(
          (v) =>
            v.weatherConsent !== undefined || v.weatherCity !== undefined,
          { message: 'nothing to update' },
        )
        .parse(request.body);
      const db = request.server.db as Database;
      const actorId = request.requestContext.actorId;
      if (!actorId) {
        throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
      }
      const now = new Date();
      await db
        .insert(actorCapabilitySettings)
        .values({
          actorId,
          weatherCity: body.weatherCity ?? null,
          weatherConsentAt: body.weatherConsent ? now : null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: actorCapabilitySettings.actorId,
          set: {
            // Withholding consent is a real user decision: it clears the
            // stored gesture instead of leaving a stale one behind.
            ...(body.weatherConsent !== undefined
              ? { weatherConsentAt: body.weatherConsent ? now : null }
              : {}),
            ...(body.weatherCity !== undefined
              ? { weatherCity: body.weatherCity }
              : {}),
            updatedAt: now,
          },
        });
      return { ok: true };
    },
  );

  /**
   * Media capabilities (image generation + TTS) per DOMAIN_ARCHITECTURE §11.
   * Provider keys live only in server env, never logged or returned; every
   * call is audited as a `tool_executions` row; failures carry stable codes
   * (MEDIA_NOT_CONFIGURED / MEDIA_FAILURE + details.reason).
   */
  const mediaFailure = (
    capability: 'image' | 'tts',
    err: unknown,
  ): ApiError => {
    if (err instanceof MediaError) {
      if (err.code === MediaErrorCode.NotConfigured) {
        return new ApiError(
          ApiErrorCodes.MediaNotConfigured,
          `media ${capability} is not configured`,
          { details: { capability, reason: err.code } },
        );
      }
      return new ApiError(
        ApiErrorCodes.MediaFailure,
        `media ${capability} failed`,
        { details: { capability, reason: err.code } },
      );
    }
    return new ApiError(ApiErrorCodes.MediaFailure, `media ${capability} failed`, {
      details: { capability, reason: 'media_internal_error' },
    });
  };

  app.post(
    '/v1/capabilities/media/image',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({
          prompt: z.string().min(1).max(MAX_IMAGE_PROMPT_LENGTH),
          aspectRatio: z.enum(IMAGE_ASPECT_RATIOS).optional(),
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
        conversationId: null,
        toolName: 'image_generation',
        arguments: {
          prompt: body.prompt,
          aspectRatio: body.aspectRatio ?? null,
        },
        permissionState: ToolExecutionStatus.Confirmed,
      });
      try {
        const result = await generateImage(body);
        await db
          .update(toolExecutions)
          .set({
            result: { images: result.images, model: result.model },
            sourceMetadata: { provider: 'minimax', model: result.model },
            completedAt: new Date(),
            permissionState: ToolExecutionStatus.Succeeded,
          })
          .where(eq(toolExecutions.id, id));
        return { images: result.images, model: result.model };
      } catch (err) {
        const reason =
          err instanceof MediaError ? err.code : 'media_internal_error';
        await db
          .update(toolExecutions)
          .set({
            result: { error: reason },
            completedAt: new Date(),
            permissionState: ToolExecutionStatus.Failed,
          })
          .where(eq(toolExecutions.id, id));
        throw mediaFailure('image', err);
      }
    },
  );

  app.post(
    '/v1/capabilities/media/tts',
    { preHandler: requireAuth },
    async (request) => {
      const body = z
        .object({
          text: z.string().min(1).max(MAX_TTS_TEXT_LENGTH),
          voiceId: z.string().min(1).max(120).optional(),
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
        conversationId: null,
        toolName: 'tts',
        arguments: {
          textLength: body.text.length,
          voiceId: body.voiceId ?? null,
        },
        permissionState: ToolExecutionStatus.Confirmed,
      });
      try {
        const result = await synthesizeSpeech(body);
        await db
          .update(toolExecutions)
          .set({
            result: {
              model: result.model,
              format: result.format,
              durationMs: result.durationMs ?? null,
            },
            sourceMetadata: { provider: 'minimax', model: result.model },
            completedAt: new Date(),
            permissionState: ToolExecutionStatus.Succeeded,
          })
          .where(eq(toolExecutions.id, id));
        return {
          audioBase64: result.audioBase64,
          format: result.format,
          model: result.model,
          ...(result.durationMs !== undefined
            ? { durationMs: result.durationMs }
            : {}),
        };
      } catch (err) {
        const reason =
          err instanceof MediaError ? err.code : 'media_internal_error';
        await db
          .update(toolExecutions)
          .set({
            result: { error: reason },
            completedAt: new Date(),
            permissionState: ToolExecutionStatus.Failed,
          })
          .where(eq(toolExecutions.id, id));
        throw mediaFailure('tts', err);
      }
    },
  );
}
