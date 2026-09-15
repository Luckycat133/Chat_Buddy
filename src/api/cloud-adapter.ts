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