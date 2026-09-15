import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import { accounts, actors, socialGraphs } from '../../db/schema.js';
import { optionalAuthenticate, requireAuth } from '../auth/middleware.js';
import {
  issueTokens,
  refreshSession,
  revokeSession,
} from '../auth/session.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { loadServerEnv } from '../config.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * Authentication routes per WEB_IMPLEMENTATION §4.3.
 *
 * - Sign-in (Apple or magic link) issues short-lived access + rotating refresh.
 * - Refresh rotates the refresh session atomically.
 * - Logout revokes all sessions for the account.
 *
 * Apple + magic-link delivery are stubbed here; production wiring lives in
 * server/auth/apple.ts and server/auth/magic-link.ts.
 */
export function registerAuthRoutes(app: FastifyInstance): void {
  app.post(
    '/v1/auth/dev-signin',
    { preHandler: optionalAuthenticate },
    async (request, reply) => {
      // Internal-only convenience endpoint for TestFlight / dev seed.
      // Disabled when NODE_ENV=production.
      if (loadServerEnv().NODE_ENV === 'production') {
        throw new ApiError(ApiErrorCodes.NotFound, 'Not available');
      }
      const body = z
        .object({
          displayName: z.string().min(1).max(80),
          email: z.string().email().optional(),
          appleSubject: z.string().optional(),
          socialGraphId: z.string().uuid().optional(),
        })
        .parse(request.body);

      const db = request.server.db as Database;
      const tokens = await issueForAccount(db, body);
      reply.code(200);
      return tokens;
    },
  );

  app.post(
    '/v1/auth/refresh',
    async (request) => {
      const body = z
        .object({ refreshToken: z.string().min(1).max(4096) })
        .parse(request.body);
      const db = request.server.db as Database;
      return refreshSession(db, body.refreshToken);
    },
  );

  app.post(
    '/v1/auth/logout',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const accountId = request.requestContext.accountId;
      if (!accountId) {
        throw new ApiError(
          ApiErrorCodes.Unauthorized,
          'No account bound to session',
        );
      }
      await revokeSession(db, accountId);
      return { ok: true };
    },
  );
}

async function issueForAccount(
  db: Database,
  body: {
    displayName: string;
    email?: string;
    appleSubject?: string;
    socialGraphId?: string;
  },
): Promise<{
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  accountId: string;
  actorId: string;
}> {
  let accountId: string | undefined;
  if (body.appleSubject) {
    const [existing] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.appleSubject, body.appleSubject))
      .limit(1);
    if (existing) accountId = existing.id;
  }
  if (!accountId && body.email) {
    const [existing] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.primaryEmail, body.email))
      .limit(1);
    if (existing) accountId = existing.id;
  }

  if (!accountId) {
    accountId = newId<string>();
    const graphId = body.socialGraphId ?? (await ensureDefaultGraph(db));
    await db.transaction(async (tx) => {
      await tx.insert(accounts).values({
        id: accountId!,
        status: 'active',
        primaryEmail: body.email ?? null,
        appleSubject: body.appleSubject ?? null,
        displayName: body.displayName,
      });
      await tx.insert(actors).values({
        id: accountId!,
        socialGraphId: graphId,
        accountId: accountId!,
        type: 'human',
        publicName: body.displayName,
      });
    });
  }

  const tokens = await issueTokens(db, accountId);
  return {
    accessToken: tokens.accessToken,
    accessExpiresAt: tokens.accessExpiresAt.toISOString(),
    refreshToken: tokens.refreshToken,
    refreshExpiresAt: tokens.refreshExpiresAt.toISOString(),
    accountId,
    actorId: accountId,
  };
}

async function ensureDefaultGraph(db: Database): Promise<string> {
  const [existing] = await db
    .select({ id: socialGraphs.id })
    .from(socialGraphs)
    .limit(1);
  if (existing) return existing.id;
  const id = newId<string>();
  await db.insert(socialGraphs).values({ id });
  return id;
}