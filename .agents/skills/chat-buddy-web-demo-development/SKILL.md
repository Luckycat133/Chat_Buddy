---
name: chat-buddy-web-demo-development
description: Implement, refactor, review, and test the cloud-first Chat Buddy Web Demo and its shared companion runtime. Use when working on the React Web client, hosted backend, social graph, human/AI friend requests, mixed groups, Moments, proactive messages, character memory, relationship continuity, actor identity linking, weather/calendar/search capabilities, cloud sync, or demo acceptance.
metadata:
  author: Luckycat133
  version: "2026-08-18-demo-v1"
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

- Product behavior and non-negotiable rules: [references/PRODUCT_CONTRACT.md](references/PRODUCT_CONTRACT.md)
- Complete demo flows and screens: [references/DEMO_EXPERIENCE.md](references/DEMO_EXPERIENCE.md)
- Shared data model, runtime, API, sync, and privacy: [references/DOMAIN_ARCHITECTURE.md](references/DOMAIN_ARCHITECTURE.md)
- Web/backend implementation plan: [references/WEB_IMPLEMENTATION.md](references/WEB_IMPLEMENTATION.md)
- Acceptance scenarios and release gates: [references/ACCEPTANCE.md](references/ACCEPTANCE.md)

When behavior changes, update both the Web and iOS project skills to the same contract version.

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

## Working method

### 1. Inspect before editing

Read the nearest owning files, tests, migrations, and relevant reference. Confirm whether the code is:

- legacy local-only behavior
- Web cloud client
- shared contract
- server runtime
- migration/import compatibility

Do not extend legacy local authority when the change belongs in the cloud path.

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

Do not land a UI-only mock for a behavior that must survive another device or app closure.

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

### 7. Finish cleanly

Run relevant checks, inspect diffs, update fixtures/contracts, and report:

- behavior added or changed
- product invariant preserved
- migrations/contracts changed
- tests run
- known limitation

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

For commands and platform-specific definition of done, follow [references/WEB_IMPLEMENTATION.md](references/WEB_IMPLEMENTATION.md).
