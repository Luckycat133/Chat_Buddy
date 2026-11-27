# Cloud migrations and local R5 acceptance

Implementation and evidence dated 2026-11-15, on `remake@be4d237e` with the local
changes in this checkout. The development Skill, roadmap and delivery ledger were
read at `a752b2aa9a40c6ed8c464b0081de1d93bc69fd5b` (Skill version
`2026-11-15-audit-1`, product contract `2026-08-18-demo-v1`).

`npm run db:migrate` reads all seven journal entries with Drizzle ORM 0.45.4.
The historical timestamp for `0000` stays intact. The missing entries `0001` to
`0004` use increasing timestamps based on their first recoverable repository
revision `b7c4d54b`. `0005` uses the time of its introduction in `624b62bb`. Their
SQL stays byte-for-byte intact. The restored `0005` snapshot records its two
session columns. `0006` adds only the two graph indexes already declared in the
model. The model keeps the three indexes previously established by `0003`.

The command checks the Drizzle ledger's hash and timestamp for every recorded
entry, then checks the public table columns, types, nullability, enum labels,
and explicit index names and uniqueness against the recorded snapshot. It
recognizes the two observed forms of `0000` at `693f9025` and `072a3bc6`, which
differ in the nullability of `tool_executions.conversation_id`. A transaction
lock covers the checks, pending DDL and new ledger entries. The next run reports
zero applied migrations. A nonempty public schema without trusted receipts, an
unknown ledger, or an inconsistent schema stops before writing migration SQL or
ledger entries.

For an old database created by a manual SQL loop, preserve a backup and use a
disposable copy to reconcile the actual schema and provenance. The command
does not synthesize missing receipts or infer a baseline based on tables alone.
The schema check distinguishes the recorded migration layouts, with the scope
above. It is not a complete check of every constraint, function or data value.

Run the production command with the intended `DATABASE_URL` and the same server
environment used for deployment. Point the verification command at an explicit
disposable loopback PostgreSQL service that can create temporary databases:

```sh
MIGRATION_TEST_DATABASE_URL='postgres://fixture:...@127.0.0.1:5432/postgres' npm run db:test-migrations
npm run db:check
npm run typecheck
npm test -- --project server
npm run build:server
npm run start:server
```

| Layer | Local result |
| --- | --- |
| Native PostgreSQL 16.15, `db:test-migrations` | 6 passed, 0 failures or skips. New database uses 7 migrations and then 0. Both recorded `0000` variants upgrade, retain existing session data and stay idempotent. Old untracked SQL and mixed history are rejected without ledger writes. Parallel invocations apply only one journal. |
| PGlite, `npm test -- --project server` | 23 files, 244 tests passed. PGlite uses the checked-in Drizzle journal for fixture databases. |
| Static validation | TypeScript, scoped ESLint, `db:check` and `git diff --check` passed. Generating from a temporary copy of the repaired snapshots produced no new migration. |
| Compiled service, native PostgreSQL | `build:server` and `start:server` succeeded in an isolated copy. Loopback `/healthz` and `/readyz` both returned 200. A synthetic development sign-in and session listing returned 200 and showed the migrated user-agent and last-seen fields. |

The workflow now runs the same migration command against its PostgreSQL service,
executes the upgrade fixtures, and starts the compiled service before probing
liveness and PostgreSQL readiness. `db:seed` also passed on a freshly migrated
fixture in CI order. It is a demo setup step. On a populated fixture with only a
non-demo graph, the existing seed command failed because it still tried to write
actors to its fixed demo graph ID. The local evidence does not include a new
GitHub Actions run, a deployment, or reconciliation of an actual pre-existing
database.
