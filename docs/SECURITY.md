# Security Policy

This document outlines the security model, data handling practices, and security considerations for Chat Buddy.

## Overview

Chat Buddy is a **client-side-only application** with no server-side component. All user data is stored in the browser's localStorage/IndexedDB. This architecture has important security implications.

## Data Storage

### What We Store

| Data Type | Storage | Scope |
|-----------|---------|-------|
| Chat history | localStorage | Per-origin, user-controlled |
| AI memories | IndexedDB | Per-character, isolated namespaces |
| Knowledge base | IndexedDB | Per-document, isolated |
| API configs | localStorage (session-only) | Encrypted in memory |
| Social data (points, achievements) | localStorage | Per-origin |
| Moments/posts | localStorage | Per-origin |
| User preferences | localStorage | Per-origin |

### What We DON'T Store

- Server-side databases
- User credentials (no authentication)
- Third-party tracking data
- Analytics data sent to external servers

## API Key Security

### Session-Only Storage

API keys are stored in React state (memory) only. They are:
- NOT persisted to localStorage
- NOT sent to any server except the configured AI API endpoint
- NOT logged or exposed in console (keys are masked in logs)

### Multi-Provider Profiles

When users save API configurations:
- Profile metadata (name, URL, model) is saved to localStorage
- API keys are held in memory only (session-only mode)
- Users can opt-in to persist keys with clear warning about localStorage risks

### Best Practices

1. **Use environment variables** for production deployments (Vercel, Netlify, etc.)
2. **Restrict API keys** to minimum required permissions
3. **Enable rate limiting** on your AI API account
4. **Rotate keys regularly** if using shared accounts

## Client-Side Security Considerations

### XSS Prevention

- React's default escaping prevents XSS in rendered content
- Markdown rendering uses sanitized HTML
- No `dangerouslySetInnerHTML` usage except in controlled markdown rendering

### Data Isolation

- IndexedDB namespaces are isolated per character (T12 memory system)
- No cross-origin data leakage
- User data confined to same-origin localStorage

### Browser APIs

- `MediaRecorder` API requires user gesture (button click) to start recording
- Camera access requires explicit permission prompt
- No persistent background processes

## Content Security

### AI Responses

AI responses are rendered as markdown with:
- Code blocks with syntax highlighting (no code execution)
- LaTeX rendering (math only, no scripts)
- Mermaid diagrams (visual rendering, no scripts)
- Link previews with hover information (no automatic navigation)

### User-Generated Content

- Chat messages stored as plain text
- Moments/posts support markdown with same sanitization as AI responses
- File uploads are text-only (no executable files)

## Privacy Considerations

### Data Location

All data stays in the user's browser:
- No server-side data collection
- No third-party analytics
- No data sent to AI providers beyond what's needed for API calls

### Data Portability

Users can export:
- Chat history as TXT/JSON/HTML
- API configurations (for backup, not keys)
- Moments data
- Knowledge base documents

### Data Deletion

Users can:
- Clear all data from app settings
- Delete individual chats
- Remove bookmarks
- Clear AI memories

## Known Limitations

### Client-Side Only

Because this is a client-side app:
- Data is tied to a single browser/device
- No cross-device sync
- No server-side backup
- Data lost if localStorage/IndexedDB is cleared

### Browser Storage Limits

- localStorage: ~5-10MB per origin
- IndexedDB: Varies by browser (100MB-unlimited typically)
- App implements graceful degradation when storage is full

### API Key Exposure

If using `.env` files or localStorage persistence:
- Keys visible in browser dev tools
- Keys visible in network requests (to AI API)
- Keys visible in hosting platform settings

### Mitigation

1. Use hosting platform environment variables (never in code)
2. Enable server-side key restrictions (IP allowlists, domain restrictions)
3. Use read-only API keys where AI provider supports it
4. Monitor API usage for anomalies

## Reporting Security Issues

If you discover a security vulnerability, please:
1. Check if it's already documented in known limitations
2. For actual security bugs (not design limitations), report to the repository maintainer
3. Include reproduction steps and potential impact

## Security Dependencies

The project uses these dependencies for security-relevant functionality:

| Package | Version | Purpose |
|---------|---------|---------|
| react-markdown | 10.1.0 | Safe markdown rendering |
| rehype-sanitize | (via react-markdown) | HTML sanitization |
| DOMPurify | (via rehype-sanitize) | XSS prevention |

These are kept up-to-date via regular `npm update` and security advisories monitoring.

## Compliance

This application is designed for personal use. For organizational deployment:

1. Review data handling with your security team
2. Ensure AI API provider meets your compliance requirements
3. Verify hosting platform security controls
4. Consider VPN/SSO integration if needed (requires custom implementation)