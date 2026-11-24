---
name: chat-buddy-drizzle-backend
description: "Develop, migrate, and test Chat Buddy's PostgreSQL + Drizzle ORM schema (db/) and Fastify/TypeScript backend services (server/). Use when editing db/schema.ts, SQL migrations, postgres.js/PgBouncer connections, server/config.ts env validation, API/auth/realtime/workers, or PGlite server integration tests."
---

# Chat Buddy Drizzle & Server Backend

Grounds database and backend changes in `db/` and `server/` without relying on generic Supabase/Postgres assumptions. Pair with `chat-buddy-web-demo-development` when changing product or social-visibility rules.

## 1. Database & Migration Contracts (`db/`, `drizzle.config.ts`)

- **Schema & migrations**: `db/schema.ts` is the single source of truth; SQL migrations live in `db/migrations/` (`drizzle.config.ts` enforces `strict: true`).
  - Generate/verify migrations: `npm run db:generate` and `npm run db:check`
  - Apply migrations / seed demo data: `npm run db:migrate` (`tsx db/migrate.ts`), `npm run db:seed` (`tsx db/seeds/seed-demo.ts`)
- **PgBouncer transaction-mode safety (`db/index.ts`)**: `createDatabase(config)` connects via `postgres` (`postgres.js`) with `prepare: !config.pooled`. When `DATABASE_POOLED=true` (managed PgBouncer transaction pooler), prepared statements are forbidden—never hardcode prepared statements or session-scoped advisory/GUC state across pooled queries.
- **Realtime responsiveness**: Respect `DATABASE_STATEMENT_TIMEOUT_SEC` (default `30`s) and bounded `DATABASE_POOL_MAX` (default `10`).

## 2. Server Environment & Security Boundaries (`server/`)

- **Fail-fast env parsing (`server/config.ts`)**: `loadServerEnv()` / `serverEnv()` validate `process.env` via `ServerEnvSchema` and cache the parsed object (`SESSION_SIGNING_KEY` >= 32 chars; `SERVER_AUDIT_TOKEN` optional >= 32 chars and **hard-disables** admin/hidden-AI audit routes when unset). Never read raw `process.env` inside handlers or log secrets.
- **Server-side authorization**: Enforce actor identity, accepted group membership, block state, and private-branch memory isolation inside `server/api/`, `server/auth/`, `server/realtime/`, and `server/workers/`—client filtering is never sufficient.
- **Dev & build commands**: `npm run dev:server` (`tsx watch server/index.ts`), `npm run build:server`, `npm run start:server`.

## 3. Hermetic Integration Testing (`server/test/`)

- **No live Postgres required for Vitest**: Server integration tests use `@electric-sql/pglite` + `drizzle-orm/pglite` via `server/test/pglite.ts`, which replays the checked-in SQL migrations in `db/migrations/` into an in-memory PGlite instance.
- **Fixtures & env isolation**: Seed minimal valid social graphs with `server/test/fixtures.ts` (`SeededGraph`: `accounts`, `actors`, `personaTemplates`, `socialGraphs`, `friendRequests`) and call `resetServerEnvForTests()` between cases that mutate environment variables. Run focused Vitest files first (`npx vitest run <path>`).
