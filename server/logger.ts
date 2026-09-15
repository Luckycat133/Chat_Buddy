import { pino, type Logger as PinoLogger } from 'pino';
import { loadServerEnv } from './config.js';

/**
 * Structured logger. Per WEB_IMPLEMENTATION §4.1 the server must emit
 * request IDs, account/social-graph/actor IDs (privacy-safe), runtime
 * decision actions (no chain-of-thought), token/latency/error metadata.
 *
 * `redactPaths` ensures secrets never leak to disk even via accidental log args.
 */
const REDACT_PATHS = [
  'SESSION_SIGNING_KEY',
  'APPLE_PRIVATE_KEY',
  'MODEL_GATEWAY_KEY',
  'SEARCH_PROVIDER_KEY',
  'WEATHER_PROVIDER_KEY',
  'OBJECT_STORAGE_ACCESS_KEY',
  'OBJECT_STORAGE_SECRET_KEY',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'password',
  'token',
  '*.password',
  '*.token',
  '*.secret',
];

let cached: PinoLogger | null = null;

export function createLogger(): PinoLogger {
  if (cached) return cached;
  const env = loadServerEnv();
  cached = pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: REDACT_PATHS,
      censor: '[redacted]',
    },
    base: {
      service: 'chat-buddy-cloud',
      env: env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
  return cached;
}

export type ServerLogger = PinoLogger;
