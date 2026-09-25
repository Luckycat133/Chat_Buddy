import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq, and, gt, isNull } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { sessions } from '../../db/schema.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { serverEnv } from '../config.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * Session tokens follow WEB_IMPLEMENTATION §14:
 * - Short-lived access token (returned in body, kept in memory)
 * - Rotating refresh token (stored as SHA-256 hash, returned in
 *   HTTP-only secure cookie where the transport allows)
 *
 * Tokens are opaque, URL-safe base64url, never derived from the user id.
 */

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_BYTES = 48;

export interface IssuedTokens {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthenticatedSession {
  accountId: string;
  accessExpiresAt: Date;
  sessionId: string;
}

export async function issueTokens(
  db: Database,
  accountId: string,
  userAgent = 'Unknown',
): Promise<IssuedTokens> {
  const env = serverEnv();
  const accessToken = randomBytes(32).toString('base64url');
  const refreshToken = randomBytes(REFRESH_BYTES).toString('base64url');
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_SEC * 1000);
  const refreshExpiresAt = new Date(
    Date.now() + env.SESSION_TTL_SEC * 1000,
  );

  const sessionId = newId<string>();
  const refreshHash = hashOpaqueToken(refreshToken);

  await db.insert(sessions).values({
    id: sessionId,
    accountId,
    refreshTokenHash: refreshHash,
    accessTokenHash: null,
    userAgent: userAgent.trim().slice(0, 512) || 'Unknown',
    lastSeenAt: new Date(),
    expiresAt: refreshExpiresAt,
  });

  const signedAccess = signAccessToken(accessToken, accountId, accessExpiresAt);
  await db
    .update(sessions)
    .set({ accessTokenHash: hashOpaqueToken(signedAccess) })
    .where(eq(sessions.id, sessionId));
  return {
    accessToken: signedAccess,
    accessExpiresAt,
    refreshToken,
    refreshExpiresAt,
  };
}

export async function refreshSession(
  db: Database,
  presented: string,
): Promise<IssuedTokens & { accountId: string }> {
  return rotateRefresh(db, presented);
}

export async function rotateRefresh(
  db: Database,
  presented: string,
): Promise<IssuedTokens & { accountId: string }> {
  const presentedHash = hashOpaqueToken(presented);

  const existingRows = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.refreshTokenHash, presentedHash),
        gt(sessions.expiresAt, new Date()),
        isNull(sessions.revokedAt),
      ),
    )
    .limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new ApiError(ApiErrorCodes.Unauthorized, 'Refresh token rejected');
  }

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, existing.id));

  const tokens = await issueTokens(db, existing.accountId, existing.userAgent);
  return { ...tokens, accountId: existing.accountId };
}

export async function revokeSession(
  db: Database,
  accountId: string,
  sessionId?: string,
): Promise<void> {
  const now = new Date();
  if (sessionId) {
    await db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.accountId, accountId), eq(sessions.id, sessionId)));
  } else {
    await db
      .update(sessions)
      .set({ revokedAt: now })
      .where(eq(sessions.accountId, accountId));
  }
}

export async function authenticateAccessToken(
  db: Database,
  token: string,
): Promise<AuthenticatedSession> {
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    throw new ApiError(ApiErrorCodes.Unauthorized, 'Invalid access token');
  }
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.accountId, decoded.accountId),
        eq(sessions.accessTokenHash, hashOpaqueToken(token)),
        gt(sessions.expiresAt, new Date()),
        isNull(sessions.revokedAt),
      ),
    )
    .limit(1);
  if (!session) {
    throw new ApiError(
      ApiErrorCodes.Unauthorized,
      'Access token rejected or session expired',
    );
  }
  const now = new Date();
  await db
    .update(sessions)
    .set({ lastSeenAt: now })
    .where(eq(sessions.id, session.id));
  return {
    accountId: session.accountId,
    accessExpiresAt: decoded.expiresAt,
    sessionId: session.id,
  };
}

interface SignedAccess {
  accountId: string;
  expiresAt: Date;
}

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function signAccessToken(
  rawToken: string,
  accountId: string,
  expiresAt: Date,
): string {
  const payload = `${accountId}.${expiresAt.getTime()}.${rawToken}`;
  const sig = createHmac('sha256', serverEnv().SESSION_SIGNING_KEY)
    .update(payload)
    .digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function verifyAccessToken(token: string): SignedAccess | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(body, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const segments = decoded.split('.');
  if (segments.length !== 3) return null;
  const [accountId, expiresRaw, rawToken] = segments;
  if (!accountId || !expiresRaw || !rawToken) return null;
  if (!isUuid(accountId)) return null;
  const expiresAt = new Date(Number(expiresRaw));
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return null;
  }
  const expected = createHmac('sha256', serverEnv().SESSION_SIGNING_KEY)
    .update(`${accountId}.${expiresRaw}.${rawToken}`)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return { accountId, expiresAt };
}