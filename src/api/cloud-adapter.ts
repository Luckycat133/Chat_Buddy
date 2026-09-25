/**
 * Cloud adapter — bridges the typed `CloudClient` with the existing
 * browser-side context layer.
 *
 * The migration is incremental: contexts may opt in by calling into
 * `getCloud()` instead of `minimaxService`. Feature flag is read from
 * `VITE_USE_CLOUD`; missing flag keeps the legacy local path.
 */
import { buildBrowserClient, CloudClient, CloudRequestError } from './client.js';

let cached: CloudClient | null = null;

export function getCloud(): CloudClient {
  if (cached) return cached;
  const baseUrl = import.meta.env.VITE_CLOUD_BASE_URL ?? 'http://localhost:8080';
  cached = buildBrowserClient(baseUrl);
  return cached;
}

export function cloudEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_CLOUD;
  return flag === 'true' || flag === '1';
}

/**
 * Storage helper: persist the dev-signin access + refresh tokens to
 * sessionStorage. They never persist beyond a tab; server-side session
 * cookies carry the durable refresh.
 */
export interface IssuedTokens {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  accountId: string;
  actorId: string;
}

export function saveTokens(tokens: IssuedTokens): void {
  sessionStorage.setItem('cb.access_token', tokens.accessToken);
  sessionStorage.setItem('cb.refresh_token', tokens.refreshToken);
  sessionStorage.setItem('cb.actor_id', tokens.actorId);
  sessionStorage.setItem('cb.account_id', tokens.accountId);
  sessionStorage.setItem(ACCESS_EXPIRY_KEY, tokens.accessExpiresAt);
  sessionStorage.setItem(REFRESH_EXPIRY_KEY, tokens.refreshExpiresAt);
}

export function loadTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
  actorId: string | null;
  accountId: string | null;
} {
  return {
    accessToken: sessionStorage.getItem('cb.access_token'),
    refreshToken: sessionStorage.getItem('cb.refresh_token'),
    actorId: sessionStorage.getItem('cb.actor_id'),
    accountId: sessionStorage.getItem('cb.account_id'),
  };
}

export function clearTokens(): void {
  sessionStorage.removeItem('cb.access_token');
  sessionStorage.removeItem('cb.refresh_token');
  sessionStorage.removeItem('cb.actor_id');
  sessionStorage.removeItem('cb.account_id');
  sessionStorage.removeItem(ACCESS_EXPIRY_KEY);
  sessionStorage.removeItem(REFRESH_EXPIRY_KEY);
}

/**
 * Bootstrap sign-in via the dev convenience endpoint (production swaps
 * in Sign-in-with-Apple + magic link). Throws on non-2xx so the caller
 * can surface a meaningful error to the UI.
 */
export async function devSignIn(displayName: string): Promise<IssuedTokens> {
  const cloud = getCloud();
  const res = await fetch(`${cloud.baseUrl}/v1/auth/dev-signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    throw new Error(`dev-signin failed: HTTP ${res.status}`);
  }
  const tokens = (await res.json()) as IssuedTokens;
  saveTokens(tokens);
  return tokens;
}

/** Re-export so existing imports keep working. */
export { CloudClient, CloudRequestError };

/* -------------------------------------------------------------------------- */
/*                          authed fetch (session bridge)                     */
/* -------------------------------------------------------------------------- */

const ACCESS_EXPIRY_KEY = 'cb.access_expires_at';
const REFRESH_EXPIRY_KEY = 'cb.refresh_expires_at';

/**
 * Fetch wrapper for the legacy web pipeline: resolves a session (bootstrap
 * dev-signin for fresh callers, refresh for expired ones) and attaches the
 * bearer token. A 401 triggers exactly one recovery attempt (refresh, then
 * dev-signin) before the original response is returned — the caller sees the
 * server's truthful status instead of a fabricated success, and network
 * failures propagate untouched so the UI can render a real error state.
 */
export async function authedCloudFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const baseUrl = getCloud().baseUrl;
  const accessToken = await ensureSession(baseUrl);
  const response = await doFetch(baseUrl, path, init, accessToken);
  if (response.status !== 401) {
    return response;
  }
  // One recovery attempt, then the original 401 is surfaced as-is.
  const recovered = await recoverSession(baseUrl);
  if (!recovered) return response;
  return doFetch(baseUrl, path, init, recovered);
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

async function doFetch(
  baseUrl: string,
  path: string,
  init: RequestInit,
  accessToken: string | null,
): Promise<Response> {
  const headers = new Headers(init.headers ?? undefined);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  return fetch(joinUrl(baseUrl, path), { ...init, headers });
}

/** True when the stored access token is absent or already expired. */
function accessTokenExpired(): boolean {
  const raw = sessionStorage.getItem(ACCESS_EXPIRY_KEY);
  if (!raw) return true;
  const at = Date.parse(raw);
  return Number.isNaN(at) || at <= Date.now();
}

/**
 * Resolve a usable access token without a 401 round-trip: keep the stored
 * token while fresh, refresh an expired one, or bootstrap a new session.
 * With no stored session at all a bootstrap failure is fatal (the caller
 * must observe the real network/auth failure); with a stale token it is
 * survivable so the server's own 401 can be surfaced truthfully.
 */
async function ensureSession(baseUrl: string): Promise<string | null> {
  const stored = loadTokens();
  if (stored.accessToken && !accessTokenExpired()) return stored.accessToken;
  if (stored.refreshToken) {
    const refreshed = await tryRefresh(baseUrl, stored.refreshToken);
    if (refreshed) return refreshed;
  }
  try {
    return await bootstrapDevSession(baseUrl);
  } catch (err) {
    if (stored.accessToken) return stored.accessToken;
    throw err;
  }
}

/** Post-401 recovery: refresh the stored token, else bootstrap. Null on failure. */
async function recoverSession(baseUrl: string): Promise<string | null> {
  const stored = loadTokens();
  if (stored.refreshToken) {
    const refreshed = await tryRefresh(baseUrl, stored.refreshToken);
    if (refreshed) return refreshed;
  }
  try {
    return await bootstrapDevSession(baseUrl);
  } catch {
    return null;
  }
}

async function tryRefresh(
  baseUrl: string,
  refreshToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(joinUrl(baseUrl, '/v1/auth/refresh'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const tokens = (await res.json()) as IssuedTokens;
    saveTokens(tokens);
    return tokens.accessToken;
  } catch {
    return null;
  }
}

let bootstrapPromise: Promise<string> | null = null;

/**
 * Dev-signin bootstrap. Concurrent callers share one in-flight promise so a
 * burst of requests mints a single account instead of racing sign-ins.
 */
function bootstrapDevSession(baseUrl: string): Promise<string> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        const res = await fetch(joinUrl(baseUrl, '/v1/auth/dev-signin'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ displayName: 'Web Dev User' }),
        });
        if (!res.ok) {
          throw new Error(`dev-signin failed: HTTP ${res.status}`);
        }
        const tokens = (await res.json()) as IssuedTokens;
        saveTokens(tokens);
        return tokens.accessToken;
      } finally {
        bootstrapPromise = null;
      }
    })();
  }
  return bootstrapPromise;
}