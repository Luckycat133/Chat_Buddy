/**
 * Cloud adapter tests: the legacy web pipeline's bridge into the hosted
 * runtime. Focus: auth bootstrap/recovery and truthful failure propagation
 * when the gateway is unreachable (offline / 503) — the client must fail
 * visibly instead of spinning or faking success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authedCloudFetch,
  clearTokens,
  cloudEnabled,
  saveTokens,
} from './cloud-adapter.js';

const fetchMock = vi.fn();

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('cloudEnabled', () => {
  it('test_when_flag_is_unset_should_stay_on_the_legacy_local_path', () => {
    // vitest.config.js pins VITE_USE_CLOUD to 'false' so unit tests never
    // require a live server.
    expect(cloudEnabled()).toBe(false);
  });
});

describe('authedCloudFetch', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('test_when_no_session_exists_should_bootstrap_dev_signin_once_for_concurrent_callers', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/auth/dev-signin')) {
        return jsonResponse({
          accessToken: 'token-1',
          accessExpiresAt: 'soon',
          refreshToken: 'refresh-1',
          refreshExpiresAt: 'later',
          accountId: 'acc-1',
          actorId: 'actor-1',
        });
      }
      return jsonResponse({ ok: true });
    });

    // Concurrent callers share one bootstrap instead of minting accounts.
    const [a, b] = await Promise.all([
      authedCloudFetch('/v1/actors'),
      authedCloudFetch('/v1/actors'),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const signinCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith('/v1/auth/dev-signin'),
    );
    expect(signinCalls).toHaveLength(1);

    const actorCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/v1/actors'),
    );
    const headers = new Headers(actorCall?.[1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer token-1');
  });

  it('test_when_access_token_expires_should_refresh_and_retry_once', async () => {
    saveTokens({
      accessToken: 'stale',
      accessExpiresAt: 'past',
      refreshToken: 'refresh-1',
      refreshExpiresAt: 'later',
      accountId: 'acc-1',
      actorId: 'actor-1',
    });

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/auth/refresh')) {
        return jsonResponse({
          accessToken: 'fresh',
          accessExpiresAt: 'soon',
          refreshToken: 'refresh-2',
          refreshExpiresAt: 'later',
          accountId: 'acc-1',
          actorId: 'actor-1',
        });
      }
      const auth = new Headers(init?.headers).get('authorization');
      if (auth === 'Bearer stale') return jsonResponse({ error: {} }, 401);
      return jsonResponse({ ok: true });
    });

    const res = await authedCloudFetch('/v1/actors');
    expect(res.status).toBe(200);
    const retryCall = fetchMock.mock.calls.at(-1);
    const headers = new Headers(retryCall?.[1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer fresh');
  });

  it('test_when_the_gateway_is_unreachable_should_propagate_the_network_failure', async () => {
    // No stored session, and dev-signin itself cannot reach the server
    // (offline / gateway down): the caller must observe the real failure.
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(authedCloudFetch('/v1/ai/complete')).rejects.toThrow('Failed to fetch');
  });

  it('test_when_recovery_is_impossible_should_return_the_original_401_response', async () => {
    saveTokens({
      accessToken: 'stale',
      accessExpiresAt: 'past',
      refreshToken: 'dead',
      refreshExpiresAt: 'past',
      accountId: 'acc-1',
      actorId: 'actor-1',
    });

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/auth/refresh')) return jsonResponse({ error: {} }, 401);
      if (url.endsWith('/v1/auth/dev-signin')) return jsonResponse({ error: {} }, 503);
      const auth = new Headers(init?.headers).get('authorization');
      if (auth === 'Bearer stale') return jsonResponse({ error: {} }, 401);
      return jsonResponse({ ok: true });
    });

    const res = await authedCloudFetch('/v1/actors');
    // Truthful failure: the 401 surfaces instead of a fabricated success.
    expect(res.status).toBe(401);
  });

  it('test_when_tokens_are_cleared_should_remove_session_storage_entries', () => {
    saveTokens({
      accessToken: 'a',
      accessExpiresAt: 'x',
      refreshToken: 'r',
      refreshExpiresAt: 'y',
      accountId: 'acc',
      actorId: 'actor',
    });
    clearTokens();
    expect(sessionStorage.getItem('cb.access_token')).toBeNull();
    expect(sessionStorage.getItem('cb.refresh_token')).toBeNull();
  });
});
