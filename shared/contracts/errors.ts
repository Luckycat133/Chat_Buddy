import { z } from 'zod';

/**
 * Standard error envelope per WEB_IMPLEMENTATION §6.
 * Clients branch on `code`, never on English text.
 */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1).max(64),
    message: z.string().min(1).max(800),
    requestId: z.string().uuid(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Stable, machine-readable error codes. Keep additions backward-compatible.
 * Authorization-related codes are reserved for server-side failures; clients
 * may not suppress these by local filtering (per DOMAIN_ARCHITECTURE §2.6).
 */
export const ApiErrorCodes = {
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  ValidationFailed: 'VALIDATION_FAILED',
  RateLimited: 'RATE_LIMITED',
  GroupInvitationRequired: 'GROUP_INVITATION_REQUIRED',
  ActorBlocked: 'ACTOR_BLOCKED',
  QuietHours: 'QUIET_HOURS',
  ProactiveExpired: 'PROACTIVE_EXPIRED',
  ModelFailure: 'MODEL_FAILURE',
  ToolFailure: 'TOOL_FAILURE',
  MediaNotConfigured: 'MEDIA_NOT_CONFIGURED',
  MediaFailure: 'MEDIA_FAILURE',
  Internal: 'INTERNAL',
} as const;
export type ApiErrorCode = (typeof ApiErrorCodes)[keyof typeof ApiErrorCodes];
