/**
 * Typed cloud client. The Web frontend speaks to the host via this
 * surface only. Authorization is never client-mediated for visibility;
 * any 4xx with a stable error code (see shared/contracts/errors.ts) means
 * the server has already authorized.
 */
import { z } from 'zod';
import {
  ApiErrorSchema,
  MessageSchema,
  SyncEnvelopeSchema,
  type ApiError,
  type Message,
  type SyncEnvelope,
} from '../../shared/contracts/index.js';
import type {
  Account,
  Actor,
  CharacterActor,
  PersonaTemplate,
} from '../../shared/contracts/index.js';

const ActorListItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['human', 'character']),
  publicName: z.string(),
  avatarAssetId: z.string().uuid().nullable(),
  templateId: z.string().uuid().nullable(),
  status: z.enum(['active', 'unavailable', 'blocked', 'retired']),
});
const ActorListSchema = z.object({ items: z.array(ActorListItemSchema) });
const ActorDetailSchema = z.object({
  actor: z.object({
    id: z.string().uuid(),
    type: z.enum(['human', 'character']),
    publicName: z.string(),
    avatarAssetId: z.string().uuid().nullable(),
    templateId: z.string().uuid().nullable(),
    status: z.enum(['active', 'unavailable', 'blocked', 'retired']),
  }),
  character: z.unknown().nullable(),
  template: z.unknown().nullable(),
});
const HealthSchema = z.object({ ok: z.boolean() });
const ReadySchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
});
const MessageListSchema = z.object({ items: z.array(MessageSchema) });
const SendMessageResultSchema = z.object({
  id: z.string().uuid(),
  sequence: z.number().int().min(0),
});
const ImageGenerationResultSchema = z.object({
  images: z.array(z.string().min(1)).min(1),
  model: z.string().min(1),
});
const SpeechSynthesisResultSchema = z.object({
  audioBase64: z.string().min(1),
  format: z.string().min(1),
  model: z.string().min(1),
  durationMs: z.number().int().nonnegative().optional(),
});

export interface CloudClientOptions {
  baseUrl: string;
  getAccessToken: () => string | null;
  /** Optional fetch override (for tests). */
  fetchImpl?: typeof fetch;
}

export class CloudClient {
  readonly baseUrl: string;
  readonly getAccessToken: () => string | null;
  readonly fetchImpl: typeof fetch;

  constructor(opts: CloudClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.getAccessToken = opts.getAccessToken;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  async health(): Promise<{ ok: boolean }> {
    return this.request('/healthz', { method: 'GET', auth: false }, HealthSchema);
  }

  async ready(): Promise<{ ok: boolean; reason?: string }> {
    return this.request('/readyz', { method: 'GET', auth: false }, ReadySchema);
  }

  async listActors(): Promise<ActorListItem[]> {
    const body = await this.request(
      '/v1/actors',
      { method: 'GET' },
      ActorListSchema,
    );
    return body.items;
  }

  async getActor(actorId: string): Promise<{
    actor: Actor;
    character: CharacterActor | null;
    template: PersonaTemplate | null;
  }> {
    const body = await this.request(
      `/v1/actors/${encodeURIComponent(actorId)}`,
      { method: 'GET' },
      ActorDetailSchema,
    );
    return {
      actor: body.actor as Actor,
      character: (body.character as CharacterActor | null) ?? null,
      template: (body.template as PersonaTemplate | null) ?? null,
    };
  }

  async deltaSync(cursor: string | null): Promise<SyncEnvelope> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.request(
      `/v1/sync${qs}`,
      { method: 'GET' },
      SyncEnvelopeSchema,
    );
  }

  async getMessages(
    conversationId: string,
    options: { cursor?: number; limit?: number } = {},
  ): Promise<{ items: Message[] }> {
    const params = new URLSearchParams();
    if (options.cursor !== undefined) {
      params.set('cursor', String(options.cursor));
    }
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return this.request(
      `/v1/conversations/${encodeURIComponent(conversationId)}/messages${suffix}`,
      { method: 'GET' },
      MessageListSchema,
    );
  }

  async sendMessage(
    conversationId: string,
    body: {
      clientIdempotencyKey: string;
      kind: 'text' | 'image' | 'system' | 'invitation' | 'action_result';
      content: string;
      replyToMessageId?: string;
    },
  ): Promise<{ id: string; sequence: number }> {
    return this.request(
      `/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'POST', body },
      SendMessageResultSchema,
    );
  }

  async generateImage(input: {
    prompt: string;
    aspectRatio?: '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
  }): Promise<{ images: string[]; model: string }> {
    return this.request(
      '/v1/capabilities/media/image',
      { method: 'POST', body: input },
      ImageGenerationResultSchema,
    );
  }

  async synthesizeSpeech(input: {
    text: string;
    voiceId?: string;
  }): Promise<{
    audioBase64: string;
    format: string;
    model: string;
    durationMs?: number;
  }> {
    return this.request(
      '/v1/capabilities/media/tts',
      { method: 'POST', body: input },
      SpeechSynthesisResultSchema,
    );
  }

  /* ---------------------------- internal helpers --------------------------- */

  private async request<T>(
    path: string,
    init: { method: string; body?: unknown; auth?: boolean },
    schema: z.ZodType<T>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
    };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (init.auth !== false) {
      const token = this.getAccessToken();
      if (token) headers.authorization = `Bearer ${token}`;
    }
    const res = await this.fetchImpl(this.baseUrl + path, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'include',
    });
    const text = await res.text();
    const json: unknown = text.length > 0 ? safeJsonParse(text) : undefined;

    if (!res.ok) {
      const parsed = ApiErrorSchema.safeParse(json);
      const apiError: ApiError = parsed.success
        ? parsed.data
        : {
            error: {
              code: 'INTERNAL',
              message: `Unexpected status ${res.status}`,
              requestId: res.headers.get('x-request-id') ?? '',
            },
          };
      throw new CloudRequestError(apiError, res.status);
    }
    return schema.parse(json);
  }
}

interface ActorListItem {
  id: string;
  type: 'human' | 'character';
  publicName: string;
  avatarAssetId: string | null;
  templateId: string | null;
  status: 'active' | 'unavailable' | 'blocked' | 'retired';
}

export class CloudRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;
  readonly details: Record<string, unknown> | undefined;
  constructor(envelope: ApiError, status: number) {
    super(envelope.error.message);
    this.name = 'CloudRequestError';
    this.code = envelope.error.code;
    this.status = status;
    this.requestId = envelope.error.requestId;
    this.details = envelope.error.details;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Convenience: build a default client reading the access token from sessionStorage. */
export function buildBrowserClient(baseUrl: string): CloudClient {
  return new CloudClient({
    baseUrl,
    getAccessToken: () => {
      try {
        return sessionStorage.getItem('cb.access_token');
      } catch {
        return null;
      }
    },
  });
}

// Account is exported to keep tree-shake honest for downstream consumers.
export type { Account };
