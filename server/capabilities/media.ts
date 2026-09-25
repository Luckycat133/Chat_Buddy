/**
 * Media capability providers (image generation + TTS) per DOMAIN_ARCHITECTURE
 * §11 and WEB_IMPLEMENTATION §19.
 *
 * Provider is MiniMax-compatible (legacy client contract):
 *   TTS   POST {TTS_PROVIDER_URL}/t2a_v2           (hex audio, mp3)
 *   Image POST {IMAGE_PROVIDER_URL}/image_generation (base64 or urls)
 *
 * Hosted credentials live only in server env (`TTS_PROVIDER_KEY` /
 * `IMAGE_PROVIDER_KEY`); keys are never logged, never returned, and never
 * embedded in error messages (errors carry stable codes + status numbers).
 * Failures surface as typed `MediaError` so callers branch on codes,
 * never on English text.
 */

export const MediaErrorCode = {
  NotConfigured: 'media_not_configured',
  Unauthorized: 'media_unauthorized',
  RateLimited: 'media_rate_limited',
  Upstream: 'media_upstream_error',
  Timeout: 'media_timeout',
  BadResponse: 'media_bad_response',
} as const;
export type MediaErrorCode =
  (typeof MediaErrorCode)[keyof typeof MediaErrorCode];

export class MediaError extends Error {
  readonly code: MediaErrorCode;
  readonly status?: number;

  constructor(code: MediaErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'MediaError';
    this.code = code;
    this.status = status;
  }
}

/** Models used when the provider MODEL env vars are not set. */
export const DEFAULT_IMAGE_MODEL = 'image-01';
export const DEFAULT_TTS_MODEL = 'speech-2.8-hd';
export const DEFAULT_TTS_VOICE = 'female-chengshu';

const PROVIDER_TIMEOUT_MS = 60_000;
/** API hard limit is 10000 chars; stay well inside it. */
export const MAX_TTS_TEXT_LENGTH = 2000;
/** MiniMax image prompt limit is 1500 chars. */
export const MAX_IMAGE_PROMPT_LENGTH = 1500;

export const IMAGE_ASPECT_RATIOS = [
  '16:9',
  '4:3',
  '1:1',
  '3:4',
  '9:16',
] as const;
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
}

export interface GeneratedImage {
  /** Base64 payload when the provider returned `response_format: base64`. */
  b64?: string;
  /** Provider URL fallback (expires; clients should not treat as durable). */
  url?: string;
}

export interface ImageGenerationResult {
  model: string;
  images: GeneratedImage[];
}

export interface TtsRequest {
  text: string;
  voiceId?: string;
}

export interface TtsResult {
  model: string;
  format: 'mp3';
  /** MP3 bytes, base64-encoded (provider returns hex on the wire). */
  audioBase64: string;
  durationMs?: number;
}

interface MediaEnv {
  IMAGE_PROVIDER_URL?: string;
  IMAGE_PROVIDER_KEY?: string;
  IMAGE_PROVIDER_MODEL?: string;
  TTS_PROVIDER_URL?: string;
  TTS_PROVIDER_KEY?: string;
  TTS_PROVIDER_MODEL?: string;
  TTS_PROVIDER_VOICE?: string;
}

/** Lazy env import avoids a config cycle in tests that stub fetch. */
async function resolveMediaEnv(): Promise<MediaEnv> {
  const { serverEnv } = await import('../config.js');
  return serverEnv() as unknown as MediaEnv;
}

function providerUrl(baseUrl: string, path: string): URL {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path, normalized);
}

/**
 * Shared provider POST. Returns parsed JSON on HTTP 200 with
 * `base_resp.status_code === 0` (MiniMax business-code convention).
 * Error messages intentionally exclude response bodies and credentials.
 */
async function providerPost(
  capability: 'image' | 'tts',
  url: URL,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new MediaError(
        MediaErrorCode.Timeout,
        `media ${capability} request timed out`,
      );
    }
    throw new MediaError(
      MediaErrorCode.Upstream,
      `media ${capability} request failed`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new MediaError(
      MediaErrorCode.Unauthorized,
      `media ${capability} rejected credentials`,
      res.status,
    );
  }
  if (res.status === 429) {
    throw new MediaError(
      MediaErrorCode.RateLimited,
      `media ${capability} rate limited`,
      res.status,
    );
  }
  if (!res.ok) {
    throw new MediaError(
      MediaErrorCode.Upstream,
      `media ${capability} returned HTTP ${res.status}`,
      res.status,
    );
  }

  let body_: Record<string, unknown>;
  try {
    body_ = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new MediaError(
      MediaErrorCode.BadResponse,
      `media ${capability} returned invalid JSON`,
      res.status,
    );
  }

  const baseResp = body_.base_resp as { status_code?: number } | undefined;
  if (baseResp && typeof baseResp.status_code === 'number' && baseResp.status_code !== 0) {
    throw new MediaError(
      MediaErrorCode.Upstream,
      `media ${capability} provider status ${baseResp.status_code}`,
      res.status,
    );
  }
  return body_;
}

function hexToBase64(hex: string): string {
  const clean = hex.trim();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return Buffer.from(bytes).toString('base64');
}

/* -------------------------------------------------------------------------- */
/*                             image generation                                */
/* -------------------------------------------------------------------------- */

export async function generateImage(
  request: ImageGenerationRequest,
): Promise<ImageGenerationResult> {
  const env = await resolveMediaEnv();
  if (!env.IMAGE_PROVIDER_URL || !env.IMAGE_PROVIDER_KEY) {
    throw new MediaError(
      MediaErrorCode.NotConfigured,
      'image generation is not configured',
    );
  }

  const model = env.IMAGE_PROVIDER_MODEL || DEFAULT_IMAGE_MODEL;
  const body = await providerPost(
    'image',
    providerUrl(env.IMAGE_PROVIDER_URL, 'image_generation'),
    env.IMAGE_PROVIDER_KEY,
    {
      model,
      prompt: request.prompt.slice(0, MAX_IMAGE_PROMPT_LENGTH),
      aspect_ratio: request.aspectRatio ?? '1:1',
      // URLs expire after 24h; base64 keeps the result renderable offline.
      response_format: 'base64',
      n: 1,
      prompt_optimizer: true,
    },
  );

  const data = body.data as
    | { image_base64?: unknown; image_urls?: unknown }
    | undefined;
  const images: GeneratedImage[] = [];
  const b64 = data?.image_base64;
  if (typeof b64 === 'string' && b64.trim()) {
    images.push({ b64: b64.trim() });
  } else if (Array.isArray(b64)) {
    for (const entry of b64) {
      if (typeof entry === 'string' && entry.trim()) {
        images.push({ b64: entry.trim() });
      }
    }
  }
  if (images.length === 0 && Array.isArray(data?.image_urls)) {
    for (const entry of data!.image_urls as unknown[]) {
      if (typeof entry === 'string' && entry.trim()) {
        images.push({ url: entry.trim() });
      }
    }
  }
  if (images.length === 0) {
    throw new MediaError(
      MediaErrorCode.BadResponse,
      'image generation returned no image data',
    );
  }
  return { model, images };
}

/* -------------------------------------------------------------------------- */
/*                                     TTS                                    */
/* -------------------------------------------------------------------------- */

export async function synthesizeSpeech(
  request: TtsRequest,
): Promise<TtsResult> {
  const env = await resolveMediaEnv();
  if (!env.TTS_PROVIDER_URL || !env.TTS_PROVIDER_KEY) {
    throw new MediaError(
      MediaErrorCode.NotConfigured,
      'text-to-speech is not configured',
    );
  }

  const model = env.TTS_PROVIDER_MODEL || DEFAULT_TTS_MODEL;
  const voiceId = request.voiceId?.trim() || env.TTS_PROVIDER_VOICE || DEFAULT_TTS_VOICE;
  const body = await providerPost(
    'tts',
    providerUrl(env.TTS_PROVIDER_URL, 't2a_v2'),
    env.TTS_PROVIDER_KEY,
    {
      model,
      text: request.text.slice(0, MAX_TTS_TEXT_LENGTH),
      stream: false,
      output_format: 'hex',
      voice_setting: {
        voice_id: voiceId,
        speed: 1.0,
        vol: 1.0,
        pitch: 0,
        emotion: 'calm',
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
    },
  );

  const data = body.data as { audio?: unknown } | undefined;
  const hexAudio = data?.audio;
  if (typeof hexAudio !== 'string' || hexAudio.trim().length === 0) {
    throw new MediaError(
      MediaErrorCode.BadResponse,
      'text-to-speech returned no audio data',
    );
  }
  const extraInfo = body.extra_info as { audio_length?: unknown } | undefined;
  const durationMs =
    typeof extraInfo?.audio_length === 'number' ? extraInfo.audio_length : undefined;

  return {
    model,
    format: 'mp3',
    audioBase64: hexToBase64(hexAudio),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}
