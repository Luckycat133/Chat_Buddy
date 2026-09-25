import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../db/index.js';
import { buildServer } from '../index.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';
import { seedSocialGraph } from '../test/fixtures.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import { toolExecutions } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Route-level coverage for the media capability endpoints: auth required,
 * stable error codes on failure, audit row per call, provider key never in
 * any response.
 */
const ORIGINAL_FETCH = globalThis.fetch;
let app: FastifyInstance;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
let accessToken: string;

function setBaseEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
}

const PROVIDER_ENV_VARS = [
  'IMAGE_PROVIDER_URL',
  'IMAGE_PROVIDER_KEY',
  'IMAGE_PROVIDER_MODEL',
  'TTS_PROVIDER_URL',
  'TTS_PROVIDER_KEY',
  'TTS_PROVIDER_MODEL',
  'TTS_PROVIDER_VOICE',
] as const;

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  setBaseEnv();
  resetServerEnvForTests();
  app = await buildServer({ db: db as unknown as Database, listen: false });
  const seed = await seedSocialGraph(db);
  const tokens = await issueTokens(db as unknown as Database, seed.accountId);
  accessToken = tokens.accessToken;
});

afterEach(async () => {
  globalThis.fetch = ORIGINAL_FETCH;
  for (const v of PROVIDER_ENV_VARS) delete process.env[v];
  resetServerEnvForTests();
  vi.restoreAllMocks();
  await app.close();
  await closeTestDatabase(pg);
});

/** Provider env must be set AFTER buildServer cached the env; drop the
 *  cache so the lazy resolveMediaEnv() rebuild sees the new variables. */
function setProviderEnv(vars: Record<string, string>): void {
  Object.assign(process.env, vars);
  resetServerEnvForTests();
}

async function post(
  url: string,
  body: Record<string, unknown>,
  authorized = true,
): Promise<{ statusCode: number; json: () => Record<string, unknown> }> {
  const res = await app.inject({
    method: 'POST',
    url,
    ...(authorized
      ? { headers: { authorization: `Bearer ${accessToken}` } }
      : {}),
    payload: body,
  });
  return { statusCode: res.statusCode, json: () => res.json() };
}

describe('POST /v1/capabilities/media/tts', () => {
  it('requires authentication', async () => {
    const res = await post('/v1/capabilities/media/tts', { text: '你好' }, false);
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns MEDIA_NOT_CONFIGURED (503) and audits the failed call', async () => {
    const res = await post('/v1/capabilities/media/tts', { text: '你好' });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatchObject({
      code: 'MEDIA_NOT_CONFIGURED',
      details: { capability: 'tts', reason: 'media_not_configured' },
    });
    const rows = await db.select().from(toolExecutions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.toolName).toBe('tts');
    expect(rows[0]!.permissionState).toBe('failed');
    expect(rows[0]!.arguments).toMatchObject({ textLength: 2 });
  });

  it('synthesizes speech, returns base64 mp3, and audits success', async () => {
    setProviderEnv({
      TTS_PROVIDER_URL: 'https://api.minimaxi.com/v1',
      TTS_PROVIDER_KEY: 'test-media-key-not-real',
    });
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: { audio: '48656c6c6f' },
          extra_info: { audio_length: 900 },
          base_resp: { status_code: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const res = await post('/v1/capabilities/media/tts', { text: '你好' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      audioBase64: Buffer.from('Hello').toString('base64'),
      format: 'mp3',
      durationMs: 900,
    });
    expect(JSON.stringify(res.json())).not.toContain('test-media-key-not-real');

    const rows = await db.select().from(toolExecutions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.permissionState).toBe('succeeded');
    expect(rows[0]!.sourceMetadata).toMatchObject({ provider: 'minimax' });
  });

  it('returns MEDIA_FAILURE (502) with a stable reason on provider errors', async () => {
    setProviderEnv({
      TTS_PROVIDER_URL: 'https://api.minimaxi.com/v1',
      TTS_PROVIDER_KEY: 'test-media-key-not-real',
    });
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ base_resp: { status_code: 1004 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const res = await post('/v1/capabilities/media/tts', { text: '你好' });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toMatchObject({
      code: 'MEDIA_FAILURE',
      details: { capability: 'tts', reason: 'media_upstream_error' },
    });
    const rows = await db.select().from(toolExecutions);
    expect(rows[0]!.permissionState).toBe('failed');
    expect(rows[0]!.result).toMatchObject({ error: 'media_upstream_error' });
  });

  it('validates the body (422 VALIDATION_FAILED)', async () => {
    const res = await post('/v1/capabilities/media/tts', {
      text: 'x'.repeat(2001),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('POST /v1/capabilities/media/image', () => {
  it('requires authentication', async () => {
    const res = await post(
      '/v1/capabilities/media/image',
      { prompt: 'a cat' },
      false,
    );
    expect(res.statusCode).toBe(401);
  });

  it('returns MEDIA_NOT_CONFIGURED (503) when unconfigured', async () => {
    const res = await post('/v1/capabilities/media/image', { prompt: 'a cat' });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatchObject({
      code: 'MEDIA_NOT_CONFIGURED',
      details: { capability: 'image' },
    });
  });

  it('generates an image and audits success', async () => {
    setProviderEnv({
      IMAGE_PROVIDER_URL: 'https://api.minimaxi.com/v1',
      IMAGE_PROVIDER_KEY: 'test-media-key-not-real',
    });
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: { image_base64: 'QUJD' },
          base_resp: { status_code: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const res = await post('/v1/capabilities/media/image', {
      prompt: 'a cat in a garden',
      aspectRatio: '4:3',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      images: [{ b64: 'QUJD' }],
    });
    expect(JSON.stringify(res.json())).not.toContain('test-media-key-not-real');

    const rows = await db.select().from(toolExecutions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.toolName).toBe('image_generation');
    expect(rows[0]!.permissionState).toBe('succeeded');
    expect(rows[0]!.arguments).toMatchObject({
      prompt: 'a cat in a garden',
      aspectRatio: '4:3',
    });
  });

  it('rejects invalid aspect ratios (422)', async () => {
    const res = await post('/v1/capabilities/media/image', {
      prompt: 'a cat',
      aspectRatio: '21:9',
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('audit trail', () => {
  it('keeps audit rows queryable per actor and tool', async () => {
    setProviderEnv({
      TTS_PROVIDER_URL: 'https://api.minimaxi.com/v1',
      TTS_PROVIDER_KEY: 'test-media-key-not-real',
    });
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: { audio: '00' },
          base_resp: { status_code: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;
    await post('/v1/capabilities/media/tts', { text: 'hi' });
    const [row] = await db
      .select()
      .from(toolExecutions)
      .where(eq(toolExecutions.toolName, 'tts'));
    expect(row).toBeTruthy();
    expect(row!.completedAt).toBeTruthy();
    expect(row!.result).toMatchObject({ format: 'mp3' });
  });
});
