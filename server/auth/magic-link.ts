/**
 * Magic-link sender stub per WEB_IMPLEMENTATION §4.3.
 *
 * Production wiring would call SendGrid / SES / Postmark; demo returns
 * the link in-band. The link is single-use, short-lived, and carries a
 * token that maps to a server-side nonce.
 */
import { randomBytes } from 'node:crypto';
import { serverEnv } from '../config.js';

const TTL_SEC = 15 * 60;
const nonces = new Map<string, { email: string; expiresAt: number }>();

export function issueMagicLink(email: string): {
  token: string;
  link: string;
  expiresAt: number;
} {
  const token = randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + TTL_SEC * 1000;
  nonces.set(token, { email, expiresAt });
  // Best-effort prune.
  for (const [k, v] of nonces) {
    if (v.expiresAt < Date.now()) nonces.delete(k);
  }
  const base = serverEnv().PUBLIC_WEB_URL.replace(/\/$/, '');
  const link = `${base}/auth/magic?token=${encodeURIComponent(token)}`;
  return { token, link, expiresAt };
}

export function consumeMagicLink(
  token: string,
): { email: string } | null {
  const entry = nonces.get(token);
  if (!entry) return null;
  nonces.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return { email: entry.email };
}

// Exposed for tests that need to clear state.
export function __resetMagicLinksForTests(): void {
  nonces.clear();
}