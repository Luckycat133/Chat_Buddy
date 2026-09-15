import { z } from 'zod';

/**
 * Environment validation per WEB_IMPLEMENTATION §4.2.
 * Never log secrets. Fail fast on missing or malformed variables.
 */
const ServerEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(200).default(10),
  DATABASE_STATEMENT_TIMEOUT_SEC: z.coerce.number().int().min(1).max(600)
    .default(30),
  DATABASE_POOLED: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
  SESSION_SIGNING_KEY: z.string().min(32),
  SESSION_TTL_SEC: z.coerce.number().int().min(60).max(60 * 60 * 24 * 30)
    .default(60 * 60 * 24 * 14),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  MAGIC_LINK_FROM: z.string().email().optional(),
  MODEL_GATEWAY_URL: z.string().url().optional(),
  MODEL_GATEWAY_KEY: z.string().optional(),
  SEARCH_PROVIDER_URL: z.string().url().optional(),
  SEARCH_PROVIDER_KEY: z.string().optional(),
  WEATHER_PROVIDER_URL: z.string().url().optional(),
  WEATHER_PROVIDER_KEY: z.string().optional(),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_KEY_PATH: z.string().optional(),
  OBJECT_STORAGE_BUCKET: z.string().optional(),
  OBJECT_STORAGE_REGION: z.string().optional(),
  OBJECT_STORAGE_ACCESS_KEY: z.string().optional(),
  OBJECT_STORAGE_SECRET_KEY: z.string().optional(),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().default(''),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/** Parse and cache the process environment. Throws on validation failure. */
export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = ServerEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Strictly typed accessor; throws if loadServerEnv was not called first. */
export function serverEnv(): ServerEnv {
  if (!cachedEnv) cachedEnv = loadServerEnv();
  return cachedEnv;
}

/** For tests only: reset cached env between cases. */
export function resetServerEnvForTests(): void {
  cachedEnv = null;
}

export function isProduction(env: ServerEnv = serverEnv()): boolean {
  return env.NODE_ENV === 'production';
}

/** Comma-separated CORS origin list. Empty = no extra origins. */
export function allowedOrigins(env: ServerEnv = serverEnv()): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
