import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChatCompletion,
  DEFAULT_GATEWAY_MODEL,
  ModelGatewayError,
  ModelGatewayErrorCode,
} from './model-gateway.js';
import { parseReplyContent } from './generation.js';
import { resetServerEnvForTests } from '../config.js';

/**
 * Gateway client is exercised with a stubbed global fetch; env vars are
 * set per-test and never contain real credentials.
 */
const ORIGINAL_FETCH = globalThis.fetch;

function mockFetchOnce(status: number, body: unknown): void {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

function setGatewayEnv(url = 'https://openrouter.ai/api/v1'): void {
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  process.env.MODEL_GATEWAY_URL = url;
  process.env.MODEL_GATEWAY_KEY = 'test-key-not-real';
  process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
}

function clearGatewayEnv(): void {
  delete process.env.MODEL_GATEWAY_URL;
  delete process.env.MODEL_GATEWAY_KEY;
}

beforeEach(() => {
  resetServerEnvForTests();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  clearGatewayEnv();
  resetServerEnvForTests();
  vi.restoreAllMocks();
});

describe('model gateway client', () => {
  it('throws not_configured without gateway env', async () => {
    clearGatewayEnv();
    // serverEnv validates the whole env; provide valid base vars.
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
    await expect(
      createChatCompletion({ model: DEFAULT_GATEWAY_MODEL, prompt: 'hi' }),
    ).rejects.toMatchObject({
      code: ModelGatewayErrorCode.NotConfigured,
    });
  });

  it('returns content on success', async () => {
    setGatewayEnv();
    mockFetchOnce(200, {
      model: 'test/model',
      choices: [{ message: { content: 'hello there' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    const res = await createChatCompletion({
      model: 'test/model',
      prompt: 'say hi',
      system: 'be brief',
    });
    expect(res.content).toBe('hello there');
    expect(res.model).toBe('test/model');
    expect(res.usage?.completionTokens).toBe(5);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as unknown as [string, RequestInit];
    const headers = call[1].headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-key-not-real');
    expect(JSON.parse(call[1].body as string).messages).toHaveLength(2);
  });

  it('maps 401 to unauthorized and 429 to rate_limited', async () => {
    setGatewayEnv();
    mockFetchOnce(401, {});
    await expect(
      createChatCompletion({ model: 'm', prompt: 'p' }),
    ).rejects.toMatchObject({ code: ModelGatewayErrorCode.Unauthorized });
    mockFetchOnce(429, {});
    await expect(
      createChatCompletion({ model: 'm', prompt: 'p' }),
    ).rejects.toMatchObject({ code: ModelGatewayErrorCode.RateLimited });
  });

  it('maps empty choices to bad_response', async () => {
    setGatewayEnv();
    mockFetchOnce(200, { choices: [] });
    await expect(
      createChatCompletion({ model: 'm', prompt: 'p' }),
    ).rejects.toMatchObject({ code: ModelGatewayErrorCode.BadResponse });
  });

  it('retries transient empty content then succeeds', async () => {
    setGatewayEnv();
    // First attempts return HTTP 200 with no content (observed on free
    // tier upstreams), then a good payload arrives.
    const responses = [
      { choices: [{ message: { content: null } }] },
      { choices: [{ message: { content: 'recovered reply' } }] },
    ];
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(responses.shift() ?? {}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const res = await createChatCompletion({ model: 'm', prompt: 'p' });
    expect(res.content).toBe('recovered reply');
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('does not retry unauthorized errors', async () => {
    setGatewayEnv();
    mockFetchOnce(401, {});
    await expect(
      createChatCompletion({ model: 'm', prompt: 'p' }),
    ).rejects.toMatchObject({ code: ModelGatewayErrorCode.Unauthorized });
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});

describe('reply envelope parser', () => {
  it('parses a JSON envelope with messages', () => {
    const texts = parseReplyContent(
      `{"messages":[{"text":"hey!"},{"text":"what's up"}]}`,
    );
    expect(texts).toEqual(['hey!', "what's up"]);
  });

  it('parses a fenced JSON envelope', () => {
    const texts = parseReplyContent(
      '```json\n{"messages":["a","b"]}\n```',
    );
    expect(texts).toEqual(['a', 'b']);
  });

  it('falls back to plain text', () => {
    expect(parseReplyContent('just chatting')).toEqual(['just chatting']);
  });

  it('splits blank-line paragraphs into separate bubbles', () => {
    const texts = parseReplyContent('我是初音未来呀！\n\n专门负责把快乐用音符包装好！\n\n你是新认识的朋友吗？');
    expect(texts).toEqual(['我是初音未来呀！', '专门负责把快乐用音符包装好！', '你是新认识的朋友吗？']);
  });

  it('splits one long wall of text at sentence boundaries', () => {
    const text = '我是初音未来呀！世界最可爱的虚拟歌姬～专门负责把快乐用音符包装好送到大家耳朵里的！你是新认识的朋友吗？快来听听我的歌吧！';
    const texts = parseReplyContent(text);
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.length).toBeLessThanOrEqual(3);
    expect(texts.join('')).toContain('世界最可爱的虚拟歌姬～');
  });

  it('keeps short replies as a single bubble', () => {
    expect(parseReplyContent('好呀！什么时候？')).toEqual(['好呀！什么时候？']);
  });
});

describe('reply envelope parser (content field)', () => {
  it('accepts {content} message entries', () => {
    const texts = parseReplyContent(
      '{"messages":[{"content":"你好，小幸！","speaker":"Mira"}]}',
    );
    expect(texts).toEqual(['你好，小幸！']);
  });
});

describe('json mode request shape', () => {
  it('sends response_format json_object by default', async () => {
    process.env.MODEL_GATEWAY_URL = 'https://openrouter.ai/api/v1';
    process.env.MODEL_GATEWAY_KEY = 'test-key-not-real';
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.SESSION_SIGNING_KEY = 'x'.repeat(32);
    resetServerEnvForTests();
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{}' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;
    await createChatCompletion({ model: 'm', prompt: 'p' });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.provider).toEqual({ require_parameters: true });
  });
});

describe('echo suppression', () => {
  it('drops replies duplicating burst content', async () => {
    const { filterEchoedReplies } = await import('./generation.js');
    const texts = [
      '我叫小幸，最近在准备一场考试压力有点大',
      '小幸你好呀，我是Mira。备考辛苦了！',
    ];
    const burst = ['我叫小幸，最近在准备一场考试压力有点大'];
    expect(filterEchoedReplies(texts, burst)).toEqual([
      '小幸你好呀，我是Mira。备考辛苦了！',
    ]);
  });
  it('keeps all when nothing echoes', async () => {
    const { filterEchoedReplies } = await import('./generation.js');
    expect(filterEchoedReplies(['a', 'b'], [])).toEqual(['a', 'b']);
  });
});

describe('reply envelope parser (message field)', () => {
  it('falls back to top-level message when messages[] is empty', async () => {
    const { parseReplyContent } = await import('./generation.js');
    const raw =
      '{"messages":[{"role":"system","role_name":"","content":"","model":""}],"message":"明白，不问了。茶凉了可以再续。","memory_patches":[]}';
    expect(parseReplyContent(raw)).toEqual(['明白，不问了。茶凉了可以再续。']);
  });
});

describe('tool calling support', () => {
  it('forwards tools and suppresses json mode when tools are present', async () => {
    setGatewayEnv();
    mockFetchOnce(200, {
      choices: [{ message: { content: 'ok' } }],
    });
    const tools = [
      {
        type: 'function',
        function: {
          name: 'send_message',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
    ];
    await createChatCompletion({ model: 'm', prompt: 'p', tools });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.tools).toEqual(tools);
    expect(body.tool_choice).toBe('auto');
    expect(body.response_format).toBeUndefined();
  });

  it('returns native tool calls even when content is empty', async () => {
    setGatewayEnv();
    mockFetchOnce(200, {
      model: 'test/model',
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'send_message',
                  arguments: '{"text":"嗨","send_delay_ms":800}',
                },
              },
            ],
          },
        },
      ],
    });
    const res = await createChatCompletion({ model: 'm', prompt: 'p' });
    expect(res.content).toBe('');
    expect(res.toolCalls).toEqual([
      {
        id: 'call_1',
        name: 'send_message',
        arguments: '{"text":"嗨","send_delay_ms":800}',
      },
    ]);
  });

  it('types a content-less 200 as empty_response (retryable at caller)', async () => {
    setGatewayEnv();
    mockFetchOnce(200, { choices: [{ message: { content: '' } }] });
    await expect(
      createChatCompletion({ model: 'm', prompt: 'p' }),
    ).rejects.toMatchObject({ code: ModelGatewayErrorCode.EmptyResponse });
  });
});
