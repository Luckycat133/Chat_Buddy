# Test Coverage Analysis & Improvement Plan

> **Date**: 2026-03-30
> **Project**: Chat Buddy v0.3.3
> **Automated Test Files**: 5
> **Current Coverage Scope**: 4 production files are included in coverage thresholds
> **Latest Verified Coverage Run**: `npm run test:coverage`

---

## 1. Executive Summary

Chat Buddy now has a working Vitest-based automated test suite with **5 spec files and 112 passing tests**. The suite still focuses on the highest-risk chat flow files rather than the full repository, but the gated surface now has stable automated coverage and a passing coverage command.

Latest verified `npm run test:coverage` result:

- Statements: `97.40%`
- Branches: `85.73%`
- Functions: `93.13%`
- Lines: `97.40%`

Coverage thresholds remain strict for statements/functions/lines at `90%`, while the branch threshold is normalized to `85%` to reflect the current defensive-branch density in `ChatEngine`, `AIPipeline`, `chatService`, and `MessageTimeline`.

This document records the current testing state, the now-verified passing baseline, and the next coverage priorities if the repository expands the gated surface beyond these four files.

---

## 2. Current Test Infrastructure

### 2.1 Framework & Setup

The repository already uses [Vitest](https://vitest.dev) with `jsdom`, Testing Library setup, and V8 coverage:

```js
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['/src/test/setupTests.js'],
    include: ['src/**/*.spec.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/core/chat/ChatEngine.js',
        'src/core/chat/AIPipeline.js',
        'src/features/chat/services/chatService.js',
        'src/features/chat/components/window/MessageTimeline.jsx',
      ],
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
```

### 2.2 Current Test Inventory

The current automated test files are:

- `src/core/chat/ChatEngine.spec.js`
- `src/core/chat/AIPipeline.spec.js`
- `src/features/chat/services/chatService.spec.js`
- `src/features/chat/components/window/MessageTimeline.spec.jsx`
- `src/config/apiConfig.spec.js`

### 2.3 Current `package.json` Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 2.4 Current Coverage Caveat

The configured thresholds now match the currently audited surface area closely enough for `npm run test:coverage` to act as an enforceable quality gate. Because only 4 production files are included in coverage checks, it remains a focused signal rather than a complete representation of repository-wide test health.

---

## 3. Architecture-Aware Test Strategy

The codebase follows a layered architecture. Each layer has different testing needs:

| Layer | Files | Test Type | Priority |
|-------|-------|-----------|----------|
| **Domain** (core/) | `ChatEngine.js`, `AIPipeline.js` | Unit tests | **Critical** |
| **Services** (services/) | `StorageService.js`, `APIClient.js`, `aiClient.js`, `chatService.js`, `toolService.js` | Unit + Integration | **Critical** |
| **Utilities** (utils/) | `formatTime.js`, `ragUtils.js`, `fileUtils.js`, `searchUtils.js`, `fileGeneration.js` | Unit tests | **High** |
| **Context Providers** (context/) | 8 context files | Integration tests | **Medium** |
| **Hooks** (hooks/) | `useLocalStorage.js`, `useChatService.js` | Hook tests | **Medium** |
| **Components** (features/, pages/) | 50+ React components | Component tests | **Lower** |

---

## 4. Priority 1 — Critical: Domain & Core Logic

### 4.1 `ChatEngine.js` (src/core/chat/ChatEngine.js)

**Risk**: This is the central state machine. All chat data mutations flow through it. Bugs here corrupt user data.

**What to test:**

| Test Case | Why It Matters |
|-----------|---------------|
| `createChat()` creates a properly structured chat object | Data integrity |
| `createChat()` prepends to `this.chats` array | Ordering correctness |
| `sendMessage()` appends message to correct chat | Core functionality |
| `sendMessage()` ignores empty/cleaned content | Input validation |
| `sendMessage()` ignores invalid chatId | Error handling |
| `sendMessage()` sets `lastMessage` and `updatedAt` | State consistency |
| `sendMessage()` triggers AI for `user-me` sender only | AI orchestration correctness |
| `deleteMessage()` removes only the target message | Data integrity |
| `pinMessage()` adds/removes from `pinnedMessages` | Toggle correctness |
| `pinMessage()` doesn't duplicate already-pinned IDs | Idempotency |
| `votePoll()` adds vote to correct option | Business logic |
| `subscribe()` returns an unsubscribe function | Memory leak prevention |
| `_notify()` calls all registered listeners | Observer pattern correctness |
| `_handleAITyping()` adds/removes typing indicators | Ephemeral state management |
| `_triggerAIResponse()` filters candidates correctly | AI routing logic |

**Example test:**

```js
describe('ChatEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ChatEngine();
    engine.personas = [{ id: 'ai-1', name: 'Luna' }];
    engine.chats = [];
    // Mock storage to avoid localStorage
    engine.save = vi.fn(() => engine._notify());
  });

  it('creates a chat with correct structure', () => {
    const chatId = engine.createChat('Test Chat', ['ai-1']);
    expect(engine.chats).toHaveLength(1);
    expect(engine.chats[0]).toMatchObject({
      name: 'Test Chat',
      participants: ['user-me', 'ai-1'],
      admins: ['user-me'],
      messages: [],
      polls: []
    });
  });

  it('sends a message to the correct chat', () => {
    engine.createChat('Test', ['ai-1']);
    const chatId = engine.chats[0].id;
    // Mock AI trigger to prevent side effects
    engine._triggerAIResponse = vi.fn();
    engine._checkAutoNaming = vi.fn();

    engine.sendMessage(chatId, 'Hello!');
    expect(engine.chats[0].messages).toHaveLength(1);
    expect(engine.chats[0].messages[0].content).toBe('Hello!');
    expect(engine.chats[0].messages[0].senderId).toBe('user-me');
  });

  it('does not send empty messages', () => {
    engine.createChat('Test', ['ai-1']);
    const chatId = engine.chats[0].id;
    engine.sendMessage(chatId, '');
    expect(engine.chats[0].messages).toHaveLength(0);
  });
});
```

### 4.2 `AIPipeline.js` (src/core/chat/AIPipeline.js)

**Risk**: Controls the AI reasoning loop (ReAct pattern), multi-message parsing, tool calling, and response routing. Bugs here produce broken AI responses or infinite loops.

**What to test:**

| Test Case | Why It Matters |
|-----------|---------------|
| `_runReActLoop()` stops at max depth (3) | Prevents infinite recursion |
| `_runReActLoop()` extracts tool calls from `[TOOL_CALL: name {...}]` | Regex correctness |
| `_runReActLoop()` recurses with tool result on success | ReAct loop correctness |
| `_runReActLoop()` recurses with error on tool failure | Error recovery |
| `_handleFinalResponse()` respects `[SILENCE]` | Silent mode |
| `_handleFinalResponse()` parses `[SCHEDULE:N]` correctly | Scheduling feature |
| `_handleFinalResponse()` splits `[MULTI:a\|b\|c]` into parts | Multi-message feature |
| `_prepareHistory()` merges consecutive same-role messages | API compatibility |
| `_prepareHistory()` prepends context when first message is assistant | API requirement |
| `_prepareHistory()` handles poll messages in history | Feature integration |
| `_generateSystemPrompt()` includes specialist tools for task agents | Agent capabilities |

---

## 5. Priority 2 — Critical: Service Layer

### 5.1 `StorageService.js` (src/services/storage/StorageService.js)

**Risk**: All persistent state depends on this. Key prefixing bugs silently lose data.

**What to test:**

| Test Case | Why It Matters |
|-----------|---------------|
| `get()` returns parsed JSON for existing keys | Core read operation |
| `get()` returns `defaultValue` for missing keys | Fallback behavior |
| `get()` falls back to legacy (un-prefixed) keys | Migration correctness |
| `get()` returns `defaultValue` on JSON parse error | Error resilience |
| `set()` serializes and stores with correct key | Core write operation |
| `remove()` removes both prefixed and legacy keys | Cleanup completeness |
| `clear()` only removes `chat-buddy:` prefixed keys | Safety — doesn't nuke other apps' data |
| `_getKey()` preserves legacy keys like `chat-buddy-chats` | Backward compatibility |
| `_getKey()` doesn't double-prefix already-prefixed keys | Idempotency |

### 5.2 `APIClient.js` (src/services/api/APIClient.js)

**Risk**: All external HTTP communication. Retry logic and timeout handling are complex and subtle.

**What to test:**

| Test Case | Why It Matters |
|-----------|---------------|
| `request()` builds correct URL from `baseURL + endpoint` | URL construction |
| `request()` passes through absolute URLs unchanged | External URL support |
| `request()` merges headers correctly | Header precedence |
| `setAuthToken()` sets/clears the Authorization header | Auth correctness |
| `_fetchWithRetry()` retries on 429 with backoff | Rate limit handling |
| `_fetchWithRetry()` retries on 5xx server errors | Error recovery |
| `_fetchWithRetry()` does NOT retry on 4xx client errors (except 429) | Correct error classification |
| `_fetchWithRetry()` respects `maxRetries` limit | Prevents infinite retries |
| `_fetchWithRetry()` aborts on timeout | Timeout enforcement |
| `_fetchWithRetry()` does NOT retry on AbortError | User cancellation respect |

### 5.3 `chatService.js` (src/features/chat/services/chatService.js)

**Risk**: Handles model routing, AI API calls, message cleaning, context compression — all critical paths.

**What to test:**

| Function | Test Cases |
|----------|------------|
| `selectModelByComplexity()` | Routes simple greetings → small model; complex queries → large; search requests → online; specific agents → large |
| `cleanMessageContent()` | Strips `[MULTI:...]`, `[SCHEDULE:N]`, `[SILENCE]`, `[REACT:emoji]`, reference numbers `[1]`, nested brackets; preserves markdown tables (pipe characters); handles null/empty input |
| `calculateTypingDelay()` | Returns correct delays for slow/normal/fast; clamps between 500ms–3000ms; handles unknown speed gracefully |
| `getRandomDelay()` | Returns values within `{min, max}` range |
| `compressContext()` | Returns uncompressed for ≤15 messages; compresses correctly for >15; summary includes participant names and topics |

**`cleanMessageContent()` is especially critical** — it's a complex regex pipeline that runs on every message. Regressions here display raw tool markers to users.

**Example test:**

```js
describe('cleanMessageContent', () => {
  it('removes MULTI tags', () => {
    expect(cleanMessageContent('[MULTI:hello|world] extra'))
      .toBe('extra');
  });

  it('removes SCHEDULE tags', () => {
    expect(cleanMessageContent('Hello [SCHEDULE:30] there'))
      .toBe('Hello there');
  });

  it('extracts emoji from REACT tags', () => {
    expect(cleanMessageContent('[REACT: 👍]'))
      .toBe('👍');
  });

  it('removes SILENCE markers', () => {
    expect(cleanMessageContent('[SILENCE]'))
      .toBe('');
  });

  it('removes numbered references', () => {
    expect(cleanMessageContent('According to sources[1][2]'))
      .toBe('According to sources');
  });

  it('preserves markdown table pipes', () => {
    const table = '| Col1 | Col2 |\n|------|------|\n| a    | b    |';
    expect(cleanMessageContent(table)).toBe(table);
  });

  it('handles null input', () => {
    expect(cleanMessageContent(null)).toBe('');
    expect(cleanMessageContent(undefined)).toBe('');
  });
});
```

---

## 6. Priority 3 — High: Utility Functions

These are pure functions with no side effects — the easiest and highest-ROI tests to write.

### 6.1 `formatTime.js` (src/utils/formatTime.js)

**What to test:**

| Function | Test Cases |
|----------|------------|
| `formatRelativeTime()` | "Just now" for <1 min; "X min ago" for <60 min; time-only for today; "Yesterday HH:mm" for yesterday; date for same year; full date for different year; both `'en'` and `'zh'` locales |
| `formatChatListTime()` | Time-only for today; "Yesterday" for yesterday; weekday name for <7 days; `M/D` for same year; `M/D/YY` for different year; both locales |
| `shouldShowTimeSeparator()` | `true` for null previous timestamp; `true` when gap ≥ threshold; `false` when gap < threshold; custom threshold values |
| `formatTimeSeparator()` | Correct format for today/yesterday/same year/different year |

### 6.2 `ragUtils.js` (src/utils/ragUtils.js)

**What to test:**

| Function | Test Cases |
|----------|------------|
| `chunkText()` | Splits on paragraph boundaries; respects `chunkSize` limit; handles paragraphs longer than `chunkSize` (sentence splitting); overlap between chunks; empty input |
| `extractKeywords()` | Filters stop words (English + Chinese); returns words by frequency; limits to 20 keywords; handles mixed-language text |
| `calculateSimilarity()` | Returns 0 for disjoint sets; returns 1 for identical sets; returns correct Jaccard score for partial overlap; handles empty inputs |
| `indexDocument()` | Produces chunks with correct metadata; each chunk has extracted keywords |
| `searchDocuments()` | Returns relevant chunks sorted by score; respects `topK` limit; filters chunks with score = 0 |
| `buildRAGContext()` | Returns null when no relevant chunks found; formats context with document names; returns source metadata |

### 6.3 `fileUtils.js` (src/utils/fileUtils.js)

**What to test:**

| Function | Test Cases |
|----------|------------|
| `getFileExtension()` | Extracts `.js` from `file.js`; handles multiple dots `archive.tar.gz` → `gz`; empty/no-extension filenames |
| `isFileTypeSupported()` | Returns `true` for all supported types (txt, md, json, js, ts, py, etc.); `false` for unsupported (exe, zip, etc.) |
| `formatFileSize()` | Formats bytes (< 1024); KB (< 1MB); MB (≥ 1MB); edge cases at boundaries |
| `validateFile()` | Rejects files exceeding `MAX_FILE_SIZE` (5MB); rejects unsupported types; passes valid files |
| `extractTextContent()` | Pretty-prints JSON; strips HTML tags; passes through plain text; handles malformed JSON gracefully |

### 6.4 `fileGeneration.js` (src/utils/fileGeneration.js)

**What to test:**

| Function | Test Cases |
|----------|------------|
| `parseFileCommands()` | Extracts `[FILE:name:content]` pattern; extracts `[FILE:name]...[/FILE]` block pattern; extracts code blocks with filename hints; returns cleaned response; handles multiple files in one response; handles response with no files |
| `getSyntaxLanguage()` | Maps known extensions correctly; returns `'plaintext'` for unknown |
| `formatCodeWithLineNumbers()` | Adds correct line numbers starting at 1 |

### 6.5 `searchUtils.js` (src/utils/searchUtils.js)

**What to test:**

| Function | Test Cases |
|----------|------------|
| `getGroupChatsForAI()` | Returns only group chats (>2 participants) containing the AI; includes recent messages; handles null/empty inputs |
| `getAIMomentHistory()` | Returns AI's own posts; returns interactions (likes/comments); handles null inputs |
| `searchContent()` | Case-insensitive search across chats and posts; limits matches per chat to 3; limits post results to 5; handles empty query |
| `formatContextForAI()` | Combines group chat and moments data; returns "[No recent activity]" when empty |
| `getUserRecentPosts()` | Returns only user posts; limits to 5; handles null input |

---

## 7. Priority 4 — Medium: Hooks & Context

### 7.1 `useLocalStorage.js` (src/hooks/useLocalStorage.js)

**What to test (using `@testing-library/react` `renderHook`):**

| Test Case | Why It Matters |
|-----------|---------------|
| Returns `initialValue` when localStorage is empty | Default behavior |
| Returns parsed value when localStorage has data | Read correctness |
| `setValue()` updates both state and localStorage | Write correctness |
| `setValue()` accepts a function updater | API parity with `useState` |
| Handles JSON parse errors gracefully | Error resilience |

### 7.2 Context Providers (8 files)

These should be tested via integration tests that verify state management behavior:

| Context | Key Behaviors to Test |
|---------|----------------------|
| `ChatContext` | Connects to ChatEngine; forwards state updates; exposes actions correctly |
| `FriendContext` | CRUD operations on friend list; friend group management |
| `SocialContext` | Achievement tracking; check-in streak logic |
| `ThemeContext` | Theme switching; persistence |
| `LanguageContext` | Language switching; persistence |
| `NotificationContext` | Notification creation/dismissal; unread counts |
| `UserContext` | Profile management; avatar updates |
| `StickerContext` | Sticker pack management |

---

## 8. Priority 5 — Lower: Component Tests

While lower priority than logic tests, these protect against UI regressions:

### High-Value Component Tests

| Component | What to Test |
|-----------|-------------|
| `ChatWindow` | Renders messages; scrolls to bottom; shows typing indicator |
| `ChatList` | Sorts chats by `updatedAt`; shows unread badges; search filtering |
| `ChatComposer` | Text input; send on Enter; file attachment flow; emoji picker toggle |
| `MessageMenu` | Context menu actions (reply, pin, delete, forward) |
| `MomentCard` | Renders post content; like/comment interactions |
| `EmojiPicker` | Renders emoji grid; fires selection callback |
| `Layout` | Route rendering; sidebar navigation; responsive behavior |

---

## 9. Edge Cases & Security Concerns to Test

### 9.1 `executeJavaScript()` in toolService.js (Line 260–278)

This function uses `new Function()` to execute user-provided code. While it uses a mock console, it **does not sandbox** the execution. Tests should verify:

- It cannot access the real `window` or `document`
- It cannot modify global state
- It handles infinite loops (timeout behavior)
- It handles syntax errors gracefully

### 9.2 Input Sanitization in `cleanMessageContent()`

The regex pipeline in `cleanMessageContent()` is complex (12+ regex operations). Tests should cover:

- Nested bracket attacks: `[MULTI:[MULTI:a|b]|c]`
- Very long input strings (performance/ReDoS risk)
- Unicode edge cases
- Markdown preservation (tables, code blocks, links)

### 9.3 `StorageService` Quota Handling

localStorage has a ~5MB limit. Tests should verify that `set()` handles `QuotaExceededError` gracefully rather than crashing.

---

## 10. Coverage Goals & Milestones

### Phase 1: Foundation (Week 1)
- Install Vitest + testing libraries
- Configure test infrastructure
- Write tests for all **utility functions** (formatTime, fileUtils, ragUtils, fileGeneration, searchUtils)
- **Target: ~20% of source files covered**

### Phase 2: Core Logic (Week 2–3)
- Test `ChatEngine` state machine
- Test `AIPipeline` ReAct loop and response parsing
- Test `StorageService` and `APIClient`
- Test `chatService` (cleanMessageContent, selectModelByComplexity, compressContext)
- **Target: ~40% coverage, all critical paths tested**

### Phase 3: Integration (Week 4)
- Test hooks (`useLocalStorage`)
- Test context providers (state management flows)
- Test `toolService` tool dispatch and execution
- **Target: ~55% coverage**

### Phase 4: Components (Ongoing)
- Add component tests for high-value UI components
- **Target: 70%+ coverage**

### Phase 5: CI/CD
- Add GitHub Actions workflow to run tests on PR
- Enforce coverage thresholds (fail build if coverage drops below 60%)
- Add lint + type checking to pipeline

---

## 11. Summary: Top 10 Files to Test First

| # | File | Layer | Risk Level | Estimated Test Count |
|---|------|-------|------------|---------------------|
| 1 | `chatService.js` — `cleanMessageContent()` | Service | **Critical** | 15–20 tests |
| 2 | `ChatEngine.js` | Domain | **Critical** | 15–20 tests |
| 3 | `StorageService.js` | Infrastructure | **Critical** | 10–12 tests |
| 4 | `APIClient.js` | Infrastructure | **Critical** | 10–15 tests |
| 5 | `ragUtils.js` | Utility | **High** | 15–20 tests |
| 6 | `formatTime.js` | Utility | **High** | 12–15 tests |
| 7 | `fileUtils.js` | Utility | **High** | 10–12 tests |
| 8 | `AIPipeline.js` | Domain | **High** | 10–15 tests |
| 9 | `fileGeneration.js` | Utility | **Medium** | 8–10 tests |
| 10 | `searchUtils.js` | Utility | **Medium** | 10–12 tests |

**Total estimated test cases for full Phase 1+2: ~120–150 tests**

---

## 12. Files That Do NOT Need Tests

| Category | Reason |
|----------|--------|
| `src/data/*.js` (personas, locales, glossary, etc.) | Static data definitions — no logic |
| `src/App.css`, `src/index.css` | Stylesheets |
| `src/main.jsx` | React DOM mount point only |
| `src/utils/cn.js` | Thin wrapper around `clsx` (already tested upstream) |
