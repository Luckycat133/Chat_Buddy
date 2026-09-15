import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Per-request context. Populated by the request-context plugin.
 * Includes the request id, accepted account (if any), and a privacy-safe
 * actor/social-graph projection that logs may use.
 */
export interface RequestContext {
  requestId: string;
  accountId: string | null;
  actorId: string | null;
  socialGraphId: string | null;
  startedAt: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    requestContext: RequestContext;
  }
}

export function newRequestId(): string {
  return randomUUID();
}

export function attachRequestContext(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: (err?: Error) => void,
): void {
  // Honour client-supplied request id if it parses as a UUID; otherwise mint one.
  const headerId = request.headers['x-request-id'];
  const requestId =
    typeof headerId === 'string' && isUuid(headerId) ? headerId : newRequestId();
  request.requestContext = {
    requestId,
    accountId: null,
    actorId: null,
    socialGraphId: null,
    startedAt: Date.now(),
  };
  void _reply;
  done();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
