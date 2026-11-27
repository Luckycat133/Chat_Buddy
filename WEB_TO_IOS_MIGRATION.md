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
There is no separate old branch to remove; retain the default branch.

Browser IndexedDB uses distinct databases: local legacy restore preflights
every present store before clear, and each individual store write rolls
back atomically. A late runtime error can interrupt a multi-store local
restore; keep the original backup. Only the server-owned archive replacement
is covered by a single transaction.
