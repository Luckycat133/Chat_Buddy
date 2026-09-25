import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildServer } from '../index.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';
import { seedSocialGraph } from '../test/fixtures.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import { actorCapabilitySettings, toolExecutions } from '../../db/schema.js';
import type { Database } from '../../db/index.js';

/**
 * Friend capabilities API gaps (WEB_IMPLEMENTATION §19, §23 P1):
 * - weather: consent-gated approximate location, default city persisted;
 * - calendar: demo provider connect; only a connected provider response
 *   can mark a proposed write completed;
 * - settings: consent state readable for the Settings UI.
 */
let app: FastifyInstance;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
let token: string;

const auth = { authorization: `Bearer ${''}` };

function setBaseEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
  // No provider env: weather/search fail with TOOL_FAILURE (502), which is
  // the truthful "provider not configured" path; persistence still works.
  delete process.env.WEATHER_PROVIDER_URL;
  delete process.env.WEATHER_PROVIDER_KEY;
  delete process.env.SEARCH_PROVIDER_URL;
  delete process.env.SEARCH_PROVIDER_KEY;
}

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  setBaseEnv();
  resetServerEnvForTests();
  app = await buildServer({ db: db as unknown as Database, listen: false });
  const seed = await seedSocialGraph(db);
  const tokens = await issueTokens(db as unknown as Database, seed.accountId);
  (auth as { authorization: string }).authorization = `Bearer ${tokens.accessToken}`;
});

afterEach(async () => {
  resetServerEnvForTests();
  await app.close();
  await closeTestDatabase(pg);
});

describe('weather settings and consent', () => {
  it('refuses approximate location without the user-gesture consent flag', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/weather',
      headers: auth,
      payload: { location: { lat: 31.23, lon: 121.47 } },
    });
    expect(res.statusCode).toBe(422);
  });

  it('requires city or location', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/weather',
      headers: auth,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it('persists the selected default city and coarse consented location', async () => {
    // Provider is not configured -> 502, but the default city is still
    // recorded before the provider call, because the user made a choice.
    const res = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/weather',
      headers: auth,
      payload: { city: '上海' },
    });
    expect([200, 502]).toContain(res.statusCode);
    const settings = await app.inject({
      method: 'GET',
      url: '/v1/capabilities/settings',
      headers: auth,
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().weatherCity).toBe('上海');
    expect(settings.json().weatherConsent).toBe(false);

    // Consented approximate location updates the stored coarse fix.
    await app.inject({
      method: 'POST',
      url: '/v1/capabilities/weather',
      headers: auth,
      payload: {
        city: '上海',
        location: { lat: 31.2304, lon: 121.4737 },
        consent: true,
      },
    });
    const [row] = await db
      .select()
      .from(actorCapabilitySettings)
      .where(eq(actorCapabilitySettings.weatherCity, '上海'));
    expect(row?.weatherConsentAt).toBeTruthy();
    // One-decimal coarse precision (~11 km), never the raw device fix.
    expect(row?.weatherLocationLat).toBe(31.2);
    expect(row?.weatherLocationLon).toBe(121.5);
  });
});

describe('calendar connect and confirmed writes', () => {
  it('marks a write complete only after connect plus explicit confirmation', async () => {
    // 1. Propose a create: AwaitingConfirmation envelope, nothing done.
    const proposed = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/calendar/propose',
      headers: auth,
      payload: {
        operation: 'create',
        title: '面试',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    expect(proposed.statusCode).toBe(200);
    const { toolExecutionId, requiresConfirmation } = proposed.json();
    expect(requiresConfirmation).toBe(true);

    // 2. Confirming before connect is refused: only a connected provider
    //    response can mark completion.
    const early = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/calendar/result',
      headers: auth,
      payload: { toolExecutionId, result: { ok: true, eventId: 'evt-1' } },
    });
    expect(early.statusCode).toBe(403);

    // 3. Connect the demo provider, then confirm; the execution completes.
    const connect = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/calendar/connect',
      headers: auth,
      payload: { provider: 'demo' },
    });
    expect(connect.statusCode).toBe(200);

    const done = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/calendar/result',
      headers: auth,
      payload: { toolExecutionId, result: { ok: true, eventId: 'evt-1' } },
    });
    expect(done.statusCode).toBe(200);
    expect(done.json().permissionState).toBe('succeeded');

    const [exec] = await db
      .select()
      .from(toolExecutions)
      .where(eq(toolExecutions.id, toolExecutionId));
    expect(exec?.permissionState).toBe('succeeded');
    expect(exec?.completedAt).toBeTruthy();

    // 4. A second confirmation attempt is a conflict, not a silent replay.
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/calendar/result',
      headers: auth,
      payload: { toolExecutionId, result: { ok: true } },
    });
    expect(replay.statusCode).toBe(409);
  });

  it('records a structured failure when the confirmed write fails', async () => {
    const proposed = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/calendar/propose',
      headers: auth,
      payload: { operation: 'delete', eventId: 'evt-x' },
    });
    const { toolExecutionId } = proposed.json();
    await app.inject({
      method: 'POST',
      url: '/v1/capabilities/calendar/connect',
      headers: auth,
      payload: { provider: 'demo' },
    });
    const done = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/calendar/result',
      headers: auth,
      payload: { toolExecutionId, result: { ok: false, reason: 'not_found' } },
    });
    expect(done.json().permissionState).toBe('failed');
  });

  it('settings reflect the connected calendar provider', async () => {
    const before = await app.inject({
      method: 'GET',
      url: '/v1/capabilities/settings',
      headers: auth,
    });
    expect(before.json().calendarProvider).toBeNull();
    await app.inject({
      method: 'POST',
      url: '/v1/capabilities/calendar/connect',
      headers: auth,
      payload: { provider: 'demo' },
    });
    const after = await app.inject({
      method: 'GET',
      url: '/v1/capabilities/settings',
      headers: auth,
    });
    expect(after.json().calendarProvider).toBe('demo');
    expect(after.json().calendarConnectedAt).toBeTruthy();
  });
});

describe('weather consent toggle endpoint', () => {
  it('persists consent and default city without calling any provider', async () => {
    const enable = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/settings',
      headers: auth,
      payload: { weatherConsent: true, weatherCity: '北京' },
    });
    expect(enable.statusCode).toBe(200);

    const settings = await app.inject({
      method: 'GET',
      url: '/v1/capabilities/settings',
      headers: auth,
    });
    expect(settings.json()).toMatchObject({
      weatherConsent: true,
      weatherCity: '北京',
    });

    // Pure consent write: no provider configured, still succeeds — and no
    // tool_executions row is created (nothing was executed).
    const rows = await db.select().from(toolExecutions);
    expect(rows).toHaveLength(0);
  });

  it('clears the stored gesture when consent is withheld, keeping the city', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/capabilities/settings',
      headers: auth,
      payload: { weatherConsent: true, weatherCity: '北京' },
    });
    const disable = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/settings',
      headers: auth,
      payload: { weatherConsent: false },
    });
    expect(disable.statusCode).toBe(200);

    // The consent gesture is really gone in the DB, the city choice stays.
    const [row] = await db
      .select()
      .from(actorCapabilitySettings)
      .where(eq(actorCapabilitySettings.weatherCity, '北京'));
    expect(row?.weatherConsentAt).toBeNull();
    expect(row?.weatherCity).toBe('北京');

    const settings = await app.inject({
      method: 'GET',
      url: '/v1/capabilities/settings',
      headers: auth,
    });
    expect(settings.json().weatherConsent).toBe(false);
    expect(settings.json().weatherCity).toBe('北京');
  });

  it('rejects an empty update', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/capabilities/settings',
      headers: auth,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });
});
