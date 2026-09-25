import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { accounts, actors } from '../../db/schema.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { authenticateAccessToken } from './session.js';

/**
 * Authentication hook. Populates request.requestContext with the
 * derived account and primary human actor. Per WEB_IMPLEMENTATION §4.3,
 * the API derives `account_id` and `human_actor_id`; clients cannot
 * choose them.
 *
 * Routes that allow anonymous access call `optionalAuthenticate`.
 */
export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  await authenticate(request, true);
}

export async function optionalAuthenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  await authenticate(request, false);
}

async function authenticate(
  request: FastifyRequest,
  required: boolean,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    if (required) {
      throw new ApiError(ApiErrorCodes.Unauthorized, 'Missing bearer token');
    }
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    if (required) {
      throw new ApiError(ApiErrorCodes.Unauthorized, 'Empty bearer token');
    }
    return;
  }
  const db = request.server.db as Database;
  const session = await authenticateAccessToken(db, token);

  // Derive the primary human actor owned by this account.
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1);
  if (!account || account.status === 'deleted') {
    throw new ApiError(ApiErrorCodes.Unauthorized, 'Account unavailable');
  }
  // Per DOMAIN_ARCHITECTURE §4.1, an account owns exactly one human actor.
  // The actor row is the authz identity for downstream authorization.
  const [actor] = await db
    .select()
    .from(actors)
    .where(eq(actors.accountId, account.id))
    .limit(1);
  request.requestContext.accountId = account.id;
  request.requestContext.sessionId = session.sessionId;
  request.requestContext.actorId = actor?.id ?? null;
  request.requestContext.socialGraphId = actor?.socialGraphId ?? null;
}
