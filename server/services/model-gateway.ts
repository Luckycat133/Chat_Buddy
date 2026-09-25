/**
 * Model gateway client per DOMAIN_ARCHITECTURE §11.
 *
 * Provider is OpenRouter-compatible (`POST {url}/chat/completions`).
 * Hosted credentials live only in server env (`MODEL_GATEWAY_URL` /
 * `MODEL_GATEWAY_KEY`); the key is never logged and never returned.
 * Failures surface as typed `ModelGatewayError` with stable codes so
 * callers branch on codes, never on English text.
 */

export const ModelGatewayErrorCode = {
  NotConfigured: 'model_gateway_not_configured',
  Unauthorized: 'model_gateway_unauthorized',
  RateLimited: 'model_gateway_rate_limited',
  Upstream: 'model_gateway_upstream_error',
  Timeout: 'model_gateway_timeout',
  BadResponse: 'model_gateway_bad_response',
  /** HTTP 200 but the message carried neither content nor tool calls
   *  (observed ~12% on free-tier upstreams). Typed so the generation
   *  layer can run its one raised-budget retry instead of failing the
   *  turn silently. */
  EmptyResponse: 'model_gateway_empty_response',
} as const;
export type ModelGatewayErrorCode =
  (typeof ModelGatewayErrorCode)[keyof typeof ModelGatewayErrorCode];

export class ModelGatewayError extends Error {
  readonly code: ModelGatewayErrorCode;
  readonly status?: number;

  constructor(code: ModelGatewayErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ModelGatewayError';
    this.code = code;
    this.status = status;
  }
}

export interface ChatCompletionRequest {
  model: string;
  /** Full prompt text sent as the user message. */
  prompt: string;
  /** Optional system preamble (persona + policy). */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** OpenAI-shaped tool definitions (e.g. `send_message`). Forwarded
   *  verbatim; when present, JSON mode is suppressed because
   *  `response_format: json_object` and tool calling are mutually
   *  exclusive on OpenAI-compatible providers. */
  tools?: ReadonlyArray<unknown>;
}

/** One provider tool call parsed off `message.tool_calls`. */
export interface ChatCompletionToolCall {
  id: string | null;
  name: string;
  /** Raw JSON arguments string exactly as the provider sent it. */
  arguments: string;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  /** Native tool calls when the model invoked a tool instead of (or
   *  alongside) writing content. Empty/absent for plain replies. */
  toolCalls?: Array<ChatCompletionToolCall>;
  /** Provider-reported token usage when available. */
  usage?: { promptTokens: number; completionTokens: number };
}

interface OpenRouterToolCall {
  id?: string | null;
  type?: string;
  function?: { name?: string | null; arguments?: string | null };
}

interface OpenRouterChoiceMessage {
  content?: string | null;
  tool_calls?: OpenRouterToolCall[] | null;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: OpenRouterChoiceMessage }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Strip <think>…</think> reasoning blocks some models inline. */
function stripReasoning(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null;
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
}

/** Model id used when `MODEL_GATEWAY_MODEL` is not set. */
export const DEFAULT_GATEWAY_MODEL = 'openrouter/auto';

/**
 * Transient gateway failures worth retrying: free-tier upstreams
 * (e.g. nemotron :free) intermittently answer HTTP 200 with an empty
 * message, and flaky networks surface as connection resets. Errors that
 * are deterministic (not configured, unauthorized, rate limited) are
 * never retried.
 */
const TRANSIENT_GATEWAY_CODES: ReadonlySet<ModelGatewayErrorCode> = new Set([
  ModelGatewayErrorCode.BadResponse,
  ModelGatewayErrorCode.EmptyResponse,
  ModelGatewayErrorCode.Timeout,
  ModelGatewayErrorCode.Upstream,
]);

const MAX_GATEWAY_ATTEMPTS = 3;
const GATEWAY_RETRY_DELAY_MS = 750;

function parseToolCalls(
  message: OpenRouterChoiceMessage | undefined,
): Array<ChatCompletionToolCall> | undefined {
  const raw = message?.tool_calls;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const calls: Array<ChatCompletionToolCall> = [];
  for (const call of raw) {
    const name = call?.function?.name;
    if (typeof name !== 'string' || name.length === 0) continue;
    calls.push({
      id: typeof call.id === 'string' ? call.id : null,
      name,
      arguments: typeof call.function?.arguments === 'string'
        ? call.function.arguments
        : '',
    });
  }
  return calls.length > 0 ? calls : undefined;
}

export async function createChatCompletion(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_GATEWAY_ATTEMPTS; attempt += 1) {
    try {
      return await attemptChatCompletion(request);
    } catch (err) {
      lastError = err;
      const transient =
        err instanceof ModelGatewayError &&
        TRANSIENT_GATEWAY_CODES.has(err.code);
      if (!transient || attempt === MAX_GATEWAY_ATTEMPTS) throw err;
      await new Promise((resolve) =>
        setTimeout(resolve, GATEWAY_RETRY_DELAY_MS * attempt),
      );
    }
  }
  throw lastError;
}

/** One gateway attempt; callers retry via createChatCompletion. */
async function attemptChatCompletion(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  // Imported lazily to avoid a config cycle in tests that stub fetch.
  const { serverEnv } = await import('../config.js');
  const env = serverEnv();
  if (!env.MODEL_GATEWAY_URL || !env.MODEL_GATEWAY_KEY) {
    throw new ModelGatewayError(
      ModelGatewayErrorCode.NotConfigured,
      'model gateway is not configured',
    );
  }

  const baseUrl = env.MODEL_GATEWAY_URL.endsWith('/')
    ? env.MODEL_GATEWAY_URL
    : `${env.MODEL_GATEWAY_URL}/`;
  const url = new URL('chat/completions', baseUrl);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.MODEL_GATEWAY_KEY}`,
        'content-type': 'application/json',
        // OpenRouter attribution headers (optional but recommended).
        'http-referer': env.PUBLIC_WEB_URL,
        'x-title': 'Chat_Buddy Cloud',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.8,
        // Reasoning-capable models (e.g. nemotron) burn completion tokens
        // on hidden thinking; ask the gateway not to return it separately.
        reasoning: { exclude: true },
        // JSON mode forces envelope compliance on supported models
        // (operator-selected via MODEL_GATEWAY_MODEL); require_parameters
        // routes only to providers honoring response_format. Suppressed
        // when tools are advertised: json_object and tool calling are
        // mutually exclusive on OpenAI-compatible providers.
        ...(env.MODEL_GATEWAY_JSON_MODE &&
        !(request.tools && request.tools.length > 0)
          ? {
              response_format: { type: 'json_object' },
              provider: { require_parameters: true },
            }
          : {}),
        ...(request.tools && request.tools.length > 0
          ? { tools: [...request.tools], tool_choice: 'auto' }
          : {}),
        messages: [
          ...(request.system
            ? [{ role: 'system', content: request.system }]
            : []),
          { role: 'user', content: request.prompt },
        ],
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? 45_000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ModelGatewayError(
        ModelGatewayErrorCode.Timeout,
        'model gateway request timed out',
      );
    }
    throw new ModelGatewayError(
      ModelGatewayErrorCode.Upstream,
      `model gateway request failed: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new ModelGatewayError(
      ModelGatewayErrorCode.Unauthorized,
      'model gateway rejected credentials',
      res.status,
    );
  }
  if (res.status === 429) {
    throw new ModelGatewayError(
      ModelGatewayErrorCode.RateLimited,
      'model gateway rate limited',
      res.status,
    );
  }
  if (!res.ok) {
    throw new ModelGatewayError(
      ModelGatewayErrorCode.Upstream,
      `model gateway returned ${res.status}`,
      res.status,
    );
  }

  let raw: string;
  try {
    raw = await res.text();
  } catch {
    throw new ModelGatewayError(
      ModelGatewayErrorCode.BadResponse,
      'model gateway response read failed',
    );
  }
  let body: OpenRouterResponse;
  try {
    body = JSON.parse(raw) as OpenRouterResponse;
  } catch {
    throw new ModelGatewayError(
      ModelGatewayErrorCode.BadResponse,
      `model gateway returned invalid JSON: ${raw.slice(0, 200)}`,
    );
  }
  const message = body.choices?.[0]?.message;
  const content = stripReasoning(message?.content);
  const toolCalls = parseToolCalls(message);
  if ((typeof content !== 'string' || content.length === 0) && !toolCalls) {
    if (!Array.isArray(body.choices) || body.choices.length === 0) {
      // Structurally broken payload (no choices at all).
      throw new ModelGatewayError(
        ModelGatewayErrorCode.BadResponse,
        'model gateway returned no content',
      );
    }
    // HTTP 200 with a choice but no message content (observed ~12% on
    // free-tier upstreams). Typed distinctly so callers can apply the
    // raised-budget empty-reply retry.
    throw new ModelGatewayError(
      ModelGatewayErrorCode.EmptyResponse,
      'model gateway returned no content',
    );
  }
  return {
    content: content ?? '',
    model: body.model ?? request.model,
    ...(toolCalls ? { toolCalls } : {}),
    usage: body.usage
      ? {
          promptTokens: body.usage.prompt_tokens ?? 0,
          completionTokens: body.usage.completion_tokens ?? 0,
        }
      : undefined,
  };
}
