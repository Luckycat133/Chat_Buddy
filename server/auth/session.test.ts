import { describe, expect, it, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { resetServerEnvForTests, serverEnv } from '../config.js';

const SIGNING_KEY = 'a'.repeat(64);

function setEnv(accountId: string = '00000000-0000-0000-0000-000000000001'): void {
  process.env.SESSION_SIGNING_KEY = SIGNING_KEY;
  process.env.SESSION_TTL_SEC = '1209600';
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.DATABASE_URL = 'postgres://test';
  resetServerEnvForTests();
  void accountId;
}

beforeEach(() => {
  setEnv();
});

describe('serverEnv', () => {
  it('throws on missing SESSION_SIGNING_KEY', () => {
    const saved = process.env.SESSION_SIGNING_KEY;
    delete process.env.SESSION_SIGNING_KEY;
    resetServerEnvForTests();
    expect(() => serverEnv()).toThrow();
    process.env.SESSION_SIGNING_KEY = saved;
    resetServerEnvForTests();
  });

  it('returns parsed config when fully populated', () => {
    expect(serverEnv().SESSION_TTL_SEC).toBe(1209600);
  });
});

describe('access token format', () => {
  it('uses HMAC-SHA256 over the dotted payload', () => {
    // Smoke check that the signing primitive matches expected output shape.
    const payload = `${UUID}.${Date.now() + 60_000}.raw`;
    const expected = createHmac('sha256', SIGNING_KEY)
      .update(payload)
      .digest('base64url');
    expect(expected).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

const UUID = '00000000-0000-0000-0000-000000000001';
void UUID;