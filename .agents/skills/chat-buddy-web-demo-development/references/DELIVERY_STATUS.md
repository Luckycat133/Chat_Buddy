# Delivery Status and Acceptance Evidence

Review date: **2026-11-15**. Product contract: **2026-08-18-demo-v1**, unchanged.

## 1. Scope and evidence rules

This is a source review and inspection of historical GitHub Actions evidence for [remake@be4d237eeeaf80b7116b0445b01bfcc4c0933fcb](https://github.com/Luckycat133/Chat_Buddy/commit/be4d237eeeaf80b7116b0445b01bfcc4c0933fcb), committed on 2026-11-12. It is not a fresh application test run, production penetration test, deployment verification, or iOS acceptance report. No real model/tool/social action was invoked for this review.

The repository has real cloud APIs, persistence and substantial regression tests. It is also still a mixed legacy/cloud migration; it is neither merely a UI mock nor an accepted end-to-end autonomous social runtime.

Use separate fields for implementation, test evidence, scenario acceptance and deployment. Here, **partial** means some implemented behavior has evidence but the complete contract does not. **Scaffold** means a contract/helper/stub exists without the required runtime behavior. **Unverified** is not a claim that a feature is absent.

Source paths below are relative to the repository root and refer to this pinned commit. Reinspect callers and tests after code changes. The 2026-10-03 source map in WEB_IMPLEMENTATION.md remains useful navigation, but its earlier sections describe targets. The former root roadmap's 15 Done labels are preserved verbatim in `ROADMAP.legacy.md` as historical claims, not cloud acceptance.

## 2. Verified historical CI

Primary evidence:

- [CI run 43194844889](https://github.com/Luckycat133/Chat_Buddy/actions/runs/43194844889), 2026-11-12, successful, same commit.
- [Unit/typecheck/lint job 131103024599](https://github.com/Luckycat133/Chat_Buddy/actions/runs/43194844889/job/131103024599).
- [Web build job 131103024797](https://github.com/Luckycat133/Chat_Buddy/actions/runs/43194844889/job/131103024797).
- [P0 Playwright job 131105114975](https://github.com/Luckycat133/Chat_Buddy/actions/runs/43194844889/job/131105114975).
- [Playwright artifact 13932094600](https://github.com/Luckycat133/Chat_Buddy/actions/runs/43194844889/artifacts/13932094600), downloaded and inspected during review. SHA-256: `d8d2935e7f610089693c995861249f56c1a09a55883adb73dd3cabcbafa4515d`. Artifact retention is finite; preserve it with release evidence when needed.
- [CodeQL run 43194845082](https://github.com/Luckycat133/Chat_Buddy/actions/runs/43194845082), successful. Success is not a finding-free security certification.
- Workflow definition: `.github/workflows/ci.yml`; scenario source: `e2e/p0-acceptance.spec.js`; projects: `playwright.config.js`.

| Check | Observed fact | What it does NOT establish |
| --- | --- | --- |
| Install/typecheck | `npm ci`; `npx tsc --noEmit` passed on Node 22 CI | A compiled server was not started by this job |
| Lint | `npx eslint server shared db src/api src/sync` passed with 0 errors / 2 warnings in `server/api/moments.test.ts` | Not root-wide `npm run lint` |
| Vitest | 67 files passed; 863 tests passed | Not 863 cloud acceptance scenarios; browser legacy tests and mocked/PGlite server tests are included |
| Coverage | Workflow runs Vitest without `--coverage`; upload log says no files found at `test_reports/coverage` | No coverage percentage or coverage artifact was verified |
| Browser build | `npm run build` and bundle-secret scanner/test steps passed | No `build:server` + `start:server` deployment smoke, real provider session, or live-host verification |
| PostgreSQL | P0 job uses PostgreSQL 16 and applies every `db/migrations/*.sql` via `psql` before seeding | This is not validation of the normal `npm run db:migrate` path or an existing-install upgrade |
| P0 Playwright | Report: total 100, expected 96, unexpected 0, flaky 0, skipped 4 | Not 25 complete scenarios; not all E2E files; not cross-browser UI acceptance |

The four project names are `chromium`, `firefox`, `safari`, and `mobile-chrome`. The same 25 named cases are scheduled under each: A01 is `test.fixme` in all four, and the remaining 24 use the API `request` fixture. Thus the 96 passes are repetitions of API assertions, not 96 distinct product flows or evidence that four browser UIs were exercised. CI invokes only `npx playwright test e2e/p0-acceptance.spec.js`.

The suite's health probe skips tests when the runtime is unavailable. That did not skip the 24 active cases in this inspected run, but it is unsafe as the sole release gate. Required infrastructure/scenario absence must fail release acceptance.

Manifest snapshot: app version `0.4.1`, React `^19.3.1`, Tailwind CSS `^4.1.17`, Vite `^8.3.5`, Fastify `^5.12.7`, Drizzle ORM `0.45.4`. These are manifest declarations, not a new installation. `npm` / `package-lock.json` is authoritative; baseline commit #51 removed obsolete pnpm files. Suggested queue/cache libraries in architecture docs are not proof those libraries or equivalent durable behavior are integrated.

## 3. Implementation and test map

| Area | Source/test evidence | Current delivery status |
| --- | --- | --- |
| Web cloud bridge | `src/api/cloud-adapter.ts`, `cloud-bridge.tsx`, `client.ts`; adapter/client/cloud-window tests | Partial. Cloud mode requires flag `true` or `1`; missing flag retains legacy behavior. Bridge bootstraps via dev-signin. Production sign-in and the selected deployed UI mode are not certified here |
| Provider boundary | `server/api/ai.ts` proxies `/v1/ai/complete`; generation/model-gateway tests | Proxy keeps provider credentials server-side, but explicitly preserves legacy browser prompt/tool orchestration. Proxying a model is not migration of social authority |
| Auth/social/hidden access | `server/api/auth.ts`, `social.ts`, `friend-requests.ts`, `group-invitations.ts`, `hidden-ai.ts`; corresponding session/social/hidden tests | Substantive API/domain coverage. Full multi-user UI, identity-link behavior and all hidden-content surfaces still require scenario evidence |
| Human messages/replay | `server/api/messages.ts`; `server/api/robustness.test.ts` | Implemented advisory-lock sequence allocation, bounded collision retry and idempotent human-message storage. Does not certify all AI/proactive writers or atomic event projection |
| Independent attention | `server/runtime/attention/engine.ts`, `engine.test.ts` | Scaffold: eligibility/guards exist; `decideForActor` returns wait for characters, not model-based independent decisions |
| Reply generation | `server/services/generation.ts`, `generation.test.ts` | Implemented separately: prompt compilation, gateway calls, bubbles, weather round, empty-response recovery and memory patches. Not an integrated independent-attention/cascade pipeline |
| Memories/narratives | `server/runtime/prompts/compiler.ts`, `compiler.test.ts`; `server/services/narrative.ts`, `narrative.test.ts` | Substantive filter/grant/version tests; unresolved narrative and generated-memory scope risks below prevent complete privacy/continuity acceptance |
| Moments | `server/api/moments.ts`, `moments.test.ts`; cloud Moments services/context tests | Implemented audience-aware feed, block handling, pagination, interaction/event transaction and replay. Observation-to-memory-to-later-chat closure is not demonstrated |
| Offline life/proactive | `server/workers/life-scheduler.ts`, `offline-scheduler.ts`, `proactive.ts`, `quiet-hours.ts` and tests | Tick/scheduler/policy behavior tested. Standard server startup does not establish worker startup, durable recovery, production scheduling or real push delivery |
| Character invitations | `server/workers/character-invitations.ts` and tests | Friend-request decision worker has tests. Group-invite autonomous confirmation must be traced separately; friend-request coverage is not group-confirmation proof |
| Companion capabilities | capability APIs, media adapters, settings tests, generation weather tests | Permission/failure/audit branches covered at component/API level; real provider receipts and confirmed live calendar writes were not verified |

## 4. Review findings and required repairs

These are source-level findings and missing proofs, not claims that a production incident was reproduced. They are priorities for the next implementation PRs; this documentation update does not fix the runtime.

### R1 — P0: independent decisions are not wired into a complete cloud turn

`AttentionRuntime.decideForActor()` in `server/runtime/attention/engine.ts` explicitly remains a stub: characters receive `wait`, humans `no_action`. `generateRepliesForConversation()` in `server/services/generation.ts` instead iterates all active characters and solicits reply content. Its outer catch also means a non-recovered actor failure can prevent later actors in that invocation from running. There is no established per-actor wait/reconsider/ignore lifecycle in that function.

`server/api/messages.ts` writes `message_sent` / `message_burst_closed` events, but the inspected route does not call these attention/generation services. `server/index.ts` registers routes and realtime, not the offline scheduler or an attention consumer. Default-branch symbol searches for `produceDecisions`, `generateRepliesForConversation`, and `createOfflineScheduler` found definitions/tests, not a production caller. An alternative entrypoint must be shown before claiming deployed wiring; search absence alone is not proof no external deployment exists.

Required proof: a user burst reaches a registered worker; separately authorized actor inputs produce separately persisted decisions; reply/wait/ignore differ; typing/new-message/reply/deadline wakes wait; actor failure is isolated; AI-to-AI continuation is bounded by shared cascade state, novelty and operational budgets. Do not convert silence into a mandatory apology when it was an intentional no-action decision. Close A05-A07 with actual behavior assertions.

### R2 — P0: prompt privacy has bypass paths outside the tested scoped-memory case

In `server/runtime/prompts/compiler.ts`, `compilePrompt()` calls `renderRelationship(db, actor.id)` without the target conversation. That helper loads up to 16 relationships for the actor and injects their latest `currentDynamic` regardless of the current audience. Private relationship summaries could therefore enter an unrelated conversation even when the memory section correctly excludes scoped private items.

In `server/services/generation.ts`, `persistMemoryPatches()` sets `relationshipId: null`, uses model-proposed `patch.type`, and forces empty visibility/share policies. In the compiler, `isMemoryPermittedInConversation()` allows non-private types, and also permits private memories without a relationship as owner-wide knowledge. Rejecting a model-supplied policy alone does not preserve the private source's scope. A human fact learned in a DM must not become globally disclosable just because it is re-recorded as the character's own memory. No live disclosure was reproduced in this review.

Required proof: audience-scope every prompt section; derive memory scope/provenance from the authorized source, not model labels; distinguish permission to know from permission to disclose. Add regressions using the real generated-memory write path, a private relationship narrative, another human, a group, and an indirect AI-to-AI relay. Apply block/deletion/grant revocation through derived memories and summaries. Close the relevant A08-A10 negative paths, not just hand-constructed memory fixtures.

### R3 — P0 before enabling shared generation: unify graph, sequence and replay authority

`generateRepliesForConversation()` writes reply events with a fixed demo `socialGraphId` (`00000000-0000-0000-0000-000000000001`). It allocates sequences with `MAX(sequence)+1` without the advisory-lock/retry protocol used by the human message route. Its `ai:${id}` key is based on a new random message ID on each execution, not a stable decision/job identity. These are multi-graph, concurrent-write and job-replay risks even though the existing human-message concurrency tests pass.

The human message route also inserts its world event after the message transaction and suppresses event-write failures; burst-close event persistence is best-effort. A stored message can therefore lack the event needed by attention or memory projection.

Required proof: authoritative graph resolution, one safe allocation protocol across all writers, stable decision/bubble idempotency, transactional event/outbox persistence, and retry/restart tests. Exercise simultaneous human+AI writes, repeated generation jobs, two non-demo social graphs, event-write failure and worker crash after commit. Preserve truthful errors without dropping accepted events.

### R4 — P0 continuity: a Moment view is not yet proof of recalled knowledge

The interaction route in `server/api/moments.ts` persists a `momentInteractions` row and a `worldEvents` entry (`moment_viewed` / reaction / comment) atomically. It does not itself write a memory. The inspected prompt compiler reads memory rows and recent conversation messages; it does not turn Moment-view events into memory. The `moment_viewed` source search found event definitions, the API and its tests, not an end-to-end projector consumer. A18 currently only creates a restricted post.

Required proof: trace an actual authorized view through an idempotent event consumer into actor-specific observation/provenance and later chat. An eligible-but-not-viewing actor and a denied actor must not know it; viewing is not permission to share. Handle replay, edits/deletion and grant changes. Keep the canonical native-world event distinct from the post expressing it. Close A17-A18 with both positive and negative recall cases.

### R5 — P0 release bootstrap: migration execution differs between CI and the app

`db/migrate.ts` invokes Drizzle's folder migrator. `db/migrations/meta/_journal.json` lists only `0000_init_cloud_runtime`. The CI workflow explicitly bypasses that limitation by applying all SQL files with `psql`. Consequently the green PostgreSQL job is not evidence that the advertised migration command installs the same schema. Drizzle's [migration reader](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/migrator.ts) selects migration files from journal entries; inspect the installed version when repairing this path.

Required proof: reconcile migration history safely, including environments previously bootstrapped outside Drizzle; do not blindly replay destructive SQL. Use the supported migrator for clean PostgreSQL installation, upgrade from a known older snapshot, and a second no-op migration run. Assert the expected tables/columns/indexes and align CI with the release command. Validate `build:server` and `start:server`, not only `tsx` development boot.

### R6 — P0 acceptance integrity: scenario names overstate actual assertions

See the exact matrix below. Preserve useful component/domain tests, but replace placeholder E2E assertions with behavior. Required acceptance must fail on unreachable infrastructure and prohibited skips. Separate deterministic model-driven integration from a small authorized real-provider release suite. Add real browser assertions for the selected cloud mode; four API project configurations are not browser coverage.

### R7 — P1 after safety and turn closure: offline execution needs deployment/recovery proof

`createOfflineScheduler()` is in-process timer orchestration over `runLifeTick()`; tests verify sparse/coalesced ticks. Worker functions and proactive quiet-hours/idempotency tests are valuable, but do not prove an operational scheduler, persisted leases/checkpoints, restart recovery, multiple-worker exclusion or APNs delivery. Standard `server/index.ts` does not start this scheduler.

Required proof: identify and test the real worker entrypoint, use durable due-work state and ownership, recover after restart, keep no-op ticks quiet, enforce spend/expiry/time-zone limits, persist proactive messages before notification, and make notification taps reopen the exact conversation/message. Close A16/A19 using an all-clients-closed interval, worker restart and reconnection, not just direct tick calls.

## 5. A01-A25: what the existing P0 spec actually proves

All rows refer to `e2e/p0-acceptance.spec.js` at the pinned commit. The “missing” column is a minimum gap, not a replacement for the full contract in ACCEPTANCE.md. A passing partial assertion does not mark the full scenario accepted; stronger domain tests remain credited separately in section 3.

| ID | Actual P0 assertion | Still needed for full acceptance |
| --- | --- | --- |
| A01 | `test.fixme`; skipped | Real cloud landing, accepted Mira, unread first message, privacy and cross-device resumption |
| A02 | Onboarding state belongs to a small allowed set | Conversation-derived facts/provenance, settings, interruptions and resumption |
| A03 | Seed actor names contain Mira/Luna/Max | Contrasting real introductions, independent accept/decline/ignore, rendered contacts |
| A04 | Creating a group returns 201 | Pending state, no pre-accept access, each human/AI decision, departure |
| A05 | Four message POSTs and manual burst-close succeed | Typing-aware automatic aggregation, one burst/decision wake-up, no duplicate replies |
| A06 | Dev-signin returns an access token | Actual independent reply/wait/ignore/private-action decisions and natural dormancy |
| A07 | Dev-signin returns an access token | Multi-actor continuation, novelty, budgets, fault isolation and operational stop record |
| A08 | A memory POST is accepted | Real group source, distinct actor interpretation, later private recall and nonparticipant exclusion |
| A09 | Dev-signin returns an access token | Private information absent from all unauthorized prompt/output/relay paths |
| A10 | Hidden endpoint returns either 200 or 403 | Strict human transcript denial with nonempty fixtures across list/read/sync/search/export/debug; authorized audit separate |
| A11 | Friend-request POST returns 200/201 | Human/AI direction symmetry, refusal, DM consent and blocked behavior |
| A12 | Dev-signin returns an access token | Group introduction causes permitted contact; disabled consent prevents delivery |
| A13 | Dev-signin returns an access token | Two humans complete invitation, friendship and mixed-group authorization flows |
| A14 | Dev-signin returns an access token | One public projection, separate private histories, no duplicate generation, continuity after unfriend |
| A15 | GET of a dummy invitation returns 200/404 | Real character refusal/leave, visible state and relationship narrative update |
| A16 | Dev-signin returns an access token | All-clients-offline scheduler advances coherently within budget and survives restart |
| A17 | Moment POST returns 200/201 | Canonical life event is recalled consistently, rather than contradictory inventions |
| A18 | Restricted Moment POST returns 200/201 | Real view -> authorized memory -> later chat; no knowledge for non-viewers |
| A19 | Proactive-intent POST returns 200/201 | Worker sends once, quiet-hours/expiry/replay behavior, notification reopening |
| A20 | Weather status is 200 or 502 | Consent and truthful result provenance/failure rendered in the actual conversation |
| A21 | Calendar proposal reports `requiresConfirmation: true` | Read flow, explicit confirmation, provider receipt, cancellation and no premature success claim |
| A22 | Search status is 200 or 502 | Bounded execution, provenance, authorized scope and truthful provider failure |
| A23 | Two POSTs with the same key both return 200/201 | Same server ID, one stored message, browser outbox/reconnect/reload reconciliation |
| A24 | Dev-signin returns an access token | Block vs unfriend consequences, prohibited contact and retained/deleted state |
| A25 | Delete endpoint returns `ok` and `deletionStartedAt` | Actual deletion/revocation/retention-policy outcomes, inaccessible old sessions and data |

## 6. How to update this ledger

For the next code change, record baseline SHA, affected source paths, caller/wiring proof, exact test command or Actions URL, fixture/model mode, passed/failed/skipped counts, remaining acceptance clauses and any deployment evidence. Do not carry these historical counts forward as new results.

Recommended verification sequence (commands are a plan, not claimed executions in this review):

```sh
npm ci
npm run typecheck
npx eslint server shared db src/api src/sync
npm test
npm run build
```

Run root-wide lint, coverage and the relevant cloud browser specs separately when claiming those gates. Repair and test the official migration/build/start path under controlled PostgreSQL before release. Until R5 is repaired, do not present CI's manual SQL loop as validation of `npm run db:migrate`.

Then run deterministic full social scenarios through the real API/worker/UI chain with controlled provider stubs, followed by explicitly authorized real-provider and cross-device release checks. Keep A01-A25 acceptance requirements intact. Update [the current roadmap](../../../../ROADMAP.md) with evidence, not optimistic percentages.
