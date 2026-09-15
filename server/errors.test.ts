import { describe, expect, it } from 'vitest';
import { ApiError } from './errors.js';
import { ApiErrorCodes } from '../shared/contracts/errors.js';

describe('ApiError', () => {
  it('serializes to the standard envelope', () => {
    const err = new ApiError(
      ApiErrorCodes.Forbidden,
      'not allowed',
      { requestId: '11111111-1111-1111-1111-111111111111' },
    );
    const envelope = err.toEnvelope();
    expect(envelope.error.code).toBe('FORBIDDEN');
    expect(envelope.error.message).toBe('not allowed');
    expect(envelope.error.request_id).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
  });

  it('maps error codes to the documented HTTP status', () => {
    expect(
      new ApiError(ApiErrorCodes.Unauthorized, 'x').status,
    ).toBe(401);
    expect(new ApiError(ApiErrorCodes.Forbidden, 'x').status).toBe(403);
    expect(new ApiError(ApiErrorCodes.NotFound, 'x').status).toBe(404);
    expect(
      new ApiError(ApiErrorCodes.GroupInvitationRequired, 'x').status,
    ).toBe(409);
    expect(
      new ApiError(ApiErrorCodes.ValidationFailed, 'x').status,
    ).toBe(422);
    expect(new ApiError(ApiErrorCodes.RateLimited, 'x').status).toBe(429);
    expect(new ApiError(ApiErrorCodes.ModelFailure, 'x').status).toBe(502);
  });

  it('preserves cause when provided', () => {
    const inner = new Error('boom');
    const outer = new ApiError(ApiErrorCodes.Internal, 'wrapped', {
      cause: inner,
    });
    expect((outer as Error & { cause?: unknown }).cause).toBe(inner);
  });
});