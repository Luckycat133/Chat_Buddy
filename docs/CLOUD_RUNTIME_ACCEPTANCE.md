# Cloud runtime acceptance

The 2026-11-15 checks used Web base `be4d237eeeaf80b7116b0445b01bfcc4c0933fcb`
and the reviewed development Skill at
`a752b2aa9a40c6ed8c464b0081de1d93bc69fd5b`. The checks exercised the
local changes with PGlite and PostgreSQL 16.15.

## R2 memory and relationship access

Prompt compilation scopes private relationship details to the authorized
conversation audience. Generated memories use their triggering
`message_sent` event as provenance. The runtime derives grants from the event
and intended audience, then checks current access again on recall. A grant to
know a fact does not grant permission to disclose it. Generated legacy records
without attributable provenance stay out of prompt retrieval.

The PostgreSQL integration test creates a generated memory through the HTTP
message route and checks its original source event. The full offline suite
also covers authorized and unrelated users, invalid provenance, and revoked
or deleted sources. Generated text in these tests came from a fixture model.

## R3 message and event persistence

Human sends, AI replies and proactive messages share the per-conversation
sequence allocator. Message rows and their required events commit together.
Allocation uses the owning social graph. Delivery uses the actor and
conversation membership when choosing recipients.

PostgreSQL exercised concurrent writers across two graphs, replayed client
keys and generation receipts, and verified that a non-member received no
sync event. An injected failure during event creation rolled back the entire
write. Restarting the HTTP server and database pool recovered the same send
with the original idempotency inputs. A simulated post-commit push failure kept
the proactive row in its sent state. The retry did not send another push.

## Verification

| Check | Observed result |
| --- | --- |
| `npm test -- --project server` | 24 files, 250 tests passed with PGlite |
| `db:migrate` against a fresh PostgreSQL 16.15 instance | Seven migrations applied |
| `npm test -- --project server server/services/conversation-writes.test.ts` with the isolated PostgreSQL URL | Both integration tests passed |
| `npm run typecheck` and `npm run build:server` | Passed |
| Compiled loopback server `/healthz` and `/readyz` | HTTP 200 |

Use a disposable loopback PostgreSQL database for the integration tests.
`CHAT_BUDDY_MESSAGE_TEST_PG_URL` selects that fixture database. The PostgreSQL
migration and restart checks have their own procedure.
[Database migrations](CLOUD_MIGRATIONS.md).

Hosted A08–A10 and A23, a registered durable worker with lease recovery,
and actual provider and push delivery remain open.
