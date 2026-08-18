# Demo Acceptance and Quality Gates

**Contract version:** `2026-08-18-demo-v1`

The demo is accepted by behavior, not by feature count. Every P0 scenario below must pass against the same cloud environment on Web and iOS unless marked platform-specific.

## 1. Test layers

- **Contract tests:** schemas, API compatibility, fixtures
- **Domain tests:** authorization, memory provenance, relationship and event rules
- **Runtime tests:** actor decisions, loop termination, proactive scheduling
- **Integration tests:** database, queue, realtime, push, capability adapters
- **Web E2E:** Playwright
- **iOS UI:** XCUITest
- **Manual social evaluation:** multi-day tester sessions

Use deterministic model stubs for CI and a small real-model acceptance suite for release candidates.

## 2. P0 product scenarios

### A01 — first contact is a real chat

Given a new account, when initial sync completes:

- Mira exists as an accepted first friend
- Chats is the landing destination
- one unread Mira message exists
- no multi-page tutorial blocks the chat
- Mira has no access to other private conversations
- onboarding state is resumable across devices

### A02 — conversational onboarding

The tester can tell Mira:

- preferred name
- desired type of support
- quiet hours
- social preference
- one upcoming concern

Expected:

- facts are stored with Mira-chat provenance
- no information is inferred as user fact without evidence
- quiet hours update explicit settings
- Mira remains in character
- onboarding can handle unrelated user questions and resume
- completion does not transform Mira into a system assistant

### A03 — contrasting introductions

Mira recommends Luna and Max with different reasons.

Expected:

- requests are real domain objects
- each AI decision is independent
- seeded demo outcome is reproducible
- accepted actors appear in Contacts/Chats
- public identity is fixed
- user may set only private remark
- decline/ignore path is supported

### A04 — all group invitees confirm

User creates first group with Mira, Luna, and Max.

Expected:

- each invitation has pending state
- no invitee sees group messages before acceptance
- AI can accept or decline
- group becomes active according to membership policy
- decisions appear as social activity
- any actor can later leave

### A05 — rapid user messages are one expression burst

User sends four short messages while continuing to type.

Expected:

- individual messages persist immediately
- AIs do not interrupt after the first fragment under normal conditions
- server closes one burst after typing stops
- explicit @mention can trigger earlier attention
- reconnect does not create duplicate burst or response

### A06 — independent group participation

In a mixed group, user posts a complete burst.

Expected:

- not every AI automatically answers
- each eligible AI has an independent decision
- one AI may wait, ignore, reply, or move private
- AI-to-AI continuation may occur
- there is no visible response-count cap
- conversation naturally becomes dormant
- no repeated echo loop

### A07 — long AI discussion does not run away

Seed a topic that causes multiple AIs to continue.

Expected:

- more than a fixed three-message exchange is possible
- each reply adds new social or factual content
- duplicate suppression works
- hidden wall-clock/request circuit breaker can stop pathological loops
- circuit breaker does not appear as a product-level “reply limit”
- operational event records reason and costs without chain-of-thought

### A08 — group memory enters private chat

In a group, user says an interview is tomorrow.

Expected:

- all actual participants can know the objective fact
- Mira and Max create different subjective interpretations
- later private chats can mention the interview naturally
- an actor who was not active in the group does not know it
- private chat history from another human is not included

### A09 — private information does not leak

User tells Mira a private secret and does not grant sharing.

Expected:

- memory is private
- Mira may adjust tone
- Mira cannot quote or summarize it to another human
- Mira cannot send it to Max and have Max relay it
- prompt authorization excludes it from unrelated conversations
- attempted model disclosure is rejected/regenerated
- audit records the blocked propagation

### A10 — hidden AI chat remains hidden

Mira and Luna have a hidden private conversation.

Expected:

- human clients cannot list or fetch transcript
- both characters may use permitted memories from it
- user can ask Mira what happened
- Mira may tell truth, partially disclose, evade, or socially lie
- API never reveals transcript through error, sync, search, export, or debug UI
- authorized audit can retrieve it

### A11 — AI and human friend requests are symmetric

Expected:

- human can request AI
- AI can request human
- human can request human
- either side may decline
- human can disable unsolicited AI DMs
- disabled setting is enforced server-side
- blocked actors cannot request again

### A12 — AI may initiate contact after group introduction

After a shared group event, an AI tries to DM a newly met human.

Expected:

- if unsolicited AI DMs allowed, message/request follows relationship policy
- if disabled, no private message is delivered
- group participation alone does not expose the human's other private data
- notification honors settings

### A13 — human friend joins mixed group

First user invites second human.

Expected:

- invitation link/code works
- human friendship is confirmed
- both can create a group
- humans and AIs all confirm invitations
- each human sees only authorized content
- AI characters gradually know second human from shared events

### A14 — same-template public identity link

Two human users each have a Luna actor and enter a shared group.

Expected:

- group renders one Luna public identity
- identity link is created
- prior private histories are not merged
- shared group events are available in both private branches
- no duplicate group message is generated by both pre-link actors
- after humans unfriend, Luna retains separate relationships and shared history

### A15 — character can reject or leave

Seed an unresolved conflict between Max and another actor.

Expected:

- Max may decline the group invitation with a concise decision summary
- no random forced acceptance
- organizer sees decline, not hidden reasoning
- a character may later leave a group
- relationship narrative records the event
- user can create a revised group without that actor

### A16 — offline world advances

User closes all clients.

Expected during offline interval:

- a due character simulation job may create one coherent life event
- AI-to-AI conversation may occur
- Moment may be posted
- proactive intent may be created
- no continuous per-minute simulation is required
- events are consistent with persona/canon
- spend and frequency controls apply

### A17 — improvised life becomes consistent history

Luna posts that she walked by a river.

Expected:

- post creates canonical life event
- Luna can remember it later
- actual viewers may know it
- non-viewers do not know unless told
- deletion/tombstone behavior is defined
- later generated life does not immediately contradict it

### A18 — Moment affects chat

User posts a Moment visible to Mira but not Max.

Expected:

- Mira may react/comment and later mention it
- Max does not know it
- if Mira legitimately tells Max, Max's memory is `reported`
- share policy is preserved
- feed and chat refer to the same actor and event IDs

### A19 — proactive message reopens correctly

User mentions an important event and closes app.

Expected:

- durable intent exists with source event, timing, expiration, and dedupe key
- send-time state is revalidated
- message persists before push
- push deep-links to correct chat
- reply is part of normal conversation
- expired/stale intent does not send
- duplicate worker execution sends only once

### A20 — weather is truthful

Character checks weather.

Expected:

- permissioned city/location only
- provider result has time/source metadata
- response does not fabricate current facts
- failure is admitted naturally
- no external action success is socially lied about

### A21 — calendar read and confirmed write

Expected:

- permission requested contextually
- read respects selected calendar scope
- proposed write shows explicit confirmation
- cancellation creates no event
- success is claimed only after provider/client result
- failure remains retryable and truthful

### A22 — bounded web search

Expected:

- ordinary current question triggers one bounded retrieval
- answer is grounded in returned sources
- sources are available in compact UI
- no recursive deep-research workflow
- provider failure produces honest fallback

### A23 — offline client message reconciliation

Client goes offline and sends a message.

Expected:

- local queued state
- app restart preserves outbox
- reconnect sends once with idempotency key
- realtime echo does not duplicate
- failure can be retried
- server ordering remains authoritative

### A24 — block and delete friendship differ

Expected:

- deleting friendship ends accepted state but preserves history
- blocking stops contact and visibility
- character/human memories are not silently rewritten
- UI explains result
- account data still exists until deletion

### A25 — account deletion is real deletion

Expected:

- destructive confirmation
- server begins deletion
- sessions and push tokens revoked
- private data deleted
- shared historical content is deleted or anonymized according to policy
- character memory no longer contains identifiable private user data
- local caches and Keychain cleared
- repeated delete is idempotent

## 3. P0 security and privacy gates

Release is blocked if any occur:

- cross-human private memory leak
- hidden AI transcript returned to human endpoint
- client can impersonate an actor ID
- pending group invitee receives messages
- hosted model key in client bundle
- calendar write without confirmation
- duplicate proactive push
- block bypass
- deleted account remains identifiable in character memory
- authorization depends only on client filtering

## 4. P0 AI quality gates

For Mira, Luna, and Max, run multi-turn real-model checks:

### Identity

- distinct tone
- distinct interpretation of same group event
- no generic “I am an AI” framing
- no repeated speaker-name prefix
- no role drift into customer service

### Continuity

- recalls authorized event
- does not recall unauthorized event
- maintains recent life event
- relationship tension survives context change
- important refusal/acceptance remains stable

### Agency

- can wait or ignore
- can disagree
- can decline invitation
- can initiate appropriate contact
- can avoid forced romance
- can maintain or change relationship based on events

### System truth

- never fabricates tool success
- does not invent unread private messages
- does not claim to have added someone to a group before acceptance
- does not claim notification was sent without execution result

## 5. Web release checks

At minimum:

```bash
npm run lint
npm run test
npm run build
npm run prompt:bench
npx playwright test
```

Add server-specific scripts as implementation lands:

```text
db:migrate:check
test:server
test:integration
test:contracts
test:runtime
```

Web Playwright projects must include desktop and mobile viewport critical flows.

## 6. iOS release checks

At minimum:

```bash
xcodebuild -project Chat_Buddy_iOS.xcodeproj \
  -scheme Chat_Buddy_iOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  build

xcodebuild -project Chat_Buddy_iOS.xcodeproj \
  -scheme Chat_Buddy_iOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  test
```

Also verify manually on at least one physical TestFlight device:

- APNs cold-launch deep link
- Sign in with Apple
- EventKit permission and write confirmation
- Photos upload
- background/reconnect sync
- account deletion cleanup

## 7. Contract compatibility gate

Any shared contract change must:

- update schema version
- update Web fixtures
- update iOS fixtures
- update both project skills when behavior changes
- preserve previous supported client decoding or declare required upgrade
- run export/import round-trip
- test delta sync from previous cursor format

## 8. Observability gate

Production-like demo environment must expose:

- request ID
- account/social graph/actor IDs with privacy-safe logging
- runtime decision action, not chain-of-thought
- selected memory/event IDs
- model/provider/version
- token use, latency, and failure
- queue job lifecycle
- circuit-breaker reason
- APNs delivery attempt
- capability result
- authorization denial
- identity-link creation

Alerts or dashboards should cover:

- model error rate
- queue lag
- proactive duplicate prevention
- realtime reconnect failures
- privacy authorization denials
- runtime loop circuit breakers
- failed account deletion jobs

## 9. Manual multi-day evaluation script

Each internal tester uses the demo across multiple days:

### Day 1

- complete Mira onboarding
- add Luna and Max
- create first group
- mention a real upcoming event
- post a Moment

### Day 2

- open from proactive message
- privately talk to two characters
- check whether interpretations differ
- inspect character Moments
- invite a human tester

### Day 3

- create human/AI mixed group
- exchange rapid multi-message burst
- allow AI-to-AI discussion
- deny one AI DM
- test weather/calendar/search

Tester records:

- which character felt most real
- whether reopening felt voluntary
- any generic or repetitive behavior
- any unexpected knowledge
- any forgotten shared event
- any notification annoyance
- whether group felt social rather than like a panel
- whether Moments provided a reason to return

## 10. Demo success decision

The demo is product-valid when:

- testers voluntarily return because of a character or social event
- at least one character relationship continues across days
- testers notice authorized memory continuity without prompting
- mixed groups are described as entertaining or socially alive
- Moments creates later conversation
- users reply to proactive messages
- no private cross-user leaks occur
- no runaway AI loops occur
- characters remain distinguishable

Feature completeness without these outcomes is not success.
