---
name: chat-buddy-web-demo-development
description: Implement, refactor, review, and test the cloud-first Chat Buddy Web Demo and its shared companion runtime. Use when working on the React Web client, hosted backend, social graph, human/AI friend requests, mixed groups, Moments, proactive messages, character memory, relationship continuity, actor identity linking, weather/calendar/search capabilities, cloud sync, or demo acceptance.
metadata:
  author: Luckycat133
  version: "2026-11-15-audit-1"
  contract_version: "2026-08-18-demo-v1"
  product: chat-buddy
  platform: web-cloud
---

# Chat Buddy Web Demo Development

Build the Web client and the single shared cloud runtime for Chat Buddy's TestFlight/Web demo.

## Product outcome

Chat Buddy is a WeChat-style social app where human users and AI characters are first-class contacts. Characters have fixed public identities, separate relationships, memories with provenance, social agency, offline life, Moments, and friend-level capabilities. The demo succeeds when users voluntarily return because a character or shared social event continued without them.

Do not reinterpret the product as:

- a generic chatbot shell
- a professional multi-Agent workspace
- a visible affection game
- a visual novel or navigable cross-dimensional world
- a panel where every AI answers every user message

## Read the references

Load only what the task requires:

- Current delivery facts, reviewed CI evidence, gaps, and source anchors: [references/DELIVERY_STATUS.md](references/DELIVERY_STATUS.md). Read this first for reviews, status updates, or hosted-runtime work.
- Current implementation priorities and exit gates: [../../../ROADMAP.md](../../../ROADMAP.md)
- Product behavior and non-negotiable rules: [references/PRODUCT_CONTRACT.md](references/PRODUCT_CONTRACT.md)
- Complete demo flows and screens: [references/DEMO_EXPERIENCE.md](references/DEMO_EXPERIENCE.md)
- Shared data model, runtime, API, sync, and privacy: [references/DOMAIN_ARCHITECTURE.md](references/DOMAIN_ARCHITECTURE.md)
- Web/backend implementation plan: [references/WEB_IMPLEMENTATION.md](references/WEB_IMPLEMENTATION.md)
- Acceptance scenarios and release gates: [references/ACCEPTANCE.md](references/ACCEPTANCE.md)

When behavior changes, update both the Web and iOS project skills to the same contract version. The November 2026 audit changes delivery evidence, not the product contract; it does not certify the iOS repository.

## Settled product decisions

Treat these as requirements, not questions to reopen:

1. Web is the fastest product-development client and owns the cloud companion runtime.
2. iOS and Web call the same hosted runtime; do not maintain a second AI pipeline.
3. TestFlight/Web demo uses hosted model and cloud data; testers do not bring keys.
4. Future free mode may use BYOK plus local storage; future paid mode adds hosted models, sync, and professional agents.
5. AI and humans can send friend requests, DM, create groups, invite, accept, decline, leave, post Moments, delete, and block.
6. Every human and AI invitee confirms group membership.
7. Group participation has no visible fixed AI reply count; each AI independently waits, ignores, replies, or acts.
8. Consecutive user messages are aggregated into one expression burst for AI attention.
9. Group and visible Moment memories may influence private chat; unrelated private branches may not.
10. AI-to-AI private chats are hidden from human clients. Characters may disclose, conceal, or socially lie when asked.
11. Tool, permission, account, payment, and external-action facts must remain truthful.
12. Relationships are narrative and implicit. Do not display or rely primarily on affinity numbers.
13. Characters live in their original settings; Chat Buddy is only the communication medium. Do not build game-world traversal.
14. Character public identity is fixed. Users may set a private remark only.
15. Same-template actors partially link in shared contexts: one public identity, separate private relationships, shared future events, no private-history merge.
16. Characters continue through sparse event-driven simulation while users are offline.
17. Moments is mandatory and shares the same event/memory system as chat.
18. Mira / 米拉 is the warm, reliable first official friend and conversational guide.
19. Companion tools are weather, calendar, and bounded web search; deep professional work is out of demo scope.
20. Human friends and mixed human/AI groups are in the demo.

## Locate the implemented path

For a cloud/runtime fix, read [references/DELIVERY_STATUS.md](references/DELIVERY_STATUS.md) and the source-and-test map at the end of [references/WEB_IMPLEMENTATION.md](references/WEB_IMPLEMENTATION.md) before following its target architecture. The older source map is navigation, not a delivery certificate. Product contracts remain unchanged; source presence alone does not prove a wired or deployed service.

The reviewed baseline is `remake@be4d237eeeaf80b7116b0445b01bfcc4c0933fcb` (2026-11-12). It has substantive cloud APIs and domain regressions, but independent attention, complete social-event-to-memory continuity, and release acceptance remain incomplete. Never import the legacy 15-theme roadmap's Done labels into the hosted-demo status.

## Delivery evidence protocol

Keep these evidence levels separate: **implemented**, **tested at a named layer**, **full scenario accepted**, and **deployed/live verified**. A stub, schema, source comment, mocked response, successful HTTP status, or green job title cannot promote a feature to the next level.

For every status change, record the commit, source entrypoint and callers, assertion/fixture, command or CI run URL, environment/model mode, result including skips, and remaining gap. Distinguish a historical Actions run from a check executed in the current session. Update DELIVERY_STATUS and ROADMAP together; do not copy old counts to a new commit.

The reviewed CI has 67 passing Vitest files / 863 tests. Its P0 Playwright artifact has 96 passes and 4 skips: 24 API-level tests repeated across four configured projects, with A01 skipped in all four. Several named scenarios only assert dev-signin success. This is not A01-A25 product acceptance or cross-browser UI proof. Coverage was not generated in that run. See the ledger for exact scope and evidence.

For a release gate, missing runtime infrastructure must fail rather than silently skip required scenarios. Assert the social consequence, not just a token, 2xx response, or test name. Preserve useful domain tests while replacing shallow acceptance checks. Do not weaken ACCEPTANCE.md to fit current code.

Use `npm ci` and `package-lock.json`; do not restore a second package-manager lock incidentally. Report scoped CI lint separately from `npm run lint`. Treat `npm run db:migrate`, all-SQL CI bootstrapping, and PGlite setup as different paths until their schema equivalence and upgrade behavior are proven.

## Working method

### 1. Inspect before editing

Read the nearest owning files, tests, migrations, and relevant reference. Confirm whether the code is:

- legacy local-only behavior
- Web cloud client
- shared contract
- server runtime
- migration/import compatibility

Do not extend legacy local authority when the change belongs in the cloud path. Trace the selected browser mode and the actual server/worker entrypoint; a provider-key proxy is not a server-authoritative social runtime. At the reviewed baseline, `cloudEnabled()` requires `VITE_USE_CLOUD=true` or `1`; missing flags retain legacy behavior.

### 2. Classify the change

Choose one primary class:

- product contract
- shared schema/API
- social graph and authorization
- conversation/realtime/sync
- companion runtime
- memory/relationship
- Moments/world events
- proactive scheduler
- capabilities
- Web UI
- migration/data rights
- tests/observability

Load the matching reference sections before implementation.

### 3. Protect invariants first

Before model or UI work, verify:

- which actor is acting
- who may see the source event
- which memories may enter the prompt
- whether each invitee accepted
- whether the target allows direct/proactive contact
- whether a client action requires confirmation
- whether an identity link changes only public projection

Authorization is server-side. Client filtering is never sufficient.

Apply audience authorization to every prompt section, including relationship narratives and derived memories. Model-generated memory must inherit its source conversation/relationship and disclosure constraints; an empty policy or `relationshipId: null` is not evidence that a human secret is actor-global knowledge. Revalidate deletion, supersession, grants, block state, and actual observation when projecting and recalling it.

### 4. Implement a vertical slice

For a user-visible behavior, include:

- contract/schema
- database migration
- repository/service
- event emission
- runtime behavior when relevant
- API/realtime delivery
- Web cache/state
- UI states
- observability
- tests

Do not land a UI-only mock for a behavior that must survive another device or app closure. Show worker registration, restart recovery, job ownership, and replay behavior; exported tick functions and in-process timers alone are not durable offline delivery.

### 5. Keep AI output subordinate to domain rules

Model output proposes actions. Validate:

- actor and target IDs
- membership
- visibility
- share policy
- external-action state
- duplicate/cascade guards
- character template/canon compatibility

Persist approved actions and source events. Never store or expose chain-of-thought.

An eligible actor is not automatically a speaking actor. Persist an independently attributable decision before executing it; distinguish intentional wait/no_action from provider failure. Carry cascade identity, budgets, retry state, and wait wake-up conditions across jobs. A failed actor must not prevent independent peers from completing.

Human, AI, and proactive message writers must share safe per-conversation sequence allocation and stable operation-derived idempotency. Resolve the real social graph from authorized domain state, never a demo UUID. Commit the authoritative message and its required event atomically or through a transactional outbox; swallowing event failures is not a reliable continuity contract.

### 6. Test the social consequence

Do not stop at “message rendered.” Test later effects:

- group event becomes authorized private memory
- unauthorized memory stays absent
- Moment affects only actual viewers
- invitation refusal changes relationship history
- offline event is recalled consistently
- proactive intent sends once
- same-template link avoids duplicate public actors
- group cascade becomes dormant without a visible reply cap

Include negative paths for uninvited/declined members, non-viewers, unrelated humans, private narrative summaries, newly generated memories, replay after restart, and concurrent human/AI writes. Test schema-valid but unauthorized model actions, not just malformed JSON.

### 7. Finish cleanly

Run relevant checks, inspect diffs, update fixtures/contracts, and report:

- behavior added or changed
- product invariant preserved
- migrations/contracts changed
- tests run, environment, and skipped cases
- implementation/test/acceptance/deployment status separately
- known limitation

Do not run billable providers, send real invitations/messages, or perform destructive account operations merely to refresh documentation. Use controlled fixtures and obtain explicit authorization for live acceptance actions.

## Current-repository corrections

The current project began as a browser-local React app. For hosted demo work:

- do not keep provider keys in `VITE_*` production variables
- do not call hosted models directly from the browser
- do not use local timers as durable proactive messages
- do not persist cloud-authoritative chats as one localStorage array
- do not let `ChatEngine` or `AIPipeline` remain the only source of behavior in `src/`
- do not copy one global memory summary into every persona
- do not select one random group responder as the final social model
- do not disable the composer while AI replies
- do not preserve visible affinity/progress mechanics in the new experience
- do preserve legacy import compatibility until migration is complete

## Default design choices

When the references do not specify a low-level detail, choose the simplest design that preserves:

1. privacy and information provenance
2. relationship continuity
3. natural chat UX
4. server authority
5. cross-platform contracts
6. testability
7. demo delivery speed

Do not ask the product owner to decide routine implementation details already implied by these priorities. Record a reversible assumption and proceed.

## Quality bar

A change is not done unless:

- denied and failure states are designed
- English and Simplified Chinese are complete
- accessibility is preserved
- current and offline/reconnect paths are covered
- model/provider failure is visible and truthful
- no private cross-user data is exposed
- no hidden AI transcript reaches human APIs
- no uncontrolled AI cascade remains
- tests match [references/ACCEPTANCE.md](references/ACCEPTANCE.md)

For commands and platform-specific definition of done, follow [references/WEB_IMPLEMENTATION.md](references/WEB_IMPLEMENTATION.md). For what has actually been verified, use [references/DELIVERY_STATUS.md](references/DELIVERY_STATUS.md), not the target architecture or legacy completion labels.
