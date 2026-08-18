# Shared Domain and Cloud Architecture

**Contract version:** `2026-08-18-demo-v1`  
**Source-of-truth owner:** the cloud runtime developed from the Web repository  
**Clients:** Web and iOS

## 1. Target topology

```text
Web client                         iOS client
React/Vite                         SwiftUI
local browser cache                SwiftData cache
        \                           /
         \                         /
          HTTPS + WebSocket + sync cursor
                       |
              Cloud API / Realtime Gateway
                       |
  ┌────────────────────┼────────────────────┐
  │                    │                    │
Social service   Companion runtime    Capability gateway
  │                    │                    │
  └────────────── World event log ──────────┘
                       |
            PostgreSQL + object storage
                       |
          durable job queue / scheduler
                       |
          model providers + APNs/email
```

The cloud runtime is authoritative for the hosted demo. Web and iOS do not maintain competing AI behavior implementations.

## 2. Architectural rules

1. Domain rules are shared and transport-independent.
2. Every social action is represented by an immutable event plus current projections.
3. Clients use stable server IDs; do not manufacture authoritative IDs locally.
4. Messages are append-first. Edits, deletion, recall, and moderation create state transitions or events.
5. Private knowledge is actor-scoped and provenance-aware.
6. Model output is a proposal. The runtime validates permissions and invariants before persistence.
7. AI behavior must be reproducible from event history, template version, model configuration, and decision metadata without storing chain-of-thought.
8. Hosted model credentials live only on the server.
9. The iOS app is a client, not a second companion runtime.
10. Local/BYOK mode later implements the same repository and event contracts.

## 3. Core identifiers and tenancy

Use opaque stable IDs, preferably UUIDv7 or equivalent sortable IDs.

Every stored object includes the appropriate ownership boundary:

- `account_id` for a human account
- `social_graph_id` for connected-world isolation
- `actor_id` for a human or character identity
- `conversation_id` for visibility
- `source_event_id` for provenance

Never query by template ID alone when actor identity or relationship scope is required.

## 4. Domain entities

### 4.1 Account

```text
Account
- id
- status: active | suspended | deleting | deleted
- primary_email
- apple_subject
- display_name
- locale
- timezone
- created_at
- deleted_at
```

Account is authentication and data-rights identity. It is not directly used as a message sender; each account owns one `human` actor.

### 4.2 Actor

```text
Actor
- id
- social_graph_id
- type: human | character
- public_name
- avatar_asset_id
- template_id nullable
- status: active | unavailable | blocked | retired
- created_at
- updated_at
```

### 4.3 PersonaTemplate

```text
PersonaTemplate
- id
- slug
- schema_version
- public_name
- localized_names
- native_world
- canon_anchor
- identity_prompt
- values
- flaws
- speaking_style
- routines
- interests
- canonical_relationships
- capabilities
- anti_drift_rules
- examples
- rights_status
- content_policy_profile
- immutable_revision
```

Templates are versioned. Existing actor history keeps the template revision it used; migration to a new revision is explicit.

### 4.4 CharacterActor

```text
CharacterActor
- actor_id
- template_id
- template_revision
- social_graph_id
- public_state
- native_world_state
- availability_state
- last_simulated_at
- next_simulation_after
```

`public_state` contains recent publicly disclosed character facts, not another user's private branch.

### 4.5 SocialGraph

```text
SocialGraph
- id
- status
- created_at
```

A social graph isolates a connected world of human and character actors. Human friendship can connect graphs. Identity links reconcile same-template public identity in shared contexts without copying private history.

### 4.6 ActorIdentityLink

```text
ActorIdentityLink
- id
- canonical_actor_id
- linked_actor_id
- template_id
- created_by_event_id
- active_from
- status
- merge_policy_version
```

Invariants:

- both actors use the same compatible template identity
- private relationship documents are never copied by the link
- shared events after linking project to the canonical public identity
- unlinking or human unfriend does not erase history
- public display in shared conversations resolves to `canonical_actor_id`

### 4.7 Relationship

```text
Relationship
- id
- social_graph_id
- actor_a_id
- actor_b_id
- state: requested | accepted | declined | deleted | blocked
- initiated_by
- created_at
- updated_at
```

Use a canonical actor-pair ordering for uniqueness. Directional settings belong in `RelationshipPreference`.

### 4.8 RelationshipPreference

```text
RelationshipPreference
- relationship_id
- owner_actor_id
- allow_direct_message
- allow_proactive_message
- muted_until
- private_remark
- notification_level
- share_defaults
```

### 4.9 RelationshipNarrative

```text
RelationshipNarrative
- relationship_id
- version
- current_dynamic
- meaningful_history
- trust_and_uncertainty
- tensions
- boundaries
- open_threads
- relationship_direction
- changed_by_event_ids
- generated_at
- model_metadata
```

No affection score is exposed or used as the primary relationship model.

### 4.10 FriendRequest

```text
FriendRequest
- id
- sender_actor_id
- recipient_actor_id
- introduction_event_id nullable
- note
- status: pending | accepted | declined | ignored | cancelled | expired
- expires_at
- decided_at
```

AI recipients receive a runtime decision. Human recipients receive UI.

### 4.11 Conversation

```text
Conversation
- id
- social_graph_id
- type: direct | group | hidden_ai_direct
- public_name nullable
- avatar_asset_id nullable
- created_by_actor_id
- status
- created_at
```

`hidden_ai_direct` cannot be read by normal human clients even when a human has relationships with both participants.

### 4.12 ConversationMember

```text
ConversationMember
- conversation_id
- actor_id
- status: invited | active | declined | left | removed | blocked
- role: member | moderator
- invited_by_actor_id
- joined_at
- left_at
- last_read_sequence
```

A group becomes active only after required confirmations. Do not add an invited actor to message visibility before acceptance.

### 4.13 GroupInvitation

```text
GroupInvitation
- id
- conversation_id
- inviter_actor_id
- invitee_actor_id
- visible_member_snapshot
- purpose
- status
- decision_reason_code nullable
- created_at
- decided_at
```

AI decisions may use relationship context. Store a concise reason code and decision summary, not chain-of-thought.

### 4.14 Message

```text
Message
- id
- conversation_id
- sender_actor_id
- sequence
- client_idempotency_key
- kind: text | image | system | invitation | action_result
- content
- structured_payload
- reply_to_message_id
- burst_id
- status
- created_at
- edited_at
- deleted_at
```

### 4.15 MessageBurst

```text
MessageBurst
- id
- conversation_id
- sender_actor_id
- first_message_sequence
- last_message_sequence
- closed_reason
- opened_at
- closed_at
```

A burst is runtime input grouping, not a replacement for individual messages.

### 4.16 Moment

```text
Moment
- id
- actor_id
- social_graph_id
- content
- media_assets
- audience_policy
- source_event_id
- created_at
- deleted_at
```

### 4.17 MomentInteraction

```text
MomentInteraction
- id
- moment_id
- actor_id
- type: view | reaction | comment | reply
- content nullable
- parent_interaction_id nullable
- created_at
```

Knowledge is granted on actual view/delivery or disclosure, not merely because a post exists.

### 4.18 WorldEvent

```text
WorldEvent
- id
- social_graph_id
- type
- actor_id
- subject_actor_ids
- conversation_id nullable
- moment_id nullable
- payload
- visibility_policy
- occurred_at
- caused_by_event_id nullable
- idempotency_key
```

Required event types include:

- account_created
- friendship_requested
- friendship_accepted
- friendship_declined
- friendship_deleted
- actor_blocked
- actor_introduced
- identity_linked
- group_proposed
- group_invited
- group_invitation_decided
- group_created
- group_left
- message_sent
- message_burst_closed
- moment_posted
- moment_viewed
- moment_reacted
- moment_commented
- native_world_event
- memory_disclosed
- relationship_changed
- proactive_intent_created
- proactive_message_sent
- tool_requested
- tool_completed
- policy_regenerated

### 4.19 MemoryItem

```text
MemoryItem
- id
- owner_actor_id
- relationship_id nullable
- source_event_id
- source_actor_id nullable
- type: private | shared | public | reported | native_world
- objective_fact
- subjective_interpretation
- confidence: observed | reported | inferred | uncertain | deceptive_claim
- visibility_policy
- share_policy
- relevance_tags
- created_at
- last_recalled_at
- superseded_by_id nullable
- deleted_at
```

### 4.20 MemoryGrant

```text
MemoryGrant
- memory_id
- grantee_actor_id
- granted_by_event_id
- permission: know | summarize | quote | disclose
- expires_at nullable
```

The strictest upstream permission follows every derivative disclosure.

### 4.21 ProactiveIntent

```text
ProactiveIntent
- id
- source_actor_id
- target_actor_id
- source_event_id
- reason
- private_context
- desired_effect
- not_before
- expires_at
- priority
- status: pending | claimed | sent | cancelled | expired | failed
- quiet_hours_policy
- dedupe_key
```

### 4.22 ToolExecution

```text
ToolExecution
- id
- requesting_actor_id
- target_human_actor_id
- conversation_id
- tool_name
- arguments
- permission_state
- status
- result
- source_metadata
- requested_at
- completed_at
```

### 4.23 Device

```text
Device
- id
- account_id
- platform
- push_token_encrypted
- app_version
- last_seen_at
- notification_permission
```

## 5. Visibility and authorization

Authorization must be computed before prompt construction.

### Direct conversation

Visible to active conversation members only.

### Group conversation

Visible to actors active at the message sequence. An actor invited later does not automatically receive prior history unless group policy explicitly allows history sharing.

### Hidden AI direct conversation

Visible to participating characters and authorized service/audit roles only. Human API responses must not include message content or opaque identifiers that enable enumeration.

### Moment

Visible according to audience policy and relationship/block state at delivery time.

### Memory

A prompt can include a memory only when:

1. the requesting character owns or has a valid grant
2. the target conversation's audience is compatible with the share policy
3. the source data has not been deleted
4. no block or privacy change invalidates access

## 6. Event-sourced behavior and projections

The demo does not require pure event sourcing for every table, but all behavior-changing social actions must emit immutable events.

Maintain projections for:

- chat list
- relationship state
- group membership
- unread counts
- Moments feed
- actor recent life
- narrative relationship document
- memory index
- proactive queue

Rebuild critical projections in tests from events to detect drift.

## 7. Companion runtime pipeline

### 7.1 Ingest

1. authenticate actor
2. validate membership and block state
3. persist message with idempotency key
4. emit `message_sent`
5. update realtime projections
6. open or extend message burst

### 7.2 Burst close

1. close on adaptive inactivity, explicit mention, or guard
2. emit `message_burst_closed`
3. build eligible actor set
4. exclude sender, inactive members, declined invitees, and blocked actors
5. queue independent attention decisions

### 7.3 Independent attention decision

Input is limited to information the actor may know:

- persona template
- actor public/native state
- relationship narrative
- recent permitted memories
- current burst
- recent group activity
- current availability
- explicit mentions
- loop metadata

Output schema:

```json
{
  "action": "wait|ignore|reply_publicly|reply_privately|react|friend_request|group_proposal|leave_group|no_action",
  "target_actor_id": null,
  "decision_summary": "concise non-sensitive reason",
  "urgency": "low|normal|high",
  "reply_plan": null,
  "follow_up_after": null
}
```

Implementation may batch these independent decisions in one provider request if inputs and outputs remain isolated per actor.

### 7.4 Response generation

For a response action:

1. compile authorized prompt
2. include actor-specific interpretation, not global memory
3. stream or generate response
4. parse structured action envelope
5. validate claims, permissions, recipients, and tools
6. persist visible message
7. persist approved memory/relationship/world-event patches
8. emit new events
9. reconsider eligible actors

### 7.5 Action envelope

A model response may propose:

```json
{
  "messages": [{"target": "current_conversation", "text": "..."}],
  "memory_patches": [],
  "relationship_patch": null,
  "world_events": [],
  "proactive_intents": [],
  "tool_requests": [],
  "social_actions": []
}
```

Never allow the model to supply authoritative actor IDs outside the permitted candidate set without validation.

### 7.6 Natural termination

An interaction becomes dormant when no actor chooses a new action.

Invisible circuit breakers:

- maximum wall-clock runtime for one cascade
- maximum provider requests for one cascade
- per-actor re-entry cooldown
- repeated semantic-content threshold
- repeated actor-pair alternation threshold
- failure-rate threshold

Circuit breakers are operational protection, not user-facing conversation limits.

## 8. Memory extraction and relationship update

After an event is stable:

1. derive objective facts deterministically where possible
2. generate actor-specific interpretation only for actors who observed or learned it
3. attach provenance and permissions
4. deduplicate against active memories
5. supersede contradictions instead of overwriting history
6. update relationship narrative only for meaningful change
7. persist model/template version and source event IDs

Do not generate one universal summary and inject it into every character.

## 9. Native-world simulation

A durable worker selects actors due for simulation.

Inputs:

- template and canon anchor
- current native-world state
- recent canonical life events
- schedule
- unresolved social events
- last simulation time
- pending proactive intents

Possible outputs:

- no event
- private life event
- public Moment candidate
- AI-to-AI contact intent
- proactive contact intent
- availability change

Validate against anti-drift and contradiction rules. Once disclosed publicly, the event becomes canonical recent history.

## 10. Proactive scheduler

1. claim due intent atomically
2. re-check relationship, block, quiet hours, notification settings, and expiration
3. load latest permitted context
4. generate final in-character message
5. persist message before push
6. emit realtime event
7. send APNs/Web notification
8. mark intent sent or failed
9. avoid duplicate send with dedupe key

Push failure does not roll back the message; the message remains unread in the chat list.

## 11. Capability gateway

### Weather

- normalized provider interface
- city or permissioned approximate location
- timestamp and source metadata
- cached briefly
- no fabricated results

### Calendar

Common intent schema:

```json
{
  "operation": "read|create|update|delete",
  "title": "...",
  "start": "...",
  "end": "...",
  "notes": "...",
  "requires_confirmation": true
}
```

- Web provider may use connected Google Calendar or demo calendar.
- iOS provider uses EventKit where authorized.
- writes require user confirmation
- client returns signed/authorized result to server
- AI cannot mark success before result arrives

### Lightweight web search

- one bounded retrieval by default
- result contains title, URL, snippet, retrieved time
- synthesize only supported current facts
- no recursive deep-research loop

## 12. API surface

Illustrative versioned routes:

```text
POST   /v1/auth/apple
POST   /v1/auth/magic-link
POST   /v1/auth/refresh
GET    /v1/sync?cursor=
GET    /v1/actors
GET    /v1/relationships
POST   /v1/friend-requests
POST   /v1/friend-requests/{id}/decision
GET    /v1/conversations
POST   /v1/conversations
POST   /v1/conversations/{id}/invitations
POST   /v1/invitations/{id}/decision
GET    /v1/conversations/{id}/messages
POST   /v1/conversations/{id}/messages
GET    /v1/moments
POST   /v1/moments
POST   /v1/moments/{id}/interactions
GET    /v1/settings
PATCH  /v1/settings
POST   /v1/devices
POST   /v1/calendar/actions/{id}/result
POST   /v1/export
DELETE /v1/account
```

Realtime event names:

```text
message.created
message.updated
conversation.updated
typing.updated
friend_request.updated
group_invitation.updated
relationship.updated
moment.created
moment.interaction.created
actor.presence.updated
sync.invalidate
```

AI streams use a dedicated stream endpoint or WebSocket channel linked to the persisted message placeholder.

## 13. Delta sync

Server maintains a monotonically ordered account-visible change stream.

Client sync algorithm:

1. send last durable cursor
2. receive ordered upserts/tombstones
3. apply transactionally to local cache
4. advance cursor only after commit
5. reconnect realtime
6. deduplicate events by server event ID
7. re-run sync after reconnect gaps

Offline outbound mutations use client idempotency keys and explicit states:

- queued
- sending
- accepted
- failed
- conflicted

## 14. Authentication and session

Demo:

- Sign in with Apple
- email magic link on Web
- short-lived access token
- rotating refresh token
- device registration
- server-side revocation

iOS tokens go in Keychain. Browser session uses secure, HTTP-only cookies where possible. Never persist hosted model secrets in either client.

## 15. Storage

Use:

- PostgreSQL for accounts, social graph, messages, events, memory, and scheduler state
- object storage for images and export archives
- durable queue backed by PostgreSQL or equivalent for demo simplicity
- encrypted secrets manager for providers and APNs keys

Partition large message/event tables by time or graph only when load requires it; preserve simple transactional correctness first.

## 16. Moderation, reports, and audit

Because human users can communicate:

- block
- report message/post/account
- basic abuse filtering
- rate limits
- contact/support channel
- audit event for privileged access

Do not expose AI-to-AI hidden message content to humans, but retain scoped audit access for operational review.

Do not store model chain-of-thought. Store:

- input event IDs
- selected memory IDs
- action schema
- decision summary
- model and template version
- token/latency/error metadata
- policy decision

## 17. Migration from current clients

### Web

Current IndexedDB/localStorage data becomes a local import source. Do not make it authoritative after cloud migration.

### iOS

Current UserDefaults arrays become a one-time import source. Messages and Moments move to SwiftData cache plus cloud.

Migration rules:

- preserve original timestamps and local IDs as legacy metadata
- assign stable server IDs
- map old persona IDs to template IDs
- convert visible affinity score only into a temporary narrative hint, then stop using the score
- preserve private chat scope
- do not upload API keys
- allow user to review and cancel import
- make migration idempotent

## 18. Contract versioning

Shared JSON schemas and event definitions must have semantic versions.

A breaking contract change requires:

- server migration
- Web compatibility
- iOS compatibility
- export/import compatibility
- update to both repository skills
- contract tests against at least current and previous supported client versions
