# UX QA Report — 2026-05-01

## Summary

| Page | Status | Notes |
|------|--------|-------|
| Dashboard | ✅ Pass | Bento grid loads, all widgets visible |
| Sidebar Navigation | ✅ Pass | 9 nav links (Chats, Discover, Friends, Moments, Settings, etc.) |
| Chat List | ✅ Pass | Chat items render, add button functional |
| Friends Page | ✅ Pass | Friends list loads correctly |
| Moments Page | ✅ Pass | Feed renders, composer placeholder visible |
| Settings Page | ✅ Pass | All settings sections render, toggles styled |
| Theme Toggle | ✅ Pass | Dark/Light mode switches correctly |
| Mobile Layout | ✅ Pass | Responsive at 375px width |
| Console Errors | ✅ Pass | 0 critical errors |

## Critical Fixes Applied

### 1. Typing Indicator Infinite Loop (ChatEngine + useChatService)

**Root Cause**: The `getSnapshot()` function in `useChatService.js` used a caching mechanism that compared `chatsLength` and `lastMsgCount`, but `typingIndicators` could change independently without triggering a cache invalidation. This caused `useSyncExternalStore` to receive inconsistent snapshots, leading to infinite re-render loops in React 19.

**Fix**: Rewrote `getSnapshot()` to compare all relevant state fields (`chats`, `typingIndicators`, `editingIndicators`, `presenceMap`, `moodMap`) using deep comparison, returning the cached reference only when nothing changed. This satisfies React 19's strict snapshot consistency requirements while preventing infinite loops.

**File**: `src/features/chat/hooks/useChatService.js`

### 2. Settings Toggle Styling (CSS)

**Issue**: Settings page toggle controls had a cheap appearance with visible borders.

**Fix**: Applied glass morphism styling and spring easing to `.control-card` elements in `src/index.css`.

## Known Limitations

- **AI Posts in Moments**: API rate limiting (429) may prevent AI posts from generating in test environments. Posts render normally when API is available.
- **Image Loading**: MiniMax image generation may fail with "图片加载受限" in rate-limited scenarios.
- **Onboarding Modal**: The welcome tour modal intercepts pointer events in automated tests. Must be dismissed with "Skip" button before interacting with the app.

## Browser Testing

Tested via Playwright with Chromium (headless) at 1280×800 and 375×667 (mobile) viewports.
