# Chat Buddy Delivery Roadmap

Updated: **2026-11-15**. Reviewed source: `remake@be4d237eeeaf80b7116b0445b01bfcc4c0933fcb` (2026-11-12). Product contract remains `2026-08-18-demo-v1`.

Chat Buddy is a WeChat-style social application with human and AI contacts, independent group participation, Moments, private branches and persistent character continuity. The next milestone is a trustworthy cloud social loop, not more unrelated panels or professional-agent features.

## Read this status correctly

The previous 15-theme roadmap is preserved **verbatim** in [ROADMAP.legacy.md](ROADMAP.legacy.md). Its v0.1-v0.3 Done labels describe historical local-era work and must not be read as acceptance of the current hosted demo. Existing local import compatibility remains a requirement.

The authoritative evidence snapshot is [DELIVERY_STATUS.md](.agents/skills/chat-buddy-web-demo-development/references/DELIVERY_STATUS.md); the implementation workflow is [SKILL.md](.agents/skills/chat-buddy-web-demo-development/SKILL.md). [ACCEPTANCE.md](.agents/skills/chat-buddy-web-demo-development/references/ACCEPTANCE.md) defines the unchanged A01-A25 requirements. Implementation present, test passed, full scenario accepted and deployed/live verified are separate statuses.

## Verified baseline, not a new test run

[CI run 43194844889](https://github.com/Luckycat133/Chat_Buddy/actions/runs/43194844889) succeeded on the reviewed commit on 2026-11-12:

- Vitest: **67 files / 863 tests passed**. Includes legacy browser and cloud/component/PGlite tests.
- Scoped lint and typecheck passed; lint has **2 warnings**, and is not root-wide lint.
- Browser build and bundle-secret checks passed. Compiled-server production startup was not checked by that workflow.
- P0 Playwright report: **96 passed / 4 skipped** across four project configurations. A01 is skipped; the other 24 named cases use API requests, several only checking login. This is **not** 25 complete accepted flows or cross-browser UI proof.
- PostgreSQL 16 was used, but CI applies all SQL manually while the official migrator's journal lists only `0000`. Coverage upload found no files; no coverage percentage is established.

No production deployment, real-provider release suite, iOS acceptance or multi-day social evaluation was verified in this review. Full evidence, job/artifact links and the per-scenario assertion matrix are in the ledger.

## Current delivery state

| Slice | What exists | Delivery status / next proof |
| --- | --- | --- |
| Cloud API and typed client | Fastify routes, contracts, sessions, social/hidden access tests, cloud bridge | Partial; prove the selected hosted UI and production auth path, not legacy behavior behind a key proxy |
| Message persistence | Human-message idempotency and concurrent sequence tests | Partial; unify AI/proactive writers and make message/event continuity reliable |
| Independent group decisions | Eligibility/budget helpers and a separate generation service | Scaffold/partial; attention still waits by stub, generation asks every active character to reply, production caller chain not established |
| Character memory | Provenance/grant filtering, narrative versions, generated-memory patch persistence | Partial; close narrative and generated-memory scope bypasses before multi-user expansion |
| Moments | Audience feed, interactions, canonical events and view-event tests | Partial; actual view -> actor memory -> later chat still needs integrated proof |
| Offline/proactive life | Tested life ticks, sparse scheduler and quiet-hours/proactive policies | Partial; prove registered durable execution, restart recovery and notification reopening |
| Invitations and mixed groups | Domain objects/APIs, several authorization and identity tests | Partial; test each human/AI decision and the full two-human flow |
| Capability adapters | Weather/calendar/search/media paths and truthful failure branches | Partial; real receipts, confirmation and UI closure not certified |
| Release acceptance | CI and an A01-A25-named API suite | Not accepted; replace shallow assertions and missing-path skips |

## Milestone 0 — restore release and evidence integrity

Priority: **P0**, before using a green run to authorize wider testing. Findings: R5/R6 in the ledger.

- [ ] Reconcile the migration journal/history safely; use the same supported migration command in CI and release.
- [ ] Prove clean PostgreSQL install, upgrade from a recorded prior schema, and a second no-op migration run; account for deployments previously bootstrapped with raw SQL.
- [ ] Add compiled `build:server` + `start:server` smoke and explicit hosted client configuration checks.
- [ ] Make required acceptance fail when its runtime is absent; track prohibited skips and replace token-only placeholders.
- [ ] Report scope honestly: root vs scoped lint, actual coverage artifacts, API vs browser tests, deterministic vs live provider runs.

Exit: reproducible startup/schema and a trustworthy gate, with command, environment, SHA and artifact evidence. This milestone does not itself complete social behavior.

## Milestone 1 — privacy-safe, replay-safe cloud turn

Priority: **P0**, before enabling autonomous multi-actor execution. Findings: R2/R3. Main sources: prompt compiler, generation service and message API.

- [ ] Scope relationship narratives to the current authorized conversation audience; cover all prompt sections, not only memory rows.
- [ ] Derive generated-memory relationship/source/disclosure scope from the original event. Do not let model types, empty policies or null relationship IDs declassify private human facts.
- [ ] Add private-DM -> generated memory -> other-human/group/AI-relay negative tests, including grants, block, deletion and supersession.
- [ ] Resolve the actual social graph for generated events; remove fixed demo-graph authority from shared runtime writes.
- [ ] Share safe sequence allocation across human/AI/proactive writers; use stable decision/bubble idempotency keys.
- [ ] Persist authoritative messages and required events atomically or via a transactional outbox; verify replay and crash recovery.

Exit: unauthorized information is absent from prompts and outputs; two non-demo graphs remain isolated; concurrent/replayed mixed writers produce one correctly ordered result. A08-A10/A23 evidence must exercise real write paths, not only hand-built fixtures.

## Milestone 2 — an actual independent group conversation

Priority: **P0**, the first product-defining runtime milestone. Depends on milestones 0/1. Finding: R1; scenarios A04-A07/A15.

- [ ] Wire burst closure through a registered worker to independently authorized actor decisions, persistence, action execution and delivery.
- [ ] Persist per-actor reply/wait/ignore/private-action results; keep operational decision summaries, never chain-of-thought.
- [ ] Implement typing-aware burst completion and wait wake-ups on new input, peer replies or deadline; recover after restart.
- [ ] Isolate failures and retries by actor; one provider failure must not erase another actor's decision or turn all silence into fallback text.
- [ ] Carry cascade identity, request/cost/time budgets, re-entry and novelty controls across continuation jobs. No visible fixed reply count.
- [ ] Verify all invitees remain pending and cannot read group content before independently accepting; refusal/leave must affect narrative state.

Exit: one user burst can make Mira reply, Luna wait, and Max ignore; a subsequent peer reply may wake Luna; an uninvolved actor stays uninformed; the discussion can continue and then naturally stop. These are deterministic acceptance outcomes, not hard-coded production personalities.

## Milestone 3 — one social history across groups, Moments and private chat

Priority: **P0**, directly after the group turn. Finding: R4; scenarios A08/A17/A18.

- [ ] Build or identify the authoritative event consumer/projector and make processing idempotent.
- [ ] Keep native-world facts, posted expression, authorized audience and actual observation distinct.
- [ ] Project only actual authorized observations into actor-specific objective facts, subjective interpretations and provenance.
- [ ] Prove later private/group recall uses the same history without exposing unrelated private branches.
- [ ] Cover eligible non-viewers, denied viewers, repeat views, edit/deletion, changed grants and replay. Knowing a fact does not authorize sharing it.

Exit: a Moment that Mira actually saw affects her later private conversation; an equally eligible Max who did not see it cannot claim knowledge. A source correction/deletion has a defined downstream effect rather than leaving contradictory permanent summaries.

## Milestone 4 — reliable life while every client is closed

Priority: **P1** implementation order; A16/A19 remain mandatory P0 product scenarios before demo acceptance. Finding: R7.

- [ ] Register the real worker entrypoint; persist due work, leases/checkpoints and retry state with multi-worker exclusion.
- [ ] Prove sparse life ticks, meaningful-event/no-op behavior and per-graph spend limits without depending on an open browser.
- [ ] Recover after worker restart without duplicate Moments, decisions or proactive messages.
- [ ] Revalidate relationship, consent, quiet hours/time zone and expiry at delivery; persist a message before notifying.
- [ ] Verify notification/open/reconnect targets the exact stored conversation/message; distinguish push-provider failure from message failure.

Exit: close every client, advance controlled time, restart the worker, reconnect, and observe coherent history delivered once. Direct function calls alone do not pass this milestone.

## Milestone 5 — complete the hosted Web / shared-client demo

Priority: required for release, after the safety and continuity slices above.

- [ ] Close A01-A03 in the actual cloud UI: first unread Mira message, conversational onboarding, independent introductions and cross-device resumption.
- [ ] Close A11-A15/A24 with two human accounts, mixed groups, identity projection, separate histories, refusal, leave, block and unfriend.
- [ ] Close A20-A22 with authorization, explicit calendar confirmation, real provider receipts and truthful failure UI under an authorized release test plan.
- [ ] Close A23/A25 with browser outbox/reload reconciliation and verified account/data/session lifecycle outcomes.
- [ ] Run English/Simplified Chinese, accessibility and real browser-device checks; compare iOS contract compatibility without inventing an iOS pass from this repo's CI.
- [ ] Record limited live-model and multi-day social evaluations separately from deterministic CI, including consent, cost bounds and retained evidence.
- [ ] Refresh stale local-only architecture summaries (including `CLAUDE.md` / `llms.txt`) without deleting import compatibility or claiming the legacy path is already retired.

Exit: all clauses of A01-A25 have behavior-linked evidence in the same hosted environment, no required skips, and explicitly recorded live/deployment limitations. No completion percentage is assigned before those proofs exist.

## Recommended next development PR

Start with the privacy/reliability and migration/acceptance repairs, then deliver **one complete group-social vertical slice**, rather than adding more tools or another AI pipeline. The demonstration should connect one burst, independent decisions, source-scoped memories, an actually viewed Moment and later private recall. Offline re-entry extends that same history rather than creating a parallel simulation.

Each implementation PR must update the corresponding ledger finding and scenario evidence with its new SHA, exact assertions, test mode, command/run URL, skips and remaining gaps. Documentation revisions alone must not check off the runtime tasks above.
