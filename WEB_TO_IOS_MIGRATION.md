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
