import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq, and, gt, isNull } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { accounts, devices, sessions } from '../../db/schema.js';
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
  return db.transaction(async (tx) => {
    await lockActiveAccount(tx, accountId);
    return insertSession(tx, accountId, userAgent);
  });
}

async function lockAccount(db: Pick<Database, 'select'>, accountId: string) {
  const [account] = await db
    .select({ status: accounts.status, deletedAt: accounts.deletedAt })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .for('update');
  return account;
}

async function lockActiveAccount(db: Pick<Database, 'select'>, accountId: string): Promise<void> {
  const account = await lockAccount(db, accountId);
  if (account?.status !== 'active') {
    throw new ApiError(ApiErrorCodes.Unauthorized, 'Account unavailable');
  }
}

async function insertSession(
  db: Pick<Database, 'insert'>,
  accountId: string,
  userAgent: string,
): Promise<IssuedTokens> {
  const env = serverEnv();
  const rawAccess = randomBytes(32).toString('base64url');
  const refreshToken = randomBytes(REFRESH_BYTES).toString('base64url');
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_SEC * 1000);
  const refreshExpiresAt = new Date(
    Date.now() + env.SESSION_TTL_SEC * 1000,
  );

  const accessToken = signAccessToken(rawAccess, accountId, accessExpiresAt);

  await db.insert(sessions).values({
    id: newId<string>(),
    accountId,
    refreshTokenHash: hashOpaqueToken(refreshToken),
    accessTokenHash: hashOpaqueToken(accessToken),
    userAgent: userAgent.trim().slice(0, 512) || 'Unknown',
    lastSeenAt: new Date(),
    expiresAt: refreshExpiresAt,
  });

  return {
    accessToken,
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

  const [existing] = await db
    .select({ id: sessions.id, accountId: sessions.accountId })
    .from(sessions)
    .where(
      and(
        eq(sessions.refreshTokenHash, presentedHash),
        gt(sessions.expiresAt, new Date()),
        isNull(sessions.revokedAt),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new ApiError(ApiErrorCodes.Unauthorized, 'Refresh token rejected');
  }

  return db.transaction(async (tx) => {
    // Deletion and session issuance acquire the same account lock first.
    await lockActiveAccount(tx, existing.accountId);
    const now = new Date();
    const [rotated] = await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(
        eq(sessions.id, existing.id),
        eq(sessions.accountId, existing.accountId),
        eq(sessions.refreshTokenHash, presentedHash),
        gt(sessions.expiresAt, now),
        isNull(sessions.revokedAt),
      ))
      .returning({ userAgent: sessions.userAgent });
    if (!rotated) {
      throw new ApiError(ApiErrorCodes.Unauthorized, 'Refresh token rejected');
    }

    const tokens = await insertSession(tx, existing.accountId, rotated.userAgent);
    return { ...tokens, accountId: existing.accountId };
  });
}

export async function requestAccountDeletion(db: Database, token: string): Promise<Date> {
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    throw new ApiError(ApiErrorCodes.Unauthorized, 'Invalid access token');
  }
  const { accountId, expiresAt } = decoded;
  return db.transaction(async (tx) => {
    const account = await lockAccount(tx, accountId);
    const pendingAt = account?.status === 'deleting' ? account.deletedAt : null;
    const now = new Date();
    const tokenHash = pendingAt
      ? deletionReceiptHash(token, accountId, pendingAt)
      : hashOpaqueToken(token);
    const [session] = await tx
      .select({ id: sessions.id, revokedAt: sessions.revokedAt })
      .from(sessions)
      .where(and(
        eq(sessions.accountId, accountId),
        eq(sessions.accessTokenHash, tokenHash),
        gt(sessions.expiresAt, now),
      ))
      .for('update');
    if (session && expiresAt > now) {
      if (pendingAt && session.revokedAt?.getTime() === pendingAt.getTime()) {
        return pendingAt;
      }
      if (!session.revokedAt && account?.status === 'active') {
        await tx
          .update(accounts)
          .set({ status: 'deleting', deletedAt: now })
          .where(eq(accounts.id, accountId));
        await tx
          .update(sessions)
          .set({ revokedAt: now })
          .where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)));
        // Replace the initiator's revoked access hash with a receipt-only hash.
        await tx
          .update(sessions)
          .set({ accessTokenHash: deletionReceiptHash(token, accountId, now) })
          .where(eq(sessions.id, session.id));
        await tx
          .update(devices)
          .set({ notificationPermission: 'denied', pushTokenEncrypted: null })
          .where(eq(devices.accountId, accountId));
        return now;
      }
    }
    throw new ApiError(ApiErrorCodes.Unauthorized, 'Account or session unavailable');
  });
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
      .where(and(
        eq(sessions.accountId, accountId),
        eq(sessions.id, sessionId),
        isNull(sessions.revokedAt),
      ));
  } else {
    await db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)));
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
    .select({ id: sessions.id, accountId: sessions.accountId })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(
      and(
        eq(sessions.accountId, decoded.accountId),
        eq(sessions.accessTokenHash, hashOpaqueToken(token)),
        gt(sessions.expiresAt, new Date()),
        isNull(sessions.revokedAt),
        eq(accounts.status, 'active'),
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

function deletionReceiptHash(token: string, accountId: string, startedAt: Date): string {
  return hashOpaqueToken(`account-deletion-receipt\0${accountId}\0${startedAt.toISOString()}\0${token}`);
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
