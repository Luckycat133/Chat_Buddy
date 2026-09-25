import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Database } from '../../db/index.js';
import { z } from 'zod';
import {
  ModelGatewayError,
  ModelGatewayErrorCode,
} from '../services/model-gateway.js';

/**
 * Raw chat-completion proxy for the legacy web pipeline.
 *
 * The web AIPipeline keeps its own tool-calling and prompt assembly (it is the
 * hosted behavior for the legacy demo), but the provider key must never reach
 * the browser bundle. This endpoint forwards an OpenAI-shaped request body to
 * the model gateway with the server-side key and returns the provider JSON
 * untouched (choices / usage / tool_calls), so `callAI` can parse it with the
 * exact same code paths it uses for direct provider responses.
 */

const completionBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.union([z.string(), z.null()]).optional(),
        tool_calls: z.array(z.unknown()).optional(),
        tool_call_id: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .min(1)
    .max(64),
  maxTokens: z.number().int().min(16).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
  tools: z.array(z.unknown()).max(32).optional(),
  toolChoice: z.unknown().optional(),
});

interface GatewayEnv {
  MODEL_GATEWAY_URL: string;
  MODEL_GATEWAY_KEY: string;
  MODEL_GATEWAY_MODEL?: string;
  PUBLIC_WEB_URL?: string;
}

async function resolveEnv(): Promise<GatewayEnv> {
  const { serverEnv } = await import('../config.js');
  return serverEnv() as unknown as GatewayEnv;
}

export async function forwardChatCompletion(
  env: GatewayEnv,
  body: Record<string, unknown>,
): Promise<Response> {
  const baseUrl = env.MODEL_GATEWAY_URL.endsWith('/')
    ? env.MODEL_GATEWAY_URL
    : `${env.MODEL_GATEWAY_URL}/`;
  const url = new URL('chat/completions', baseUrl);
  return fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.MODEL_GATEWAY_KEY}`,
      'content-type': 'application/json',
      'http-referer': env.PUBLIC_WEB_URL || 'http://localhost:5173',
      'x-title': 'Chat_Buddy Cloud',
    },
    body: JSON.stringify({
      ...body,
      model: env.MODEL_GATEWAY_MODEL || 'openrouter/auto',
      reasoning: { exclude: true },
    }),
    signal: AbortSignal.timeout(60_000),
  });
}

export function registerAiRoutes(app: FastifyInstance): void {
  app.post(
    '/v1/ai/complete',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = completionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(ApiErrorCodes.ValidationFailed, 'invalid request body');
      }
      const { messages, maxTokens, temperature, tools, toolChoice } =
        parsed.data;
      const env = await resolveEnv();
      if (!env.MODEL_GATEWAY_URL || !env.MODEL_GATEWAY_KEY) {
        throw new ApiError(
          ApiErrorCodes.ModelFailure,
          'model gateway is not configured',
        );
      }

      const upstreamBody: Record<string, unknown> = {
        messages,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(Array.isArray(tools) && tools.length > 0
          ? { tools }
          : {}),
        ...(toolChoice !== undefined ? { tool_choice: toolChoice } : {}),
      };

      let res: Response;
      try {
        res = await forwardChatCompletion(env, upstreamBody);
      } catch (err) {
        if (err instanceof ModelGatewayError) {
          throw new ApiError(ApiErrorCodes.ModelFailure, err.message);
        }
        if (err instanceof Error && err.name === 'TimeoutError') {
          throw new ApiError(ApiErrorCodes.ModelFailure, 'gateway timeout');
        }
        throw new ApiError(
          ApiErrorCodes.ModelFailure,
          'model gateway request failed',
        );
      }

      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        // Pass provider error shape through with the upstream status so the
        // client's existing error parsing (choices[0].error / data.error)
        // keeps working unchanged.
        reply.code(res.status);
        return data ?? { error: { message: `gateway HTTP ${res.status}` } };
      }
      return data;
    },
  );
}
