import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateImage,
  synthesizeSpeech,
  MediaError,
  MediaErrorCode,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TTS_MODEL,
} from './media.js';
import { resetServerEnvForTests } from '../config.js';

/**
 * Media capability providers, exercised with a stubbed global fetch.
 * Env keys are dummy values; the assertions double as a leakage guard:
 * no error message may ever contain the provider key.
 */
const ORIGINAL_FETCH = globalThis.fetch;
const KEY = 'test-media-key-not-real';

function mockJsonFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function setMediaEnv(): void {
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  process.env.IMAGE_PROVIDER_URL = 'https://api.minimaxi.com/v1';
  process.env.IMAGE_PROVIDER_KEY = KEY;
  process.env.TTS_PROVIDER_URL = 'https://api.minimaxi.com/v1';
  process.env.TTS_PROVIDER_KEY = KEY;
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

beforeEach(() => {
  resetServerEnvForTests();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  for (const v of PROVIDER_ENV_VARS) delete process.env[v];
  resetServerEnvForTests();
  vi.restoreAllMocks();
});

describe('image generation provider', () => {
  it('throws not_configured without provider env', async () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
    await expect(generateImage({ prompt: 'a cat' })).rejects.toMatchObject({
      code: MediaErrorCode.NotConfigured,
    });
  });

  it('returns base64 images and sends the key only as a header', async () => {
    setMediaEnv();
    const fetchMock = mockJsonFetch(200, {
      data: { image_base64: 'QUJD' },
      base_resp: { status_code: 0 },
    });
    const res = await generateImage({ prompt: 'a cat', aspectRatio: '1:1' });
    expect(res.model).toBe(DEFAULT_IMAGE_MODEL);
    expect(res.images).toEqual([{ b64: 'QUJD' }]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(String(url)).toContain('image_generation');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${KEY}`);
  });

  it('falls back to image_urls when no base64 payload exists', async () => {
    setMediaEnv();
    mockJsonFetch(200, {
      data: { image_urls: ['https://cdn.example.com/img.png'] },
      base_resp: { status_code: 0 },
    });
    const res = await generateImage({ prompt: 'a cat' });
    expect(res.images).toEqual([{ url: 'https://cdn.example.com/img.png' }]);
  });

  it('maps provider business errors to upstream_error without body text', async () => {
    setMediaEnv();
    mockJsonFetch(200, {
      base_resp: { status_code: 1004, status_msg: 'invalid request' },
    });
    const err = await generateImage({ prompt: 'a cat' }).catch((e) => e);
    expect(err).toBeInstanceOf(MediaError);
    expect(err.code).toBe(MediaErrorCode.Upstream);
    expect(String(err.message)).not.toContain(KEY);
    expect(String(err.message)).not.toContain('invalid request');
  });

  it('maps HTTP 401/429 to unauthorized/rate_limited', async () => {
    setMediaEnv();
    mockJsonFetch(401, {});
    await expect(generateImage({ prompt: 'x' })).rejects.toMatchObject({
      code: MediaErrorCode.Unauthorized,
    });
    mockJsonFetch(429, {});
    await expect(generateImage({ prompt: 'x' })).rejects.toMatchObject({
      code: MediaErrorCode.RateLimited,
    });
  });

  it('maps missing image data to bad_response', async () => {
    setMediaEnv();
    mockJsonFetch(200, { base_resp: { status_code: 0 } });
    await expect(generateImage({ prompt: 'x' })).rejects.toMatchObject({
      code: MediaErrorCode.BadResponse,
    });
  });
});

describe('tts provider', () => {
  it('throws not_configured without provider env', async () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
    await expect(synthesizeSpeech({ text: '你好' })).rejects.toMatchObject({
      code: MediaErrorCode.NotConfigured,
    });
  });

  it('converts hex audio to base64 and reports duration', async () => {
    setMediaEnv();
    const fetchMock = mockJsonFetch(200, {
      data: { audio: '48656c6c6f' },
      extra_info: { audio_length: 1234 },
      base_resp: { status_code: 0 },
    });
    const res = await synthesizeSpeech({ text: '你好' });
    // hex 48656c6c6f = "Hello" -> base64 SGVsbG8=
    expect(res.audioBase64).toBe(Buffer.from('Hello').toString('base64'));
    expect(res.format).toBe('mp3');
    expect(res.durationMs).toBe(1234);
    expect(res.model).toBe(DEFAULT_TTS_MODEL);

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body)) as {
      text: string;
      voice_setting: { voice_id: string };
      audio_setting: { format: string };
    };
    expect(body.text).toBe('你好');
    expect(body.voice_setting.voice_id).toBeTruthy();
    expect(body.audio_setting.format).toBe('mp3');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${KEY}`);
  });

  it('honors a custom voice id from the request', async () => {
    setMediaEnv();
    const fetchMock = mockJsonFetch(200, {
      data: { audio: '00' },
      base_resp: { status_code: 0 },
    });
    await synthesizeSpeech({ text: 'hi', voiceId: 'male-qn-qingse' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body)) as {
      voice_setting: { voice_id: string };
    };
    expect(body.voice_setting.voice_id).toBe('male-qn-qingse');
  });

  it('maps missing audio to bad_response without leaking the key', async () => {
    setMediaEnv();
    mockJsonFetch(200, { base_resp: { status_code: 0 } });
    const err = await synthesizeSpeech({ text: '你好' }).catch((e) => e);
    expect(err).toBeInstanceOf(MediaError);
    expect(err.code).toBe(MediaErrorCode.BadResponse);
    expect(String(err.message)).not.toContain(KEY);
  });
});
