# Demo seed

Idempotent seed that inserts Mira, Luna, Max, and one internal-test slot
with two Moments each.

## Usage

```bash
docker compose up -d postgres
export DATABASE_URL=postgres://chat_buddy:dev_only_change_me@localhost:5432/chat_buddy
npm run db:migrate
npm run db:seed
```

The seed:

- Inserts a default social graph (`00000000-0000-0000-0000-000000000001`) if absent.
- Inserts each persona template (idempotent on `slug`).
- Inserts each character actor (idempotent on `public_name`).
- Backfills missing seed Moments so every character has exactly two.

It does NOT create the primary human user; that account is created on
first sign-in via the auth endpoints (`/v1/auth/dev-signin`,
`/v1/auth/refresh`, or Sign in with Apple in production).

## Re-running

```bash
npm run db:seed
```

Existing rows are detected by `slug` (templates) and `public_name`
(actors); the seed is safe to run repeatedly.