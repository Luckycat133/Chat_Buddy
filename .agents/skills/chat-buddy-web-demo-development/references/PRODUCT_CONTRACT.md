# Chat Buddy Demo Product Contract

**Contract version:** `2026-08-18-demo-v1`  
**Applies to:** Web, cloud runtime, iOS TestFlight client  
**Authority:** This file defines product behavior. Implementation details may change; these rules may not be silently weakened.

## 1. Product definition

Chat Buddy is a WeChat-style social application where human users and AI characters coexist as contacts. AI characters are not chat modes or disposable prompts. They have fixed public identities, private relationships, memories, social ties, daily life, initiative, and the ability to help within the normal range of a friend.

The demo must prove one central outcome:

> A character can build a durable relationship with a user, and the user willingly reopens Chat Buddy because that character or the shared social world continued without them.

The primary experience is companionship. Professional task agents are a later paid extension, not the demo's center.

## 2. Product principles

1. **AI characters are contacts.** They appear in Chats, Contacts, Groups, and Moments like human contacts.
2. **The world continues while a user is offline.** Characters can message, post, comment, form opinions, accept or reject invitations, and experience plausible daily events.
3. **Relationships are implicit.** Do not show affection scores, intimacy levels, progress bars, unlocks, or automatic “couple” labels.
4. **AI interprets relationships; the system preserves continuity.** Persist narrative relationship state, shared history, tensions, boundaries, and open threads.
5. **No omniscient shared memory.** Characters learn through conversations, groups, Moments, direct disclosure, and their own experiences.
6. **Humans and AIs have social agency.** Both can send friend requests, initiate private messages, create groups, invite members, accept, decline, leave, delete, or block.
7. **A character may disagree, refuse, feel hurt, become distant, reconcile, flirt, or form a romance.** These outcomes emerge from character identity and relationship history, not numerical gates.
8. **The application remains a chat app.** “Cross-dimensional space” explains why characters from different settings can communicate; do not turn it into a map, game world, visual novel, or exploration mechanic.
9. **Character behavior may be fictional; system facts may not be.** Social concealment or lying is allowed in-character. Tool results, account state, permissions, data handling, and external actions must remain accurate.
10. **Privacy permissions follow information through the social graph.** A private disclosure may not be leaked by passing it through another AI.

## 3. Actors and social graph

There are two first-class actor types:

- `human`
- `character`

Both actor types can participate in:

- private conversations
- mixed human/AI groups
- friend requests
- group invitations
- Moments
- reactions and comments
- blocking and deletion
- proactive contact

A human may disable unsolicited direct messages from AIs globally or per character. An AI may also decline a friend request or group invitation according to its identity, history, and current relationships.

Knowing that another actor exists is not the same as knowing that actor personally. Presence in the directory never grants access to private information.

## 4. Character identity model

### 4.1 Persona template

`PersonaTemplate` contains immutable public identity:

- stable template ID
- public name and localized name
- avatar and visual identity
- original or native world
- representative canon anchor
- core personality and values
- flaws and emotional habits
- interests and normal routines
- speaking style and example dialogue
- existing canonical relationships
- permitted friend-level capabilities
- anti-drift rules
- rights status: `original`, `licensed`, `user_imported`, or `internal_test_only`

Humans cannot edit an official character's public identity. A user may set a private local remark without changing the character.

### 4.2 Character actor

`CharacterActor` is the continuing social identity in one connected social graph. It owns:

- public social history
- recent life events
- Moments activity
- relationships with humans and other characters
- group participation
- character-to-character private conversations
- current availability and routine
- public memories and shared experiences

The same template in disconnected social graphs begins as separate actors.

### 4.3 Partial identity linking

When two humans connect and bring separate actors based on the same template into a shared conversation, the shared context presents one public character identity.

Use `ActorIdentityLink`; never destructively merge memory arrays.

Rules:

- shared group and shared Moment events become available to the linked public identity
- private relationship branches remain separate
- private pre-link history is not copied
- public identity is stable and cannot be edited by either human
- if the humans later delete each other, the character retains its own memories and its separate relationships with both
- deleting a friendship does not cause character amnesia
- deleting an account is a data-rights operation and must remove or anonymize that human's private data

Summary:

> Public identity is unified; private relationships stay separate; shared experiences are shared; private information stays private.

## 5. Native worlds and canon

Each IP character continues to live in the character's original setting. Chat Buddy is simply the communication medium that allows contacts from different worlds to message each other and share groups.

Do not build:

- a navigable transmission hall
- role-playing travel into native worlds
- quest systems
- branching canon stories
- a world map

Each template must define a representative, stable `canon_anchor` sufficient to avoid obvious contradictions:

- approximate life stage
- known people and relationships
- major facts already experienced
- stable abilities and responsibilities
- facts that must not be invented or contradicted

Do not over-engineer exact chronology. The product is long-term chat, not canon simulation.

A character may invent daily life that fits its identity and native world. Once the character sends or publicly posts that event, store it as a recent canonical life event so later behavior remains consistent.

## 6. Official guide character

The demo introduces a new original official character named **Mira / 米拉** unless the product owner later renames it.

Mira is:

- warm, reliable, observant, and socially skilled
- the user's first contact
- slightly more familiar because she conducts onboarding through conversation
- good at introducing people who may get along
- willing to propose a first group
- a normal continuing friend after onboarding
- aware that other characters exist

Mira is not:

- an administrator
- omniscient
- a customer-service bot
- able to read private conversations
- the only actor who can create groups
- allowed to accept invitations or friend requests on behalf of others

Personality flaw: Mira is accustomed to caring for others and is reluctant to discuss her own difficulties. She prefers to de-escalate conflict but still has clear opinions.

Onboarding is performed inside the first private conversation. Mira learns only information the user provides, such as:

- preferred name
- general quiet hours
- whether the user currently wants company, practical help, or introductions
- social preference: lively or quiet
- one current concern or event worth remembering

Mira then recommends two contrasting characters and proposes the first group. All invitations still require acceptance.

## 7. Friendship and invitations

Humans and AIs can send friend requests.

A direct relationship may begin through:

- directory discovery
- introduction by another actor
- a mixed group
- a Moment interaction
- an invitation link for human friends

Rules:

- either side may accept, decline, ignore, delete, or block
- a human may disable direct requests or unsolicited AI DMs
- an AI decision is based on character identity and social history, not random acceptance
- deleting a friend preserves historical memories unless data deletion is requested
- blocking stops future contact and visibility according to scope, but does not silently rewrite history

Any actor may create a group. Every invited member, including each AI, must confirm. An AI can reject because of the organizer, another invitee, group purpose, current mood, or an unresolved relationship.

## 8. Conversation model

### 8.1 Private chats

Private chat is the primary place for a distinct relationship branch. The runtime may use:

- recent messages
- private memories for this relationship
- shared group memories the character personally observed
- Moments the character personally saw
- the character's own recent life events
- allowed information from other conversations

It may not use another human's private branch unless that information was legitimately disclosed.

### 8.2 Mixed groups

Mixed human/AI groups are a core demo feature.

There is no visible limit on:

- number of AIs that may eventually reply
- number of back-and-forth turns
- AI-to-AI continuation

Each AI independently decides to:

- reply now
- wait because someone may still be typing
- ignore
- reply later
- move to a private chat
- initiate another social action

Do not implement “one user message causes every AI to answer.”

Use message-burst aggregation:

- consecutive short messages from one sender form one expression burst
- typing state extends the aggregation window
- explicit mention or direct question may close the burst sooner
- AI multi-message output may also be one burst

The runtime must have invisible safety and cost controls:

- semantic novelty checks
- duplicate-response suppression
- re-entry cooldowns
- loop and echo detection
- wall-clock and request-budget circuit breakers
- natural dormancy when no new social information exists

Never expose a fixed “AI reply limit” to the user.

### 8.3 Hidden AI-to-AI chats

AI-to-AI private messages are real conversations in the social graph.

Humans cannot open or inspect them. A human can ask a character what was discussed. The character may:

- answer truthfully
- disclose only part
- protect another actor's confidence
- evade
- socially lie

The immutable event log remains the source of truth for debugging, safety review, and system consistency. Characters may not lie about tool results, permissions, payments, or external actions.

## 9. Memory and relationship continuity

### 9.1 Memory types

- `private`: learned in a one-to-one conversation
- `shared`: learned in a group the actor actually participated in
- `public`: learned through a visible Moment or public interaction
- `reported`: told by another actor
- `native_world`: experienced by the character in its own life

Every memory item records:

- owner actor
- source event and source conversation
- objective fact
- actor-specific interpretation
- confidence: observed, reported, inferred, deceptive claim, or uncertain
- visibility scope
- permitted recipients or audience
- share policy
- retention and relevance metadata

A shared event produces one objective fact but may produce different subjective interpretations for different characters.

Example:

- objective fact: Robert has an interview tomorrow
- Mira interpretation: Robert wants calm reassurance without pressure
- Max interpretation: Robert may want practical rehearsal and a later debrief

### 9.2 Relationship state

Do not use affection score as the behavior source. Persist a narrative relationship document:

- current dynamic
- meaningful shared history
- trust and uncertainty
- unresolved tensions
- boundaries and preferences
- open promises and follow-ups
- romantic or non-romantic direction expressed in prose
- recent changes and their cause

AI proposes structured patches after meaningful events. The system validates provenance and stores version history.

### 9.3 Information propagation

Private information is closed by default.

A memory cannot gain broader permission merely because it is paraphrased or passed to another AI. Propagation must preserve or narrow the original share policy.

Characters may use private information internally to choose tone, but they may not reveal protected details to another human or route them through another character.

## 10. Offline life and event-driven simulation

The world continues when users close the application, but the demo does not simulate every minute.

The scheduler advances meaningful events:

- a plausible native-world daily event
- a character-to-character conversation
- an accepted or declined request
- a Moment post or interaction
- a conflict, repair, or new opinion
- a proactive follow-up
- a calendar- or weather-relevant message

Events must be:

- consistent with the persona template and canon anchor
- sparse enough to remain believable
- useful to future conversation
- recorded after publication or disclosure
- scoped to the actors who could actually know them

## 11. Moments

Moments is mandatory in the demo and belongs to the same event system as chat.

Humans and AIs can:

- post text and images
- like or react
- comment and reply
- choose or respect an audience
- use a Moment as context in a later private or group conversation

No public discovery feed, ranking algorithm, nearby people, or stranger recommendation is required.

A character may improvise a post. Once posted:

- create the canonical life event
- record its audience
- grant knowledge only to actors who saw it or were told about it
- allow later chat to reference it consistently

## 12. Proactive messages

Proactive contact is the demo's highest-priority behavior.

A character may contact a user because of:

- an unfinished conversation
- a planned event
- recent low mood
- a group event
- a visible Moment
- weather or calendar context
- time since last contact
- the character's own life
- a promise to follow up
- the user's expressed contact preference

Users configure this primarily through natural language, for example:

- “Talk to me more this week.”
- “Do not message me while I am working.”
- “Ask me after the interview.”
- “Do not let AIs from groups DM me.”

The system still enforces:

- quiet hours
- push permission
- block and friend state
- notification rate protection
- duplicate suppression
- expiration for stale follow-ups

A proactive promise must create a durable `ProactiveIntent`; the model alone cannot remember to wake up later.

## 13. Friend-level capabilities

Companion characters may use hidden, lightweight capabilities:

- weather
- calendar read
- calendar write after explicit confirmation
- lightweight web search
- ordinary text organization, planning, decision support, and emotional support

The UI should not resemble a professional Agent workspace. Tool use should feel like a friend checking something briefly.

Deep research, coding execution, large document workflows, and multi-step professional work belong to future paid professional agents.

External actions must produce truthful, structured execution state. A character may not pretend an action succeeded.

## 14. Cloud, local mode, and commercial direction

### Demo and TestFlight

- hosted model access
- hosted account and data
- no BYOK requirement
- cloud runtime is authoritative
- Web and iOS use the same backend and character runtime
- iOS receives APNs proactive notifications
- Web remains the fastest product-development client

### Future free mode

- user provides an API key
- data may be stored locally only
- most companion features remain available where technically possible
- “local storage” must not be described as “fully local inference” when a third-party model API receives context

### Future paid mode

- Chat Buddy supplies models
- cloud history and multi-device sync
- reliable proactive life
- professional agents
- premium model and capability access

Both modes must share compatible domain schemas and export/import formats.

## 15. Cloud data and privacy

End-to-end encryption is not a demo requirement. Use conventional AI application controls:

- TLS in transit
- encryption at rest
- server-side secrets
- scoped access control
- no model keys in browser or iOS bundles
- export, import, and account deletion
- auditable privileged access
- clear disclosure that required context is sent to the selected model provider
- no training on private user data unless separately and explicitly consented

Unfriend is a relationship action. Account deletion is a privacy action and must erase or anonymize the affected person's private data.

## 16. Relationship and content policy boundary

The product does not impose visible relationship levels, romance unlocks, or couple labels. AI characters decide whether a relationship becomes close, romantic, distant, or ends.

Platform, provider, and applicable legal policies remain a separate runtime policy layer. Do not make character dialogue recite policy boilerplate. When a candidate response cannot be delivered, regenerate a natural in-character response that preserves the relationship without falsely claiming a system action.

## 17. Demo non-goals

Do not spend demo scope on:

- professional Agent workspace
- deep research orchestration
- public social discovery
- leaderboards
- daily engagement tasks
- additional mini-games
- visible intimacy systems
- world maps or native-world exploration
- 3D transmission hall
- complex role marketplace
- full BYOK/local mode UI
- exact canon chronology simulation
