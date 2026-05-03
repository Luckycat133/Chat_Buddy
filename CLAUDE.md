# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Chat Buddy Remake** is a modern AI chat companion application featuring multiple AI personas with distinct personalities, bilingual support (English/Chinese), and social features like Moments/Timeline. Built with React 19, Vite 7, and TailwindCSS 4.

### Tech Stack

- **Frontend**: React 19.2.0, React Router DOM 7.10.1
- **Build**: Vite 7.2.4
- **Styling**: TailwindCSS 4.1.17 (CSS-first, no config file)
- **Animations**: Framer Motion 12.26.2
- **AI**: OpenAI-compatible API (DeepSeek, Perplexity, etc.)
- **Storage**: IndexedDB (chat/docs/media) + LocalStorage (light settings, namespace: `chat-buddy:`)
- **Testing**: Vitest 3 + jsdom, Playwright, MSW, Testing Library
- **Linting**: ESLint 9.39.1

## Development Commands

```bash
# Start development server (default: http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Run unit tests (vitest + jsdom)
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run e2e tests (Playwright, requires dev server on :5173)
npx playwright test

# Prompt regression benchmark
npm run prompt:bench

# UX walkthrough (uses Playwright to capture screenshots)
npm run stress
```

## Architecture

The codebase follows **Clean Architecture** principles with clear layer separation:

```
┌─────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                     │
│  React Components, Pages, UI Elements               │
│  Location: src/pages/, src/features/*/components/   │
├─────────────────────────────────────────────────────┤
│              APPLICATION LAYER                      │
│  Hooks (useChatService), Context Providers          │
│  Location: src/features/*/hooks/, src/context/      │
├─────────────────────────────────────────────────────┤
│              DOMAIN LAYER (Pure JS)                 │
│  ChatEngine, AIPipeline                            │
│  Location: src/core/                                │
│  ⚠️ NO React dependencies allowed here              │
├─────────────────────────────────────────────────────┤
│           INFRASTRUCTURE LAYER                      │
│  APIClient, StorageService, External APIs           │
│  Location: src/services/                            │
└─────────────────────────────────────────────────────┘
```

### Design Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Singleton** | ChatEngine | Single source of truth for chat state |
| **Observer** | ChatEngine.subscribe() | Notify components of state changes |
| **Dependency Injection** | AIPipeline constructor | Inject callbacks for events |
| **Facade** | ChatContext | Hide complexity, provide simple API |
| **Strategy** | AI personas | Different behavior implementations |
| **Pipeline** | AIPipeline | Multi-step AI processing |
| **Repository** | StorageService | Abstract storage mechanism |

### Directory Structure

```
src/
├── core/              # Domain logic (pure JS, no React)
│   ├── chat/          # ChatEngine, AIPipeline, ChatNormalizer, ChatPollManager
│   └── presence/      # PresenceService, GreetingService
├── services/          # Infrastructure
│   ├── api/           # APIClient (HTTP client), aiClient (AI API singleton)
│   └── storage/       # StorageService (localStorage), ChatStorageService (IndexedDB),
│                      #   DocumentStorageService, ImageStorageService
├── features/          # Feature modules
│   ├── chat/          # Chat components, hooks, services
│   ├── moments/       # Social feed system
│   └── background/    # BackgroundContext, BackgroundLayer, themes, DynamicBackground
├── context/           # Global contexts (FriendContext, LanguageContext)
├── components/        # Shared UI components
├── pages/             # Route pages
├── data/              # Static data (personas, locales, skills)
├── test/              # Test setup (MSW server, crypto mock)
└── utils/             # Shared utilities (sanitize, logger, validation)
```

## Core Systems

### 1. ChatEngine (Singleton)

Located in `src/core/chat/ChatEngine.js`. The central state machine that manages:
- Chat lifecycle and message mutations
- Persistence via StorageService
- AI orchestration via AIPipeline
- Typing indicators and presence tracking
- Greeting system integration

**Key Methods:**
- `init(personas)`: Initialize with persona list
- `createChat(name, participantIds, avatar)`: Create new chat
- `sendMessage(chatId, content, senderId, quotedMessageId)`: Send a message
- `deleteMessage(chatId, messageId)`: Delete message
- `updateChat(chatId, updates)`: Update chat properties
- `pinMessage(chatId, messageId, isPinned)`: Pin/unpin message
- `subscribe(callback)`: Subscribe to state changes (returns unsubscribe fn)
- `save()`: Persist to localStorage and notify listeners

**State Structure:**
```js
{
    chats: [
        {
            id: 'uuid',
            name: string,
            avatar: string | null,
            participants: ['user-me', 'ai-1', 'ai-2'],
            admins: ['user-me'],
            messages: [
                {
                    id: 'uuid',
                    senderId: 'user-me' | 'ai-X',
                    content: string,
                    timestamp: ISO8601,
                    status: 'sent' | 'delivered' | 'read',
                    quotedMessageId?: string,
                    readBy: ['ai-1', ...],
                    reactions?: { '😀': ['user-me'], '❤️': ['ai-1'] }
                }
            ],
            theme: string,
            settings: { muteValues: { 'ai-1': true } },
            polls: [],
            pinnedMessages: [],
            backgroundId: string,
            lastMessage: MessageObject,
            updatedAt: ISO8601,
            createdAt: ISO8601
        }
    ],
    typingIndicators: { 'chat-id': ['ai-1', 'ai-2'] }
}
```

**Internal Workflow:**
```
User sends message
    → ChatEngine.sendMessage() adds to chat.messages
    → Auto-triggers _triggerAIResponse()
    → Determines which AIs should respond (mentions, last speaker, activity, randomness)
    → For each candidate AI: aiPipeline.processTurn(chat, personas, ai)
    → AIPipeline runs ReAct loop
    → Response via _handleAIMessage() callback
    → ChatEngine adds AI message, notifies all subscribers
    → UI re-renders
```

### 2. AIPipeline

Located in `src/core/chat/AIPipeline.js`. Handles AI reasoning with:
- ReAct loop for tool calling (max depth: 3)
- Multi-message responses (AI can send consecutive messages)
- Typing simulation based on persona typing speed
- Context compression for long conversations
- API integration via `aiClient`

**Processing Flow:**
1. Calculate delays (read delay + thinking delay)
2. Signal typing to UI
3. Prepare context (compress old messages, extract last 12, merge consecutive)
4. Generate system prompt (persona info, tools, instructions)
5. Run ReAct loop: call LLM → check for `[TOOL_CALL]` → execute → recurse
6. Parse final response for special markers → deliver messages

**Special Response Markers:**
```js
"[SILENCE]"                              // Don't send message
"[MULTI:First msg|Second msg|Third msg]" // Send multiple messages sequentially
"[SCHEDULE:15]I'll check back later!"    // Schedule proactive message in N minutes
"[TOOL_CALL: execute_code {\"code\": \"2 + 2\"}]"  // Execute tool and continue reasoning
```

### 3. Presence System

Located in `src/core/presence/PresenceService.js`. Manages dynamic AI status:
- **Online/Busy/Offline** states based on persona schedules
- Timezone-aware scheduling (each persona has own timezone)
- Real-time presence updates

**Persona Schedule Format:**
```js
schedule: {
  timezone: 'Asia/Shanghai',
  sleep: { start: 2, end: 10 },      // Offline hours
  busy: [{ start: 14, end: 16 }]     // Busy periods
}
```

### 4. Greeting Service

Located in `src/core/presence/GreetingService.js`. Proactive AI greetings:
- Triggers when opening chat after long inactivity
- Character-specific greeting messages
- Prevents greeting spam (minimum interval)

### 5. Friend System

Located in `src/context/FriendContext.jsx`. Manages:
- **Groups**: Organize friends (Anime, Study Buddies, etc.)
- **Metadata**: Starred, pinned, remarks, custom signatures
- **Interaction tracking**: Recent activity (viewed moment, sent gift, chatted)

### 6. Context Hierarchy

All contexts are composed in `src/providers/AppProviders.jsx`:

```
LanguageProvider → ThemeProvider → NotificationProvider → SocialProvider
  → StickerProvider → DocumentProvider → UserProvider → FriendProvider
    → MomentsProvider → ChatProvider → BackgroundProvider → {children}
```

## Data Flow

**Message Sending:**
1. User types in `ChatComposer` component
2. `useChatService` hook calls `ChatEngine.sendMessage()`
3. `ChatEngine` persists message and triggers `AIPipeline`
4. `AIPipeline` calls AI API via `APIClient`
5. Response flows back through `ChatEngine` to UI subscribers

**Presence Updates:**
1. `ChatEngine.init()` starts `PresenceService`
2. `PresenceService` checks persona schedules every 30s
3. Presence map updated: `{ personaId: 'online'|'busy'|'offline' }`
4. `ChatEngine._notify()` emits state to all subscribers

## Key Patterns & Conventions

### Personas

All AI characters are defined in `src/data/personas.js` with:
- **Social Companions**: Luna, Max, Bella, Oliver, Sophie + 8 anime characters
- **Task Agents**: Coder, Muse, Scholar, Sensei, Aurora, Pixel (specialized AIs)

**Persona Structure:**
```js
{
  id: 'ai-1',
  name: 'Luna',
  name_zh: '露娜',
  avatar: '/avatars/avatar_luna.png',
  personality: 'Curious, dreamer, empathetic',
  interests: ['Astrology', 'Indie Music', 'Travel'],
  responseDelay: { min: 2000, max: 4000 },  // Typing simulation
  typingSpeed: 'normal',                     // 'fast' | 'normal' | 'slow'
  schedule: { timezone, sleep, busy },
  defaultBackgroundId: 'luna_starry'
}
```

**Task Agent Structure:**
```js
{
  id: 'agent-coder',
  name: 'Coder',
  agentType: 'task-specialist',
  category: 'productivity',              // 'productivity' | 'education' | 'creative'
  systemPrompt: 'You are a programming assistant...',
  skills: ['programming', 'debugging'],
  tools: [{ name: 'execute_code', description: 'Execute JavaScript code' }],
  toolsEnabled: true,
  responseDelay: { min: 800, max: 2000 },
  typingSpeed: 'fast'
}
```

### Bilingual Support

- All UI text goes through `src/data/locales.js` (500+ translation keys)
- Use `useLanguage()` hook to get current language and `t()` function
- Convention: `t('key.nested.path')` for translations
- Add both English and Chinese for all new UI text

### Theming

- **TailwindCSS 4**: CSS-first (no config file), uses `@import "tailwindcss";`
- **CSS Variables**: Defined in `src/index.css` for theming
- **Dark Mode**: `.dark` class on `<html>`, OLED variant: `.dark.oled`
- **Glass Effects**: `.glass`, `.glass-strong`, `.glass-crystal`, `.glass-aurora`

### Storage

- **Primary data** (chats, documents, moments): **IndexedDB** via `ChatStorageService`, `DocumentStorageService`
- **Light settings**: `StorageService` wrapper around **localStorage** (namespace: `chat-buddy:`)  
- **Media/assets** (avatars, backgrounds): `ImageStorageService` (IndexedDB) — avoids 5MB localStorage limit
- Key localStorage keys:
  - `chat-buddy-chats`: Chat history (migrating to IndexedDB)
  - `chat-buddy-friend-data`: Friend metadata
  - `chat-buddy-moments`: Social feed posts
  - `chat-buddy-backgrounds`: Background settings

### Environment Variables

Required in `.env`:
```env
VITE_AI_API_URL=https://api.deepseek.com    # API base URL
VITE_AI_API_KEY=sk-xxxxx                    # API key
VITE_AI_MODEL=deepseek-chat                 # Model name
VITE_TAVILY_API_KEY=tvly-xxxxx              # Tavily web search (for web_search tool)
```

Supports any OpenAI-compatible API provider (DeepSeek, Perplexity, OpenAI).
Runtime API keys entered in the Settings UI are stored in sessionStorage only (cleared on tab close).

## Versioning Strategy

- `v0.1.x`: Foundation Layer (i18n, API, UI Design System)
- `v0.2.x`: Basic Role-Play (Characters, Chat, Social)
- `v0.3.x`: Basic Agent (Memory, Agents, RAG, Professional Skills)
- `v0.4.x`: Modernization & Polish (Final UI, Quality Consolidation)

Version updates follow [Keep a Changelog](https://keepachangelog.com/) format in `CHANGELOG.md`.

## Code Style

### ESLint Configuration

- Based on `@eslint/js` recommended config
- React Hooks rules enforced
- Unused vars allowed if: uppercase constants, prefixed with `_`, or caught error pattern
- Target: ES2020, browser environment

### React Patterns

- **Hooks over Classes**: All components are functional
- **Context for Global State**: `FriendContext`, `LanguageContext`
- **Custom Hooks**: `useChatService`, `useLanguage`, `useLocalStorage`
- **Memoization**: Use `useMemo`/`useCallback` to prevent dependency churn in contexts

### File Naming

- Components: PascalCase (e.g., `ChatComposer.jsx`)
- Services/Utilities: camelCase (e.g., `chatService.js`)
- Context: PascalCase with "Context" suffix (e.g., `FriendContext.jsx`)

## Feature Development Guidelines

### Adding a New AI Persona

1. Add to `src/data/personas.js` with all required fields
2. Create avatar in `public/avatars/avatar_name.png`
3. Define schedule for presence system
4. Add default signature in `FriendContext.jsx` if needed
5. Create background theme in `src/features/background/themes.js`

### Adding UI Components

1. Place in `src/components/` for shared components
2. Use CSS variables for colors (support dark mode)
3. Add translations to `src/data/locales.js`
4. Follow existing animation patterns with Framer Motion

### Modifying ChatEngine

- ChatEngine is a singleton, initialized once in app lifecycle
- Always call `save()` after mutations to persist and notify
- Add new business logic methods to ChatEngine, not UI components
- Keep ChatEngine pure JS (no JSX, no React hooks)

### Working with Moments

- Moments service: `src/features/moments/services/momentsService.js`
- AI auto-posting: Personas post based on location and personality
- Smart interactions: AI likes/comments on user posts
- Privacy settings: Public, Friends-only, Private

## Common Gotchas

1. **TailwindCSS 4**: No `tailwind.config.js` file—all config is in CSS via `@theme`
2. **Personas are immutable**: Loaded once at app init, don't modify at runtime
3. **ChatEngine persistence**: Call `.save()` manually after mutations
4. **Presence timing**: Schedule uses 24-hour format (0-23)
5. **IndexedDB**: Chat/docs/media primary store; use `ChatStorageService`, not direct localStorage for chat data
6. **LocalStorage limits**: ~5-10MB per domain; keep only light settings there
7. **API compatibility**: Ensure OpenAI format (messages array, role/content structure)
8. **Test crypto mock**: `crypto.randomUUID()` returns `'uuid-fixed'` in tests — don't rely on real UUIDs in assertions
9. **MSW in tests**: API calls are mocked via MSW in `src/test/msw/` — add handlers there for new endpoints

## Debugging Guide

### Console Logging Prefixes

All major systems log with prefixes: `[ChatEngine]`, `[AIPipeline]`, `[APIClient]`, `[ToolService]`, `[StorageService]`.

### Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **AI not responding** | Messages sent but no AI reply | Check `.env` has valid `VITE_AI_API_KEY`; check Network tab for API errors |
| **Slow responses** | Long delay before AI replies | Reduce `responseDelay`/`readDelay` in persona config; use faster model |
| **Tool calls failing** | Tools not executing | Check `toolsEnabled: true` in agent; verify `toolService.js` implementation |
| **UI not updating** | Changes not reflected | Verify `ChatProvider` wraps components; check subscription cleanup |
| **LocalStorage full** | Quota exceeded error | Clear old chats; implement data pruning |
| **Translation missing** | Shows key instead of text | Add key to both `en` and `zh` in `locales.js` |

### Browser DevTools

- **Application → IndexedDB**: Check `chat-buddy-db` for chats, documents, images
- **Application → LocalStorage**: Check `chat-buddy-user`, `chat-buddy-friend-data`, `chat-buddy-social`, `chat-buddy-language`
- **Network tab**: Monitor API calls, look for 401 (auth error), 429 (rate limit)
- **Console**: Look for prefixed log messages and errors

## Key Files Reference

### Critical (do not break)

| File | Purpose |
|------|---------|
| `src/core/chat/ChatEngine.js` | State machine, persistence, orchestration |
| `src/core/chat/AIPipeline.js` | AI reasoning, tool calling, ReAct loop |
| `src/features/chat/hooks/useChatService.js` | Bridge: Domain → React |

### Important (modify carefully)

| File | Purpose |
|------|---------|
| `src/features/chat/context/ChatContext.jsx` | State provider / facade |
| `src/features/chat/services/chatService.js` | AI calling, context compression |
| `src/features/chat/services/toolService.js` | Tool execution |
| `src/services/api/APIClient.js` | HTTP client with retry/timeout |
| `src/services/storage/StorageService.js` | localStorage abstraction |
| `src/services/storage/ChatStorageService.js` | IndexedDB chat persistence |
| `src/test/setupTests.js` | Vitest setup (MSW, crypto mock, cleanup) |
| `src/test/msw/server.js` | MSW server for API mocking in tests |

### Configuration (safe to modify)

| File | Purpose |
|------|---------|
| `src/data/personas.js` | AI character definitions (`INITIAL_PERSONAS`) |
| `src/data/taskAgents.js` | Task agent definitions (`TASK_AGENTS`) |
| `src/data/locales.js` | Translations (`translations.en`, `translations.zh`) |
| `vite.config.js` | Build configuration |
| `eslint.config.js` | Linting rules |

## Testing

### Unit Tests (Vitest + jsdom)

- **Config**: `vitest.config.js` — jsdom environment, `src/test/setupTests.js` setup file
- **Test files**: `src/**/*.spec.{js,jsx}` (16+ spec files)
- **Setup**: MSW server for API mocking, crypto.randomUUID mocked to `'uuid-fixed'`, auto-cleanup after each test
- **Coverage thresholds** (enforced): 85% branches, 90% functions, 90% lines, 90% statements
- **Coverage targets**: `ChatEngine.js`, `AIPipeline.js`, `chatService.js`, `MessageTimeline.jsx`

```bash
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report (text + HTML)
```

### E2E Tests (Playwright)

- **Config**: `playwright.config.js` — 4 browser projects (chromium, firefox, safari, mobile-chrome)
- **Location**: `e2e/app.spec.js`
- **Screenshots**: Captured in `e2e/screenshots/`
- Run manually with dev server already running on `:5173`, or via CI (`npm run preview` on `:4173`)

```bash
# With dev server running on :5173
npx playwright test
```

### Manual Testing

1. Start dev server: `npm run dev`
2. Test in browser (Chrome/Firefox/Safari)
3. Check console for errors
4. Verify localStorage + IndexedDB persistence (DevTools → Application → Storage)
5. Test bilingual switching
6. Verify AI responses in chat

## Deployment

Build command: `npm run build`
- Output: `dist/` directory
- Static SPA, deploy to any static host (Vercel, Netlify, GitHub Pages)
- Remember to set environment variables on hosting platform
