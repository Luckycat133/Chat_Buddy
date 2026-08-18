# Web Demo Implementation Plan

**Repository:** `Luckycat133/Chat_Buddy`  
**Default branch:** `remake`  
**Role:** product-leading Web client plus cloud runtime/backend source of truth

## 1. Ownership boundary

This repository owns:

- shared product contracts
- cloud API
- social graph
- companion runtime
- memory and relationship engine
- world event engine
- proactive scheduler
- model and capability gateway
- Web UI
- contract and runtime acceptance tests

The iOS repository consumes versioned contracts and APIs. Do not port new AI orchestration into Swift.

## 2. Incremental repository layout

Do not stop feature work for a large repository move. Evolve the current repository incrementally:

```text
src/                              existing React client
  api/                            generated/typed cloud client
  sync/                           browser cache and delta sync
  features/
    auth/
    contacts/
    chat/
    moments/
    settings/
server/
  index.ts
  config/
  api/
  auth/
  realtime/
  repositories/
  services/
  runtime/
    attention/
    prompts/
    actions/
    memory/
    relationships/
    simulation/
  workers/
  capabilities/
  policy/
  observability/
shared/
  contracts/
  schemas/
  events/
  test-fixtures/
db/
  migrations/
  seeds/
```

Keep old local-only modules during migration, but mark ownership:

- `legacy-local`: import/read compatibility only
- `cloud-client`: new client behavior
- `server-runtime`: authoritative hosted behavior

## 3. Selected demo stack

Use a conventional, inspectable stack:

- Node.js compatible with the repository's documented supported versions
- TypeScript for `server/` and `shared/`
- Fastify for HTTP and WebSocket gateway
- PostgreSQL
- Drizzle ORM and checked SQL migrations
- `pg-boss` or an equivalent PostgreSQL-backed durable queue
- S3-compatible object storage for images and exports
- Zod plus JSON Schema/OpenAPI generation for external contracts
- TanStack Query for Web server state
- IndexedDB for browser cache and offline outbox
- existing React, Vite, Tailwind, Vitest, Playwright, MSW, and accessibility tooling

Do not expose provider keys through `VITE_*` variables in hosted builds.

## 4. Cloud API bootstrap

### 4.1 Server process

Create a server entry that provides:

- configuration validation
- structured logging
- request ID
- authentication hook
- authorization context
- REST API
- WebSocket upgrade
- health and readiness
- graceful shutdown
- queue worker entrypoint separate from HTTP process

### 4.2 Environment classes

Separate variables:

```text
DATABASE_URL
SESSION_SIGNING_KEY
APPLE_CLIENT_ID
APPLE_TEAM_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY
MAGIC_LINK_FROM
OBJECT_STORAGE_*
MODEL_GATEWAY_*
SEARCH_PROVIDER_*
WEATHER_PROVIDER_*
APNS_*
PUBLIC_WEB_URL
```

Validate at startup. Never log secrets.

### 4.3 Authentication

Implement:

- Sign in with Apple token verification
- email magic link for Web
- short access session
- rotating refresh session
- secure HTTP-only browser cookie
- device/session revocation

The API derives `account_id` and `human_actor_id`; clients cannot choose them.

## 5. Database migrations

Create migrations in dependency order:

1. accounts, sessions, devices
2. social_graphs, actors, persona_templates, character_actors
3. relationships, preferences, requests
4. conversations, members, invitations, messages, bursts
5. world_events and projections
6. Moments and interactions
7. memories, grants, relationship narratives
8. proactive intents, jobs, tool executions
9. reports, blocks, audit records
10. identity links

Migration requirements:

- reversible where safe
- foreign keys
- uniqueness for actor pairs and idempotency keys
- row-level repository authorization tests
- no free-form JSON where a stable column is needed for permissions

## 6. Shared contracts

All client-visible payloads live in `shared/contracts` and are exported as:

- TypeScript types
- runtime validators
- OpenAPI schemas
- JSON Schema snapshot for iOS generation/review

Required contract groups:

- auth
- sync envelope
- actor/profile
- relationship and requests
- conversation/member/invitation
- message and stream
- Moment
- settings/capabilities
- client action
- error envelope

Standard error:

```json
{
  "error": {
    "code": "GROUP_INVITATION_REQUIRED",
    "message": "Human-readable localized fallback",
    "request_id": "..."
  }
}
```

Clients branch on `code`, not English message text.

## 7. Web client information architecture

Replace Dashboard as the primary landing route.

```text
/chats                         default
/chats/:conversationId
/contacts
/contacts/requests
/contacts/:actorId
/moments
/moments/:momentId
/settings
/settings/privacy
/settings/capabilities
/settings/data
/onboarding/:conversationId
```

Desktop:

- left navigation rail
- conversation/contact list
- active content pane
- optional details drawer

Mobile Web:

- one primary pane
- bottom navigation
- native-feeling back navigation
- no desktop-only controls required for core flow

## 8. Web state architecture

### Server state

Use TanStack Query for:

- actor lists
- requests
- conversations
- message pages
- Moments
- settings

### Realtime

Create one authenticated WebSocket manager:

- resumes after connection loss
- applies ordered events
- detects sequence gaps
- triggers delta sync
- deduplicates event IDs
- exposes connection state

### Local cache

Use IndexedDB for:

- normalized entities
- paginated message cache
- Moments cache
- sync cursor
- outbound outbox
- legacy import staging

Do not continue writing cloud-authoritative chats to the old whole-array localStorage key.

### Optimistic messages

1. create client idempotency key
2. insert local `queued` message
3. send request
4. replace with accepted server message
5. retain failure state and retry control
6. reconcile realtime duplicate

## 9. Companion runtime extraction

Current `src/core/chat/AIPipeline.js` and `ChatEngine.js` contain useful behavior but are browser-coupled.

Extract concepts, not code blindly.

### Move server-side

- prompt compilation
- context selection
- actor attention decisions
- tool authorization
- model calls and streaming
- memory extraction
- relationship updates
- AI-to-AI hidden conversations
- offline simulation
- proactive scheduling
- cost and loop guards

### Keep client-side

- rendering
- local optimistic state
- typing indicators received from server
- message composer
- confirmation UI for client actions
- local cache
- media selection/compression

### Remove from hosted client

- model API keys
- direct OpenRouter/OpenAI calls
- browser tool execution for authoritative actions
- client-generated AI messages
- local timers pretending to be durable proactive messages

## 10. Prompt compiler

Compile prompts from explicit sections:

1. immutable persona template
2. current actor/native-world state
3. current relationship narrative
4. permitted private/shared/public memories with provenance
5. current conversation burst
6. recent relevant conversation events
7. current social/availability context
8. capability availability
9. output/action schema
10. product policy

Rules:

- never inject another human's private relationship branch
- never inject all memories merely because token budget permits
- include source type when reported/inferred facts could be uncertain
- preserve latest user burst completely unless provider hard limit forces truncation
- use model-facing IDs that are mapped and validated server-side

## 11. Attention engine

### Eligibility prefilter

Pure code filters:

- active membership
- block state
- invite accepted
- actor available
- sender is not the same actor
- no unresolved duplicate job
- message visible
- re-entry cooldown

### Independent decision

Each eligible character receives its own authorized context and produces one decision record.

For demo cost control, the server may submit a batched request whose JSON contains separate actor inputs, provided:

- no private context from actor A is visible to actor B
- each output is independently attributable
- failures can be retried per actor
- the decision remains testable

### Direct mentions

A mention raises attention but does not force a reply when the character would plausibly refuse or wait.

### Wait behavior

`wait` is first-class. Re-evaluate when:

- burst closes
- sender stops typing
- another actor replies
- wait deadline expires

## 12. Response and action runtime

Persist an AI message placeholder before streaming so all clients share one ID.

Stream events:

```text
ai_message.started
ai_message.delta
ai_message.completed
ai_message.failed
```

On completion:

- sanitize/render-safe text
- validate structured action proposals
- persist message
- append WorldEvents
- apply memory patches
- version relationship narrative
- queue tools/social actions
- wake eligible actors

A failed stream produces a visible retryable message state; do not hide generated user messages or silently retry model calls without policy.

## 13. Hidden AI conversations

Create real `hidden_ai_direct` conversations.

API rules:

- normal human endpoints do not return them
- actor runtime may load only participant conversations
- audit endpoint is administrative and separately authorized
- content is encrypted at rest like other messages
- events can produce permitted reported memory
- human privacy share policies still apply

When a human asks what two AIs discussed, the character generates a social response from its memory; the API does not reveal hidden transcript.

## 14. Character life simulation

Worker query selects due character actors.

Frequency is adaptive:

- recently active actors: more opportunities
- quiet or busy characters: fewer
- no forced event when nothing meaningful exists
- cap total background model spend per social graph

Candidate output is validated before publication.

For a Moment:

1. create native-world event
2. create Moment
3. record audience
4. send realtime event
5. optionally schedule other characters' view decisions

For an AI-to-AI message:

1. verify relationship/contact permission
2. append hidden message
3. run recipient attention asynchronously
4. preserve provenance

## 15. Proactive message implementation

Use queue jobs keyed by `ProactiveIntent.id`.

At creation:

- validate friend/DM state
- calculate not-before and expiration
- apply quiet hours
- set dedupe key

At execution:

- revalidate state
- compile latest prompt
- generate final text
- persist message
- notify Web realtime
- send APNs through backend
- record delivery attempts

Add a developer-only inspector showing intent reason, source event, due time, and status. Do not expose relationship scores or hidden AI transcript.

## 16. Moments implementation

Refactor the existing Moments context/service into API-backed features.

Required:

- cursor pagination
- audience enforcement on server
- optimistic reaction/comment
- image upload with signed URLs
- actual-view event
- character interaction jobs
- later chat retrieval by event/memory relevance

Remove template-only background posting from hosted mode. Character-generated posts must originate from the server runtime and become events.

## 17. Contacts and groups

### Friend requests

UI states:

- incoming
- outgoing
- accepted
- declined
- blocked

Character request decisions occur asynchronously and appear like real request decisions.

### Group creation

Wizard:

1. choose purpose/name
2. select humans and characters
3. review members
4. send invitations
5. show pending decisions
6. activate when membership rule is satisfied

Do not insert invited actors into the active member list before acceptance.

### AI-created groups

The AI runtime may propose a group. Humans see an invitation and confirm. AI invitees run the same decision path.

## 18. Guide onboarding implementation

Create Mira as a versioned template and seeded actor.

Use a server-managed onboarding state machine, but express it through ordinary messages.

States:

```text
welcome
learn_name
learn_need
learn_quiet_hours
learn_social_preference
learn_open_thread
recommend_characters
friend_requests
propose_group
introduce_moments
complete
```

The state machine:

- prevents missing essential setup
- does not force fixed copy
- allows detours and normal conversation
- stores only user-provided facts
- can resume across devices
- stops acting like a tutorial after completion

## 19. Capabilities

### Weather

Server tool called from runtime. Web can request city or browser approximate location after user gesture. Store selected city as default.

### Calendar

For Web demo, implement one of:

- connected Google Calendar through OAuth
- demo/internal calendar provider for testers

Expose a common capability contract. Any write proposal appears as a confirmation sheet/modal. Only the connected provider response can mark completion.

### Search

Server performs bounded search. Return citations/source metadata to runtime. UI may show a compact “checked the web” disclosure and expandable sources, not an Agent card.

## 20. Legacy local import

Settings → Data offers import from current browser data.

Flow:

1. detect legacy keys/IndexedDB
2. preview counts
3. choose conversations/Moments/memories
4. upload normalized import batch
5. server validates persona mapping and visibility
6. apply idempotently
7. archive or leave legacy data according to user choice

Do not upload saved runtime API keys.

## 21. Developer diagnostics

Internal builds may expose:

- social graph event timeline
- authorized prompt section IDs, not raw secrets
- selected memory IDs and provenance
- relationship narrative versions
- attention decisions and concise reason
- proactive intent queue
- model request count/latency
- loop circuit-breaker reason
- identity-link projection

Never expose chain-of-thought.

## 22. Test strategy

### Unit

- visibility and permission propagation
- actor identity linking
- relationship pair uniqueness
- burst closing
- attention eligibility
- loop detection
- proactive dedupe
- tool confirmation
- event projection

### Integration

- API authorization
- Postgres migrations
- outbox/realtime ordering
- background jobs
- hidden conversation isolation
- account deletion/anonymization
- import idempotency

### Contract

- generated OpenAPI/JSON schema snapshots
- Web client decodes current schema
- fixture set exported for iOS
- backward-compatible sync envelopes

### E2E

Use Playwright for the scenarios in `ACCEPTANCE.md`.

## 23. Implementation sequence

### P0 — shared truth

- contracts and schemas
- database and auth
- actors/relationships
- conversations/messages/realtime
- Web cloud cache

### P0 — social demo

- requests and group invitations
- Mira onboarding
- mixed group UI
- message burst
- attention decisions
- streamed AI replies

### P0 — continuity

- memory provenance
- relationship narratives
- group-to-private recall
- hidden AI chat
- proactive intents/APNs integration contract

### P0 — life

- Moments API
- character life events
- offline scheduler
- Moment-to-chat continuity

### P1 — human friend completeness

- invite links
- human DM
- block/report
- same-template identity link in shared groups

### P1 — friend capabilities

- weather
- calendar provider
- lightweight search

### P1 — data rights

- import/export
- account deletion
- device/session management

## 24. Web definition of done

A Web change is complete when:

- shared product invariants remain true
- server authorization tests cover any new visibility path
- schemas are validated at runtime
- database migration exists when persistence changes
- Web offline/reconnect behavior is tested
- loading, empty, error, and denied states exist
- English and Simplified Chinese strings are added
- keyboard and accessibility behavior is covered
- unit/integration/E2E tests pass
- `npm run lint`
- `npm run test`
- `npm run build`
- relevant Playwright tests
- prompt/runtime benchmark updated when AI behavior changes
