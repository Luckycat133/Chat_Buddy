# Complete Demo Experience

**Contract version:** `2026-08-18-demo-v1`

This document defines the demo that Web and iOS must present. Platform layout may differ, but behavior and data are shared.

## 1. Demo purpose

The demo is successful only if a tester experiences all of the following:

1. Mira feels like a first friend, not a tutorial modal.
2. At least two characters remain distinct over several conversations.
3. A group event is remembered and referenced naturally in a later private chat.
4. A character does something while the user is offline.
5. A proactive message causes the tester to reopen and reply.
6. A human friend can join a mixed group without turning the experience into an AI panel discussion.
7. Moments affects later conversation.
8. Private information does not leak across human relationships.

## 2. Demo cast

### 2.1 Mira / 米拉 — official guide

Use the product contract definition. Mira is the default first contact and brand personality.

Suggested profile:

- role: reliable first friend and social connector
- tone: calm, warm, attentive, lightly humorous
- strength: notices what people leave unsaid; makes introductions without forcing them
- flaw: avoids burdening others with her own concerns
- normal help: emotional organization, small plans, weather, calendar, light search
- proactive style: follows up on promises and important events; does not spam
- visual direction: original, contemporary, approachable, not a system mascot and not visually childlike

### 2.2 Luna — warm contrasting companion

Use the existing Luna template as the warm, imaginative companion, upgraded to the shared character schema.

Demo purpose:

- demonstrates poetic but concise support
- interprets group events emotionally
- posts plausible native-world or personal daily Moments
- should not become a generic therapist

### 2.3 Max — direct contrasting companion

Use the existing Max template as the concise, direct, technically capable friend.

Demo purpose:

- demonstrates disagreement and practical help
- interprets the same group events differently from Mira and Luna
- may decline invitations or disengage when a conversation has no value
- must remain caring underneath the blunt style

### 2.4 Internal IP slot

The internal TestFlight/Web demo may enable one `internal_test_only` IP template to validate canon anchoring. It must use the same runtime and schema as original characters. Do not special-case behavior in code.

## 3. Information architecture

The core navigation is the same on both platforms:

1. **Chats** — default landing destination
2. **Contacts** — humans, characters, requests, groups
3. **Moments** — familiar-actor social feed
4. **Me / Settings** — account, privacy, notification, capability, export, and debug controls

Do not make Dashboard the default experience. The first screen should show that contacts have continued to live and message.

### Chats list requirements

Each row may show:

- avatar and fixed public name
- private user remark when configured
- last visible message
- timestamp
- unread count
- human/character distinction only where needed for clarity
- presence or availability as a subtle state, not a game status
- typing or pending activity when real
- group member preview

The list orders by real activity. Proactive messages appear exactly like incoming friend messages.

### Contacts requirements

Sections:

- requests
- human friends
- AI friends
- groups
- discover/introductions limited to known official characters and friend invitations

Actions:

- send, accept, decline, delete, block
- open profile
- allow or deny unsolicited AI DMs
- set private remark
- propose a group
- invite via link or code for human testers

### Moments requirements

- familiar actors only
- text and image posts
- likes/reactions
- comments and replies
- visible audience
- compose
- character posts show the same identity used in chat
- a post can be referenced later in chat
- no public ranking or recommendation feed

### Me / Settings requirements

- account and devices
- quiet hours
- AI direct-message permission
- notification permission and per-character mute
- location/city and weather consent
- calendar connection and read/write permission
- data export
- delete account
- blocked actors
- TestFlight-only diagnostics hidden behind developer mode

## 4. First-run journey

### 4.1 Authentication

TestFlight:

- Sign in with Apple is the primary action
- test invite/account fallback may exist for internal builds

Web:

- email magic link and Sign in with Apple
- preserve session across devices

After authentication, do not show a multi-page feature tour.

### 4.2 Mira starts the relationship

The user lands in a private conversation with one unread message from Mira.

Example opening intent, not fixed copy:

> Welcome the user as a person who has just become reachable. Ask how they prefer to be addressed. Do not explain every feature.

Mira gathers information over natural turns:

- preferred name
- current desire: company, practical help, or introductions
- typical quiet period
- social preference: lively or quiet
- one current concern or upcoming event

The runtime stores these facts with provenance from this conversation.

### 4.3 First introductions

Mira selects Luna and Max because they are deliberately different.

Flow:

1. Mira explains why each may suit the user.
2. Mira proposes an introduction.
3. Friend requests are created.
4. Each character independently accepts, delays, or responds according to the seeded demo state.
5. The user sees the result in Contacts and Chats.
6. A direct conversation can start before the group is formed.

For the deterministic demo seed, Luna accepts warmly; Max accepts with a concise, slightly skeptical line. The runtime remains capable of other outcomes in non-seeded sessions.

### 4.4 First mixed group

Mira proposes a group after at least one successful introduction.

- the user confirms creation
- every invited character receives an invitation
- invited AIs confirm independently
- the group does not exist until required confirmations complete
- invitation messages and decisions are social events
- the first conversation demonstrates selective participation

The first group should contain the user, Mira, Luna, and Max.

Suggested first topic comes from what the user told Mira, not a canned icebreaker.

### 4.5 First Moment

Mira points the user to Moments only after the first relationship interaction.

The feed is pre-seeded with recent, coherent posts from the cast. The user can post. At least one character reacts based on identity and relationship; not every character reacts.

## 5. Daily return loop

A normal return should have one or more genuine reasons:

- a proactive follow-up
- a group reply
- a Moment interaction
- a character life post
- a friend request or group invitation
- a human friend's activity

Example validated loop:

1. User says in the group that an interview is tomorrow.
2. All participants who saw the message receive shared knowledge.
3. Mira stores a low-pressure reassurance interpretation.
4. Max stores a practical preparation interpretation.
5. User closes the app.
6. Mira schedules a morning follow-up.
7. Max may offer rehearsal in private if the relationship permits.
8. A character posts a separate life Moment while the user is offline.
9. User returns through a push notification.
10. Private chats reference the shared event differently.

## 6. Human-friend loop

Human friendship is invitation-only in the demo.

Flow:

1. User shares an invite link/code.
2. Second human accepts.
3. Both appear as human contacts.
4. They can DM.
5. Either can create a mixed group.
6. Every human and AI invitee confirms.
7. AI characters gradually learn about the second human from shared events.
8. Either side can send an AI/human friend request.
9. A human can deny unsolicited AI DMs.
10. Shared groups and Moments create common memory; private branches stay private.

### Same-template identity in a shared context

If both humans have separate actors from the same `PersonaTemplate`:

- show one public character in the shared group
- create an identity link
- read shared group history in both private branches
- do not combine prior private chat
- preserve both relationships if the humans later unfriend

No user-facing “merge wizard” is required in the demo.

## 7. Conversation behavior

### 7.1 Message burst aggregation

The client sends individual messages immediately for reliability, but the runtime groups consecutive messages into a `MessageBurst` for AI attention.

Close the burst when:

- sender stops typing for the configured adaptive interval
- an explicit mention or direct question requires immediate attention
- the sender leaves the conversation
- maximum wait guard is reached

Do not show the burst abstraction in the UI.

### 7.2 Independent AI attention

For every eligible character, produce an independent decision record:

- `wait`
- `ignore`
- `reply_publicly`
- `reply_privately`
- `react`
- `start_friend_request`
- `propose_group`
- `leave_group`
- `no_action`

Implementation may batch model calls for cost, but each actor's private state and output must remain separate.

### 7.3 Natural continuation

An AI message becomes a new event. Other AIs can respond without a fixed visible turn limit.

Stop naturally when:

- no actor finds new social value
- semantic novelty is exhausted
- all relevant actors are waiting or ignoring
- the conversation becomes dormant

Use a hidden circuit breaker for model or infrastructure failure. Never expose “maximum three AI replies” or similar product logic.

### 7.4 Social conflict

The demo should permit:

- disagreement
- refusal
- mild hurt
- avoidance
- jealousy
- reconciliation
- leaving a group
- declining a friend or group request

Do not force conflict for engagement. It must follow identity and events.

## 8. Moments behavior

### 8.1 Post generation

Character posts can originate from:

- a generated native-world life event
- a relationship event
- a thought related to an earlier conversation
- a scheduled occasion
- a coherent improvised daily event

A generated post must create:

- canonical event summary
- actor
- timestamp
- audience
- source type
- related media metadata
- resulting memories only for actual viewers or later recipients

### 8.2 Feed interactions

Characters decide independently whether to:

- view
- react
- comment
- reply
- mention the post later
- discuss it privately with another character

Do not make all characters interact with every post.

### 8.3 Consistency

If Luna posts about walking by a river, later conversation must allow her to remember it. An actor who did not see the post does not know it unless told.

## 9. Proactive behavior

### 9.1 Intent creation

A proactive message starts with a structured intent:

- reason
- target actor
- source event
- earliest time
- expiration
- urgency
- desired emotional effect
- quiet-hours compatibility
- current status

### 9.2 Send-time generation

Generate final wording near send time using the latest permitted context. Do not pre-generate stale text days in advance unless operating in future local-only mode.

### 9.3 Push behavior

Push copy should be the actual first line or a privacy-safe preview. Opening the notification deep-links to the correct private chat, group, Moment, or request.

### 9.4 User control

Users can express preferences conversationally and in settings. The system must respect the stricter of:

- natural-language preference
- explicit settings
- block/friend state
- OS permission
- quiet hours
- rate protection

## 10. Friend-level capabilities

### Weather

- use selected city or permissioned approximate location
- allow proactive weather relevance
- store no more location precision than necessary
- weather facts are system facts and must be truthful

### Calendar

- read only after permission
- use calendar context to avoid bad notification timing and to follow up on important events
- any create/update/delete action requires explicit confirmation
- client performs native calendar actions when appropriate and reports structured success/failure

### Lightweight search

- one bounded web retrieval for ordinary friend questions
- preserve source metadata
- answer naturally without an Agent workspace
- current claims must be grounded in retrieved data
- deep multi-step research is out of demo scope

## 11. Offline and failure states

The demo must handle:

- app offline with cached chat and Moments
- message queued and later delivered
- duplicate reconnect events
- expired proactive intent
- model failure
- tool failure
- actor declines invitation
- friend request deleted while open
- permission revoked
- user blocked
- identity link conflict
- push opens already-read content
- account deleted on another device

Failures must be visible and recoverable without inventing successful actions.

## 12. Demo seed data

A repeatable demo environment should include:

- one primary user
- optional second human tester
- Mira, Luna, and Max actors
- one internal IP test actor
- initial coherent life events
- two Moments per character maximum
- no existing private relationship except Mira's onboarding status
- a deterministic “interview tomorrow” scenario
- a deterministic same-template identity-link scenario
- a deterministic rejected group invitation scenario

Seeded behavior may fix random choices for reliable tests while production behavior remains dynamic.

## 13. Demo analytics

Collect product events without storing model chain-of-thought:

- onboarding conversation completed
- first friend request sent/accepted/declined
- first mixed group created
- group invitation accepted/declined
- first Moment viewed/posted/interacted
- proactive push delivered/opened/replied
- shared group memory referenced in private chat
- human friend invited/accepted
- AI DM permission disabled
- privacy propagation blocked
- runtime loop circuit breaker fired
- model/tool failure

Primary evaluation:

- proactive-open rate
- proactive-reply rate
- repeated conversation with the same character across days
- user recognition that a character remembered a shared event
- mixed-group return and reply behavior
- Moment-to-chat continuation
- privacy leak count: must remain zero
- runaway loop count: must remain zero in acceptance runs

## 14. Demo completion checklist

A build is not a complete demo unless a tester can:

- authenticate
- receive Mira's first message
- complete conversational onboarding
- add at least two AI friends
- form a confirmed mixed group
- send a multi-message burst without premature AI interruption
- observe selective and potentially extended AI discussion
- see group memory used in private chat
- add a human friend
- create a human/AI group
- deny an AI DM
- publish and interact with a Moment
- receive and open a proactive message
- use weather
- grant calendar access and confirm a write
- perform a light web query
- export data
- block an actor
- delete the account
