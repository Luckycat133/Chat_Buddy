import { ApiErrorCodes, type ApiErrorCode } from '../shared/contracts/errors.js';

export { ApiErrorCodes };
export type { ApiErrorCode };
export { ApiErrorSchema } from '../shared/contracts/errors.js';

/**
 * Domain error class. Carries a stable machine code, HTTP status,
 * request id, and optional details. The HTTP layer serializes this
 * via the standard error envelope.
 *
 * Authorization failures (FORBIDDEN, GROUP_INVITATION_REQUIRED,
 * ACTOR_BLOCKED) MUST NOT be suppressed by client-side filters — they
 * are server-side decisions per DOMAIN_ARCHITECTURE §5.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId: string | null;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: {
      status?: number;
      requestId?: string;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = defaultStatusForCode(code);
    this.requestId = options.requestId ?? null;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  toEnvelope() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.requestId ? { request_id: this.requestId } : {}),
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

function defaultStatusForCode(code: ApiErrorCode): number {
  switch (code) {
    case ApiErrorCodes.Unauthorized:
      return 401;
    case ApiErrorCodes.Forbidden:
    case ApiErrorCodes.ActorBlocked:
      return 403;
    case ApiErrorCodes.NotFound:
      return 404;
    case ApiErrorCodes.Conflict:
    case ApiErrorCodes.GroupInvitationRequired:
      return 409;
    case ApiErrorCodes.ValidationFailed:
      return 422;
    case ApiErrorCodes.RateLimited:
    case ApiErrorCodes.QuietHours:
    case ApiErrorCodes.ProactiveExpired:
      return 429;
    case ApiErrorCodes.ModelFailure:
    case ApiErrorCodes.ToolFailure:
    case ApiErrorCodes.Internal:
      return 502;
    default:
      return 500;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
