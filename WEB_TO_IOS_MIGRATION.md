# Chat Buddy Web → iOS Migration

**Status:** Draft migration contract
**Web source:** `Chat_Buddy` (`remake` branch)
**Destination:** [Chat_Buddy_iOS](https://github.com/Luckycat133/Chat_Buddy_iOS)

The web application is in maintenance mode. Its remaining product work is to keep
user data exportable while the native iOS application becomes the primary version.

## Current export

In the web app, open **Settings → Data → Export**. The exported JSON currently uses:

```json
{
  "_meta": {
    "app": "Chat Buddy",
    "version": 2,
    "exportedAt": "ISO-8601 timestamp",
    "includesIndexedDB": true
  },
  "localStorage": {},
  "indexedDB": {}
}
```

The export intentionally excludes the session API key. Keep the JSON private: it
can contain conversations, personas, memories, images, and personal preferences.

## Canonical cross-platform model

The iOS importer should translate the web backup into versioned records rather than
depending on browser storage keys directly.

| Canonical record | Web source | iOS destination |
|---|---|---|
| `Persona` | built-in/custom agent and friend data | versioned persona resource |
| `Conversation` | chat metadata | conversation store |
| `Message` | chat/message records | message store |
| `Moment` | moments/social records | moments store |
| `ToolDefinition` | enabled agent/tool configuration | validated tool configuration |
| `UserPreferences` | `chat-buddy:*` settings | app preferences |
| `Memory` | `chat-buddy-memories` | memory store |
| `MediaReference` | `chat-buddy-images` | imported app media |

Every future export change must increment `_meta.version`. Importers must reject
unknown major versions without modifying existing user data.

## Feature handoff

| Capability | Web | Required before web archive |
|---|---:|---:|
| Persona configuration | Available | Import or recreate on iOS |
| One-to-one chat | Available | Required |
| Group chat | Available | Required |
| Moments | Available | Optional for first archive gate |
| Proactive messages | Available | May be deferred |
| Tool calling | Available | Must use validated, confirmed actions |
| JSON export | Available (v2) | Keep supported |
| JSON import | Available (v1/v2) | iOS importer required |
| Internationalization | English/Chinese | Define iOS scope |
| API-key storage | Session storage | Keychain required on iOS |

## Archive gate

Archive this repository only after all of the following are true:

- [ ] iOS supports basic one-to-one chat
- [ ] iOS supports group chat
- [ ] iOS supports persona configuration
- [ ] a representative web v2 backup imports successfully on iOS
- [ ] malformed/unsupported backups fail without partial writes
- [ ] README points users to a tested iOS release
- [ ] a final web tag is published

Suggested final tag: `v0.3.3-web-final`.

## Maintenance rules

- Accept critical security, data-loss, export/import, and compatibility fixes.
- Do not add new product features to the web version.
- Never inject provider API keys into a public browser build.
- Keep export fixtures free of real conversations, credentials, and copyrighted
  character assets.

## Web v2 private archive transfer (0.5.4)

The new cloud settings transfer pairs a Web v2 browser export with a live,
membership-filtered account snapshot. Both Web and iOS can import, preview
and re-export this archive without changing its bytes. Live user-visible
conversations and messages are read under a repeatable-read snapshot with
stable keyset pagination; the account and human actor IDs are kept separate.
Deleted content and hidden AI conversations are excluded. Imported cloud
author IDs must be actual members of their archived conversations.

A single account-owned archive is stored transactionally (4 MiB document cap).
An unchanged document is an idempotent no-op; an explicitly imported
replacement only replaces the saved archive. Attachments preserve validated
inline bytes and metadata; sources that are only references are shown as
placeholders, never fetched automatically. Existing Web v1/v2 browser
restore and old account export are independent operations. This does not
merge messages, identity, or membership into the active cloud timeline.
Legacy Web v2 files with only browser data can be saved as an unbound
document into the current account's private archive.

The old red CI for default `remake` head `cfb8441`
([45945673784](https://github.com/Luckycat133/Chat_Buddy/actions/runs/45945673784))
is historical: its ESLint failures were superseded by `e64ded61` and
[green `remake` CI](https://github.com/Luckycat133/Chat_Buddy/actions/runs/45965320415).
The maintained Web branch is `remake`; no remote `main` exists at the reviewed baseline.
The separate `legacy-old-version` branch is the older application, not an alternate
sync implementation. Preserve it as historical reference; do not merge it into
`remake` or delete it as part of a protocol refactor.

Browser IndexedDB uses distinct databases: local legacy restore preflights
every present store before clear, and each individual store write rolls
back atomically. A late runtime error can interrupt a multi-store local
restore; keep the original backup. Only the server-owned archive replacement
is covered by a single transaction.

Account uploads also have JSON structure/depth budgets, one in-flight
upload per account and four per server process, a bounded upload deadline,
and rate limits for large documents. A rejected upload leaves the previous
account archive unchanged.
The deadline applies to receiving the upload, not a commit receipt. Work
holds its admission permit through commit or rollback; transaction SQL and
lock waits are bounded. If the connection drops at commit, the result may be
unknown to the client: compare the saved archive SHA before retrying.

## Explicit private cloud merge (0.5.5)

1. Use the existing signed-in Web v2 import to store a same-account archive, then open that exact archive.
2. `POST /v1/account/backup/merge/preview` with `{}` returns the archive SHA-256, five-minute plan token, insert/skip/conflict counts and up to 50 archive IDs per conflict category. It does not mutate data.
3. Only after confirmation, post `{ "previewToken": "...", "confirm": true }` to `/v1/account/backup/merge/commit`. The transaction replans under the same write locks as live sends. Archive or relevant online changes return 409: reopen/preview again. Response includes affected conversations and their first appended sequence (`affectedConversationStarts`). Fetch the existing messages endpoint using that inclusive cursor; no feed, push, generation or normal send event is emitted.
4. Only an existing active direct chat you created with yourself and optionally same-graph active accountless characters is eligible. No shared chats, other authors, deleted rows, unknown conversations, restored members, browser device payloads or arbitrary structured actions. Existing IDs (including tombstones) are never overwritten. Missing messages use stable account/conversation-scoped IDs and remap their reply references to avoid cross-account ID collisions. Only supported text/image and PNG/JPEG attachment bytes or zero-byte reference placeholders are appended. Attachment IDs/content are compared per target conversation; new attachment IDs are scoped to that target. Original archive IDs and bytes remain untouched. Existing inline data is stored per message; this is logical ID deduplication, not a global blob store.
5. Archive limit 4 MiB, merge up to 100 conversations and 2,000 messages and 8 MiB of expanded data. Unavailable archived conversations are reported as conflicts, not re-created.

6. Successful nonempty commits consume persistent quota: up to 12 commits / 5,000 rows / 16 MiB per 24-hour account window and 50,000 rows / 128 MiB cumulative. Preview, no-ops and rolled-back writes consume nothing; replacing an archive does not reset account quotas.

## Reopen verified deleted private conversations (0.5.6)

The server recognizes retained conversations marked `deleted` only when they still have the original owner, private direct membership and complete original rows. Upload is allowed after deletion for this scope. Clients opt in with `?rebuild=1` on both preview and commit; cached clients without the flag keep exactly the old append-only responses. Opted-in responses include `restoredConversationIds` and `unsupportedConversationIds`, alongside the existing counts and affected-entry cursors. Clients can use the same current conversation list with `GET /v1/conversations?ids=<comma-separated UUIDs>` (at most 100) to reconcile restored IDs older than the default list window. Explicit confirmation reopens the original ID atomically with quota accounting. A successful reopen receipt includes a trusted database-clock `restoredAt` cutoff (not a deletion timestamp); a client may treat strictly older replays for only the receipt's restored IDs as stale, preserving equal and newer tombstones. All visible original messages, including eligible assistant and system replies and attachments, must match exactly; no archive-supplied identity, metadata, or reply target is applied. Individually deleted messages, cross-account/shared conversations, partial histories and physically deleted/unverifiable rows are not restored. No new deletion or retention policy is introduced. No notification or reply generation is emitted by recovery.


The retained-row proof runs before reopening and remains read-only. The same
locked preview/commit transaction still owns eligibility, quota and visibility;
moving proof code does not change v0.5.6 response fields or tombstone cutoffs.
