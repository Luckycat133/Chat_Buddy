import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import { accounts, actors, sessions, socialGraphs } from '../../db/schema.js';
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
      const userAgent = request.headers['user-agent']?.slice(0, 512) ?? 'Unknown';
      const tokens = await issueForAccount(db, body, userAgent);
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

  app.get(
    '/v1/auth/sessions',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const accountId = requireAccountId(request.requestContext.accountId);
      const rows = await db
        .select({
          id: sessions.id,
          userAgent: sessions.userAgent,
          lastSeenAt: sessions.lastSeenAt,
          createdAt: sessions.createdAt,
          expiresAt: sessions.expiresAt,
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .where(eq(sessions.accountId, accountId))
        .orderBy(desc(sessions.lastSeenAt));
      return {
        items: rows.map((row) => ({
          id: row.id,
          userAgent: row.userAgent,
          lastSeenAt: row.lastSeenAt.toISOString(),
          createdAt: row.createdAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          revokedAt: row.revokedAt?.toISOString() ?? null,
          current: row.id === request.requestContext.sessionId,
        })),
      };
    },
  );

  app.delete(
    '/v1/auth/sessions/:id',
    { preHandler: requireAuth },
    async (request) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const db = request.server.db as Database;
      const accountId = requireAccountId(request.requestContext.accountId);
      if (id === request.requestContext.sessionId) {
        throw new ApiError(
          ApiErrorCodes.Conflict,
          'Cannot revoke the current session',
        );
      }
      const [owned] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.accountId, accountId),
            eq(sessions.id, id),
          ),
        )
        .limit(1);
      if (!owned) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Session not found');
      }
      await revokeSession(db, accountId, id);
      return { ok: true, id };
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
  userAgent: string,
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

  const tokens = await issueTokens(db, accountId, userAgent);
  return {
    accessToken: tokens.accessToken,
    accessExpiresAt: tokens.accessExpiresAt.toISOString(),
    refreshToken: tokens.refreshToken,
    refreshExpiresAt: tokens.refreshExpiresAt.toISOString(),
    accountId,
    actorId: accountId,
  };
}

function requireAccountId(accountId: string | null): string {
  if (!accountId) {
    throw new ApiError(
      ApiErrorCodes.Unauthorized,
      'No account bound to session',
    );
  }
  return accountId;
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