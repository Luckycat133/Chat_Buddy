import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { pathToFileURL } from 'node:url';
import { ZodError } from 'zod';
import { allowedOrigins, loadServerEnv, serverEnv } from './config.js';
import { createLogger } from './logger.js';
import { attachRequestContext } from './observability/request-context.js';
import { ApiError, isApiError } from './errors.js';
import { ApiErrorCodes } from '../shared/contracts/errors.js';
import type { Database } from '../db/index.js';
import { registerHealthRoutes } from './api/health.js';
import { registerActorRoutes } from './api/actors.js';
import { registerSyncRoutes } from './api/sync.js';
import { registerConversationRoutes } from './api/conversations.js';
import { registerMessageRoutes } from './api/messages.js';
import { registerFriendRequestRoutes } from './api/friend-requests.js';
import { registerGroupInvitationRoutes } from './api/group-invitations.js';
import { registerMemoryRoutes } from './api/memory.js';
import { registerProactiveRoutes } from './api/proactive.js';
import { registerMomentRoutes } from './api/moments.js';
import { registerAccountRoutes } from './api/account.js';
import { registerCapabilityRoutes } from './api/capabilities.js';
import { registerOnboardingRoutes } from './api/onboarding.js';
import { registerAuthRoutes } from './api/auth.js';
import { registerHiddenAiRoutes } from './api/hidden-ai.js';
import { registerWorldEventRoutes } from './api/world-events.js';
import { registerSocialRoutes } from './api/social.js';
import { registerAiRoutes } from './api/ai.js';
import { registerRealtimeGateway } from './realtime/gateway.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

export interface ServerOptions {
  db: Database;
  /** Skip network binds for tests. */
  listen?: boolean;
}

/**
 * Build and start the Fastify server. Returns the running instance.
 * Listens by default; tests should pass `{ listen: false }` and call
 * `app.inject(...)` or `app.ready()`.
 */
export async function buildServer(options: ServerOptions): Promise<FastifyInstance> {
  loadServerEnv();
  const env = serverEnv();
  const logger: FastifyBaseLogger = createLogger();
  const app = Fastify({
    loggerInstance: logger,
    genReqId: (req) => {
      const headerId = req.headers['x-request-id'];
      if (typeof headerId === 'string' && headerId.length > 0) return headerId;
      return randomUuidString();
    },
    bodyLimit: 1_048_576, // 1 MiB; raise per-route for media uploads later.
    disableRequestLogging: false,
    trustProxy: env.NODE_ENV === 'production',
  });

  app.decorate('db', options.db);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'https:', 'wss:'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      const allow = allowedOrigins();
      if (!origin) return cb(null, true);
      if (allow.length === 0) return cb(null, true);
      cb(null, allow.includes(origin));
    },
    credentials: true,
  });

  await app.register(cookie, {
    secret: env.SESSION_SIGNING_KEY,
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
    },
  });

  await app.register(websocket, {
    options: { maxPayload: 1_048_576 },
  });

  app.addHook('onRequest', attachRequestContext);

  app.setErrorHandler((err, request, reply) => {
    const requestId = request.requestContext?.requestId;
    if (err instanceof ZodError) {
      reply.code(422).send({
        error: {
          code: ApiErrorCodes.ValidationFailed,
          message: 'Invalid request',
          request_id: requestId,
          details: { issues: err.issues },
        },
      });
      return;
    }
    if (isApiError(err)) {
      reply.code(err.status).send(err.toEnvelope());
      return;
    }
    // H1 fix: Fastify's native content-type parser failures (malformed JSON,
    // empty body with CT=json, missing/unsupported content type) arrive as
    // FastifyErrors carrying a 4xx statusCode. Previously they fell through
    // to the 500 INTERNAL branch. Pass any error with a 4xx statusCode
    // through with its status and a safe message instead of wrapping it as
    // an INTERNAL server error.
    const statusCode = (err as { statusCode?: unknown }).statusCode;
    if (
      typeof statusCode === 'number' &&
      Number.isInteger(statusCode) &&
      statusCode >= 400 &&
      statusCode < 500
    ) {
      const errMessage = (err as { message?: unknown }).message;
      const message = (
        typeof errMessage === 'string' && errMessage.length > 0
          ? errMessage
          : 'Invalid request'
      ).slice(0, 300);
      request.log.warn({ err, requestId }, 'client error');
      reply.code(statusCode).send({
        error: {
          code: ApiErrorCodes.ValidationFailed,
          message,
          request_id: requestId,
        },
      });
      return;
    }
    request.log.error({ err, requestId }, 'unhandled error');
    reply.code(500).send({
      error: {
        code: ApiErrorCodes.Internal,
        message: 'Internal server error',
        request_id: requestId,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: ApiErrorCodes.NotFound,
        message: 'Not found',
        request_id: request.requestContext?.requestId,
      },
    });
  });

  registerHealthRoutes(app);
registerActorRoutes(app);
registerSyncRoutes(app);
registerAuthRoutes(app);
registerConversationRoutes(app);
registerMessageRoutes(app);
registerFriendRequestRoutes(app);
registerGroupInvitationRoutes(app);
registerOnboardingRoutes(app);
registerMemoryRoutes(app);
registerProactiveRoutes(app);
registerMomentRoutes(app);
registerAccountRoutes(app);
registerCapabilityRoutes(app);
registerHiddenAiRoutes(app);
registerSocialRoutes(app);
registerAiRoutes(app);
registerWorldEventRoutes(app);
registerRealtimeGateway(app);

  if (options.listen !== false) {
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info({ host: env.HOST, port: env.PORT }, 'chat-buddy cloud ready');
  }
  return app;
}

function randomUuidString(): string {
  // Lightweight fallback; Fastify requires a string here and the request
  // hook replaces it with a v4 UUID once we are inside a route.
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isMainEntry(): boolean {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (isMainEntry()) {
  const { createDatabase } = await import('../db/index.js');
  loadServerEnv();
  const env = serverEnv();
  const db = createDatabase({
    databaseUrl: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    statementTimeoutSec: env.DATABASE_STATEMENT_TIMEOUT_SEC,
    pooled: env.DATABASE_POOLED,
  });
  buildServer({ db }).catch((err) => {
     
    console.error('failed to start server', err);
    process.exit(1);
  });
}
