# Cloud authentication and account deletion request evidence

Source baseline `be4d237e` on `remake`. Reviewed Web development Skill `2026-11-15-audit-1` at `a752b2aa`, including the A25 acceptance requirement and delivery audit. Shared product contract `2026-08-18-demo-v1`.

## Deletion request and session revocation

`POST /v1/account/delete` takes a bearer token and the exact body `{"confirmation":"delete my account"}`. The authenticated session determines the account. A successful response adds `status: "deleting"` to the existing `ok: true` and `deletionStartedAt` fields.

Account state, session revocation and push credential removal commit in one transaction. A retry with the original, unexpired initiating bearer can retrieve the same pending receipt. The server matches a receipt-specific digest stored on that revoked session and binds the digest to the deletion timestamp and account. The receipt records when deletion started. All other account endpoints and refresh requests continue to require an active account and an unrevoked session.

Session creation, refresh and deletion use the same account row lock. A refresh consumes the old refresh token and inserts its replacement in one transaction. If refresh commits ahead of deletion, deletion revokes the successor along with the other sessions.

## Acceptance exercised on 2026-11-15

- `npm exec vitest run server/api/account-deletion.test.ts server/auth/apple.test.ts server/api/auth-sessions.test.ts server/auth/session.test.ts` passed all 31 tests. The deletion tests exercise rollback on push-token removal failure, preservation of an unrelated account’s push credential, and replay expiry. Apple assertion tests generate local RSA keys and cover the issuer, audience, nonce, timestamps, signature and claim types.
- `npm test` passed 898 tests across 70 files. `npm run typecheck`, `npm run build:server`, ESLint on changed source and tests, and `git diff --check` also passed.
- `npm run db:migrate` applied seven migrations to a new PostgreSQL 16.15 fixture. On a loopback listener the compiled `node dist/server/server/index.js` with `NODE_ENV=production` returned `200` from `/healthz` and `/readyz`. Dev sign-in and the unregistered `/v1/auth/apple` each returned `404`.
- The same listener returned `200` for deletion and for the initiating session’s receipt retry, with the response timestamp matching PostgreSQL. Another session’s receipt retry, revoked access and revoked refresh each returned `401`. The unrelated account stayed accessible with `200`. The deleting account had no active sessions and its push credential was cleared.
- Concurrent refresh attempts with an identical token returned `200` and `401`. With PostgreSQL holding the account row so the two HTTP requests queued in a known order, refresh-first returned `200` and its successor was revoked by deletion. Delete-first caused the refresh to return `401`. Both orders left zero active sessions. The compiled server and PostgreSQL fixture were shut down after the checks.

## Open acceptance requirements

The Apple helper verifies an RS256 identity assertion against the configured audience and expected nonce. Account establishment still requires a registered native App ID or Web Services ID appropriate to the client, a server-bound one-time attempt, code exchange with Apple's `/auth/token`, and secure storage for revocation material. Apple’s published provider metadata identifies RS256 for identity tokens. The repository currently has optional Apple configuration and a stored Apple subject, and the native request currently sends an optional code without a server-issued nonce. [Apple provider metadata](https://appleid.apple.com/.well-known/openid-configuration), [Verifying a user](https://developer.apple.com/documentation/signinwithapple/verifying-a-user), [TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple).

A25 remains open for private data erasure, the deletion or anonymization of shared history under a defined retention policy, removal of identifying facts from character memories, and the device-side cache and Keychain checks. Conversation creators are referenced with `ON DELETE RESTRICT`. Character-owned memory can retain identifying text when its source actor reference is set to null. A cleanup implementation needs to cover both before it can report completion. Apple revocation needs a valid provider token. Where that material is missing for a legacy account, Apple still requires application data deletion and documents manual credential revocation separately. [TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple).
