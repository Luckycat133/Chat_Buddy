# Chat Buddy Development Roadmap

> This document defines the 15-theme development plan for Chat Buddy.
> Each theme maps to a specific version. Themes are ordered from foundation to advanced capabilities.

---

## Architecture Overview

```
v0.3.x  Basic Agent        ┌─────────────────────────────────────────┐
                            │ T12 Memory │ T13 Agent │ T14 RAG │ T15 │
                            ├─────────────────────────────────────────┤
v0.2.x  Basic Role-Play    │ T04 │ T05 │ T06 │ T07 │ T08 │ T09 │T10│T11│
                            ├─────────────────────────────────────────┤
v0.1.x  Foundation          │    T01 i18n  │  T02 API  │  T03 UI    │
                            └─────────────────────────────────────────┘
```

## Design Principles

- **UI Language**: iOS 26 Liquid Glass + ChatGPT Fluid Minimalism
- **Social Features**: Passively discoverable — no forced pop-ups, no badge bombing
- **AI Memory**: Characters own independent memory; exchange is emergent, not scripted
- **API**: Any OpenAI-format SDK should plug in and work
- **UI Redesign**: Phased approach — design tokens first, then component-by-component migration

---

## Theme Index

| #   | Theme                                  | Version | Priority | Status                             |
| --- | -------------------------------------- | ------- | -------- | ---------------------------------- |
| T01 | Internationalization & Localization    | v0.1.1  | P0       | ✅ Done                            |
| T02 | Core Architecture & API Compatibility  | v0.1.2  | P0       | ✅ Done                            |
| T03 | Modern UI Design System                | v0.1.3  | P0       | ✅ Done                            |
| T04 | Character Visuals & Interaction Design | v0.2.0  | P1       | ✅ Done                            |
| T05 | AI Behavior Humanization               | v0.2.1  | P1       | ✅ Done                            |
| T06 | AI Characters & Avatar System          | v0.2.2  | P1       | ✅ Done                            |
| T07 | Message Feature Enhancement            | v0.2.3  | P1       | ✅ Done                            |
| T08 | Markdown & Content Rendering           | v0.2.4  | P1       | ✅ Done                            |
| T09 | Immersive Background System            | v0.2.5  | P1       | Needs completion                   |
| T10 | Social & Interaction Features          | v0.2.6  | P1       | ✅ Done                            |
| T11 | Moments & Feed System                  | v0.2.7  | P1       | ✅ Done                            |
| T12 | AI Memory & Cognitive System           | v0.3.0  | P2       | Mostly new development             |
| T13 | AI Agent & Tool System                 | v0.3.1  | P2       | Needs de-mocking                   |
| T14 | Knowledge Base & RAG System            | v0.3.2  | P2       | Needs search upgrade               |
| T15 | Professional Agent Capabilities        | v0.3.3  | P2       | Needs deepening                    |

---

## T01 — Internationalization & Localization

**Version**: v0.1.1 | **Priority**: P0 Foundation | **Status**: ✅ Done

### What's Done

- [x] English/Chinese bilingual support with seamless switching
- [x] `LanguageContext.jsx` with `useLanguage()` hook
- [x] `locales.js` with 500+ translation keys
- [x] Settings page language toggle
- [x] Chat list search
- [x] Localization consistency fixes
- [x] Browser language auto-detection (`navigator.language`)
- [x] Translation key completeness audit — 120+ keys added, 15 components refactored
- [x] AI conversation language setting independent from UI language
- [x] Parameter interpolation support: `t('key', { param: value })`

### Future Improvements

- [ ] Architecture for adding new languages (modular locale file structure)
- [ ] RTL layout considerations for future Arabic/Hebrew support
- [ ] Remaining ~50 `language === 'zh'` patterns in lower-priority files

### Key Files

- `src/context/LanguageContext.jsx` — Language provider & hook
- `src/data/locales.js` — All translation strings

### Dependencies

- None (foundation layer)

---

## T02 — Core Architecture & API Compatibility

**Version**: v0.1.2 | **Priority**: P0 Foundation | **Status**: ✅ Done

### What's Done

- [x] DeepSeek API integration
- [x] `APIClient.js` with retry/timeout
- [x] `aiClient.js` singleton (Perplexity/DeepSeek/OpenAI-compatible)
- [x] `StorageService.js` with namespace
- [x] localStorage persistence
- [x] Unified config system (`apiConfig.js`) — priority: localStorage > .env > defaults
- [x] Multi-provider profiles (save/switch/delete named API configs)
- [x] Data export/import (JSON backup with `_meta` validation)
- [x] Config validation (test API connectivity with latency display)
- [x] `ApiConfigPanel.jsx` — full settings UI (lazy-loaded)
- [x] `momentsService.js` unified to use shared `callAI()`

### Future Improvements

- [ ] Full OpenAI Chat Completions format:
  - `tools` / `tool_choice` support
  - Streaming (`stream: true`) with SSE parsing
- [ ] IndexedDB migration for large data (chat history, documents)

### Key Files

- `src/services/api/aiClient.js` — API client singleton
- `src/services/api/APIClient.js` — Base HTTP client
- `src/services/storage/StorageService.js` — Storage abstraction
- `.env` / `config.yaml` — Configuration (to be created)

### Architecture Decision

```
src/config/
├── default.config.js     # Default configuration values
├── configLoader.js       # Load from .env / config.yaml / localStorage
└── configValidator.js    # Validate API connectivity
```

### Dependencies

- None (foundation layer)

---

## T03 — Modern UI Design System

**Version**: v0.1.3 | **Priority**: P0 Foundation | **Status**: 🔧 Phase 1-3 done, Phase 4 partially done

### Design Direction

- **iOS 26 Liquid Glass**: Multi-layer blur, refraction effects, dynamic transparency, depth
- **ChatGPT Fluid Minimalism**: Conversation-centered layout, clean whitespace, subtle animations
- **Phased Rollout**: Design tokens → base components → page-by-page migration

### What's Done

- [x] Dark mode + OLED pure black
- [x] Glass utility classes (4 levels)
- [x] WCAG AA contrast compliance
- [x] Bento Grid dashboard
- [x] Responsive sidebar + bottom bar layout
- [x] Design tokens (shadows, colors)

### Phase 1 — Design Tokens & Foundation ✅

- [x] Comprehensive design token system:
  - Typography scale (`--font-size-xs` → `--font-size-4xl`, line-height, weight, letter-spacing)
  - Spacing scale (`--space-0` → `--space-24`, 4px grid)
  - Animation tokens (`--duration-instant/fast/normal/slow/slower`, `--ease-spring/smooth/bounce`)
  - Z-index scale (`--z-base/dropdown/sticky/overlay/modal/toast/tooltip/max`)
  - Semantic surface colors (`--color-surface/elevated/sunken`, `--color-info`, `--color-on-primary`)
  - Blur level tokens (`--blur-none/light/medium/heavy/crystal/ultra`)
- [x] CSS custom property system supporting light/dark/OLED
- [x] Auto `prefers-color-scheme` detection with system/light/dark cycle
- [x] Theme transition animation (CSS class fallback + View Transitions API)
- [x] `prefers-reduced-motion` disables theme transitions

### Phase 2 — Token Migration ✅

- [x] Glass utilities migrated to blur tokens
- [x] All animation utilities use duration/easing tokens
- [x] Component styles (btn, input, card) use spacing/typography tokens
- [x] Character glow and message bubble transitions tokenized

### Phase 3 — CSS Component Library ✅

- [x] Button system: `.btn` base + `primary/secondary/ghost/danger` + `sm/lg/icon`
- [x] Input system: `.input-modern` + `.input-compact` + `.input-glass`
- [x] Card system: `.card` (hover) + `.card-static` + `.card-glass`
- [x] Modal/Sheet: `.modal-overlay/panel` + `.sheet-overlay/panel/handle`
- [x] Layout helpers: `.modal-header/body/footer`
- [x] Dark mode refinements for all new component classes

### Phase 4 — Page Migration & Polish ✅

- [x] Migrate existing inline button styles to component classes (ChatHeader, ChatComposer)
- [ ] Chat view redesign (clean message list, minimal chrome)
- [ ] Settings page redesign (grouped sections, modern toggles)
- [x] Dashboard redesign (refined Bento Grid, **draggable widgets**)
- [x] Custom accent color picker (8 preset palettes + custom)
- [x] Keyboard shortcuts (**desktop shortcuts** with `Ctrl+1/2/3/4/5`, `Ctrl+K`, `Ctrl+/`)
- [x] Onboarding tutorial (**5-step spotlight tour** for first-time users)
- [x] Accessibility foundations (`useFocusTrap`, keyboard navigation, ARIA attributes)
- [ ] Full accessibility audit (screen reader testing, comprehensive ARIA)

### Key Files

- `src/index.css` — Global styles, CSS variables, utilities
- `src/context/ThemeContext.jsx` — Theme state management (accent color support)
- `src/components/Layout.jsx` — Main layout wrapper (keyboard shortcuts, onboarding)
- `src/components/BentoGrid.jsx` — Dashboard grid system
- `src/components/AccentColorPicker.jsx` — Theme color selector
- `src/components/KeyboardShortcutsModal.jsx` — Shortcuts help dialog
- `src/components/OnboardingTutorial.jsx` — First-time user tour
- `src/hooks/useKeyboardShortcuts.js` — Global keyboard shortcut handler
- `src/hooks/useOnboarding.js` — Onboarding state management
- `src/hooks/useFocusTrap.js` — Accessibility focus management
- `src/config/shortcuts.js` — Shortcut definitions
- `src/pages/Dashboard.jsx` — Homepage with draggable widgets

### Dependencies

- T01 (translations for new UI elements)
- `@dnd-kit/core`, `@dnd-kit/sortable` — Drag and drop for dashboard widgets

---

## T04 — Character Visuals & Interaction Design

**Version**: v0.2.0 | **Priority**: P1 | **Status**: ✅ Done

### Design References

- Character.AI: Character card design, personality indicators
- ChatGPT: Clean message layout, subtle animations
- Grok: Playful interaction effects

### What's Done

- [x] 8 character color palettes
- [x] CharacterTheme.jsx dynamic management
- [x] CSS variables per character
- [x] Message animations (bubbleIn, typingWave, avatar pulse, hover lift)
- [x] Character glow effects
- [x] iOS 26 style refinement
- [x] prefers-reduced-motion support
- [x] Character theme extends to full chat UI:
  - Header bar gradient tint + avatar ring color
  - Input box focus ring + quote accent line
  - Send button & record button use character gradient
  - CSS vars cascade from ChatWindow container
- [x] Animation intensity setting (none / subtle / standard / intense) with Settings UI
- [x] Message bubble style options (rounded / square / tail / minimal) with Settings UI
- [x] Character intro animation (`characterIntro` + `introGlow` keyframes)

### Future Improvements

- [ ] Custom character color override per user preference
- [ ] Character-themed scrollbar colors (limited browser support)

### Key Files

- `src/features/chat/components/CharacterTheme.jsx` — Theme definitions + style export
- `src/features/chat/ChatWindow.jsx` — Applies character CSS vars to container
- `src/features/chat/components/window/ChatHeader.jsx` — Character-themed header
- `src/features/chat/components/window/ChatComposer.jsx` — Character-themed input
- `src/features/chat/components/window/MessageTimeline.jsx` — Bubble style support
- `src/context/ThemeContext.jsx` — animationIntensity & bubbleStyle state
- `src/index.css` — Animation intensity levels, bubble style variants, intro animations

### Dependencies

- T03 (design token system)

---

## T05 — AI Behavior Humanization

**Version**: v0.2.1 | **Priority**: P1 | **Status**: ✅ Done

### What's Done

- [x] Personality-based response delays
- [x] "Message seen" simulation
- [x] Typing indicators
- [x] Proactive messaging (`[SCHEDULE:X]`)
- [x] Multi-message support
- [x] Auto chat naming
- [x] Time display (WeChat-style)
- [x] Tool marker cleanup
- [x] **Online/Offline/Busy status simulation**
  - Each character has a daily schedule pattern
  - Status affects response speed (offline = much longer delay)
  - Visual indicator in chat list (green dot / gray dot / crescent moon)
- [x] **Time-based proactive messages**
  - Good morning/evening greetings based on user's timezone
  - "Haven't talked in a while" reconnection messages
  - Window-open greeting detection

### Future Improvements

- [ ] **AI "editing" state**
  - Show "editing..." for 1-2s before long responses
  - Visual difference from "typing..." (e.g., pencil icon vs dots)
- [ ] **Message recall simulation**
  - Rare event (~5% chance): AI "unsends" a message, then sends a revised version
  - Shows "X recalled a message" notification
  - Adds organic feel to conversations

### Key Files

- `src/core/chat/AIPipeline.js` — Timing simulation logic
- `src/core/chat/ChatEngine.js` — Message lifecycle
- `src/data/personas.js` — Per-character timing configs

### Dependencies

- T04 (visual indicators for status)

---

## T06 — AI Characters & Avatar System

**Version**: v0.2.2 | **Priority**: P1 | **Status**: ✅ Done

### What's Done

- [x] 13 characters (5 original + 8 anime)
- [x] Selfie-style avatars
- [x] Character + user avatar collections
- [x] Avatar selector UI with categories
- [x] **Affinity/Fondness System**
  - Intimacy score (0-100) per character, starts at 0
  - Chat-based gain: +1 per message with 5-minute cooldown per persona
  - Gift-based gain: variable boost (5-100 points) from gift system
  - 5 intimacy levels with distinct AI behavior:
    - Acquaintance (0-19): Brief, polite, formal tone
    - Friend (20-39): Friendly, conversational
    - Good Friend (40-59): Warm, personal anecdotes, casual language
    - Close Friend (60-79): Intimate, nicknames, deeper thoughts
    - Soulmate (80-100): Very intimate, affectionate, long detailed responses
  - Visual indicator: Colored progress bar (0-100) in Friend Detail panel
  - Affinity level badge displayed in Chat Header
- [x] **Character Mood System**
  - 5 moods: Happy (😊), Calm (😌), Tired (😴), Excited (🤩), Melancholy (😔)
  - Mood computation: time-based (morning/afternoon/evening/night) + presence-based + personality-weighted
  - Deterministic per persona+hour for stability
  - Affects AI response style via mood-specific prompt hints
  - Displayed in Chat Header as mood emoji next to character name
  - Bilingual mood labels (EN/ZH)

### Future Improvements

- [ ] **Custom User Avatar**
  - Upload from device
  - Crop/resize tool (circular crop)
  - Stored as compressed base64 or object URL
- [ ] **Custom Character Creator** (planned, not for v0.2.2)
  - User defines: name, personality traits, interests, speaking style
  - Select base avatar or upload custom
  - Generate system prompt from traits

### Key Files

- `src/data/personas.js` — Character definitions
- `src/data/taskAgents.js` — Agent definitions
- `src/components/AvatarSelector.jsx` — Avatar picker

### Dependencies

- T05 (affinity affects behavior timing)
- T04 (mood visual indicators)

---

## T07 — Message Feature Enhancement

**Version**: v0.2.3 | **Priority**: P1 | **Status**: ✅ Done

### What's Done

- [x] Emoji picker (8 categories + recent)
- [x] Sticker picker
- [x] Message context menu (copy, quote, delete)
- [x] Message quoting/reply
- [x] Message forwarding
- [x] Message search panel
- [x] File upload (text files)
- [x] Group announcements
- [x] Group polls
- [x] **Voice messages** — record via MediaRecorder API, play with waveform visualization (`VoicePlayer.jsx`)
- [x] **Image messages** — inline display with click-to-expand lightbox (`ImageMessage.jsx`)
- [x] **Message bookmarks** — star/save important messages, view saved list (`BookmarkService.js`, `BookmarkPanel.jsx`)
- [x] **Message pinning** — pin messages to top of chat (already existed)
- [x] **Read receipts** — show who has "read" with double checkmark indicator
- [x] **@mention** — `@CharacterName` highlighted in message bubbles with clickable mentions
- [x] **Draft auto-save** — save unfinished messages per chat with 7-day expiry (`useDraft.js`)
- [x] **Chat history export** — export as TXT/JSON/HTML with styled HTML output (`ExportService.js`, `ExportModal.jsx`)
- [x] **Enhanced polls** — anonymous voting, multi-choice, timer support in `votePoll()`

### Implementation Details

**New Files:**
- `src/features/chat/services/BookmarkService.js` — Bookmark CRUD operations
- `src/features/chat/components/BookmarkPanel.jsx` — Bookmark list slide-in panel
- `src/features/chat/hooks/useDraft.js` — Draft auto-save hook with 500ms debounce
- `src/features/chat/components/ImageMessage.jsx` — Image bubble with lightbox
- `src/features/chat/services/ExportService.js` — TXT/JSON/HTML export logic
- `src/features/chat/components/ExportModal.jsx` — Export format selection UI
- `src/features/chat/components/VoicePlayer.jsx` — Voice message with waveform visualization

**Modified Files:**
- `src/core/chat/ChatEngine.js` — Added `bookmarkMessage`, `unbookmarkMessage`, `markMessagesAsRead`
- `src/features/chat/hooks/useChatService.js` — Exposed bookmark and read receipt methods
- `src/features/chat/components/MessageMenu.jsx` — Added bookmark/unbookmark menu item
- `src/features/chat/ChatWindow.jsx` — Integrated bookmark panel, export modal, read receipts
- `src/features/chat/components/window/ChatComposer.jsx` — Draft auto-save, image upload
- `src/features/chat/components/window/MessageTimeline.jsx` — Image, voice, mention rendering, read status
- `src/data/locales.js` — Added translations for all T07 features
- `eslint.config.js` — Added e2e and test files to ignore patterns

### Key Files

- `src/features/chat/ChatWindow.jsx`
- `src/features/chat/components/window/ChatComposer.jsx`
- `src/features/chat/components/window/MessageTimeline.jsx`

### Dependencies

- T01 (translations for new features)
- T04 (visual design for new message types)

---

## T08 — Markdown & Content Rendering

**Version**: v0.2.4 | **Priority**: P1 | **Status**: ✅ Done

### What's Done

- [x] react-markdown + remark-gfm
- [x] react-syntax-highlighter with theme switching (`vs` / `vscDarkPlus`)
- [x] @tailwindcss/typography
- [x] Tables, code blocks, headings, lists
- [x] cleanMessageContent() regex fixes
- [x] Bubble overflow fixes
- [x] **Code block copy button** — hover-to-reveal with "Copied!" toast feedback
- [x] **Code theme switching** — auto light/dark matching system theme
- [x] **LaTeX rendering** — `rehype-katex` for inline (`$...$`) and block (`$$...$$`) math
- [x] **Mermaid diagrams** — `MermaidRenderer.jsx` for flowcharts, sequence, class, state, ER diagrams
- [x] **Link preview cards** — hover preview with favicon and domain (MVP)

### Key Files

- `src/features/chat/components/window/MessageTimeline.jsx` — Message rendering
- `src/features/chat/components/MermaidRenderer.jsx` — Mermaid diagram component
- `src/features/chat/components/LinkPreview.jsx` — Link preview card

### Dependencies

- T03 (theme-aware code highlighting)
- `rehype-katex`, `katex`, `mermaid`

---

## T09 — Immersive Background System

**Version**: v0.2.5 | **Priority**: P1 | **Status**: Needs completion

### What's Done

- [x] BackgroundContext (global + per-chat)
- [x] BackgroundLayer (parallax + transitions)
- [x] BackgroundSettingsModal (presets + upload)
- [x] 20+ AI-generated character backgrounds
- [x] 3 global theme presets
- [x] Per-chat customization + fallback chain

### What's Planned

- [ ] **Dynamic backgrounds** — animated CSS (particles, rain, snow, aurora)
- [ ] **Blur & transparency sliders** — user adjusts overlay opacity
- [ ] **Video backgrounds** — looping MP4/WebM clips
- [ ] **Time-based switching** — day/night variants per background
- [ ] **Image compression** — resize uploaded images, use IndexedDB instead of base64 in localStorage
- [ ] **Background sharing** — export/import background config as JSON

### Key Files

- `src/features/background/BackgroundContext.jsx`
- `src/features/background/BackgroundLayer.jsx`
- `src/features/background/themes.js`

### Dependencies

- T03 (UI integration with glass effects)
- T02 (IndexedDB for image storage)

---

## T10 — Social & Interaction Features

**Version**: v0.2.6 | **Priority**: P1 | **Status**: Needs completion

### Design Principle

> **Passively discoverable, never intrusive.**
>
> - Social features live in sidebar/tabs, never auto-popup
> - Points/achievements are rewards for natural usage, not gamification traps
> - Mini-games and gifts are optional fun, not engagement hacking
> - No red-dot badge bombing on unvisited features

### What's Done

- [x] User profile (avatar, nickname, signature)
- [x] Friends management (groups, starring, remarks)
- [x] Friend detail panel
- [x] Daily check-in (streak)
- [x] Achievement system (points)
- [x] Red packet (virtual points)
- [x] Gift system
- [x] Rock-Paper-Scissors game

### What's Done (Phase 2)

- [x] **More mini-games** — Number Guess (1-100, 7 attempts, 30 pts win); GameSelectorPanel for multi-game access
- [x] **Points economy** — RPS awards 10 pts/round win; NumberGuess awards 30 pts; daily tasks award points
- [x] **Daily task system** — 6 tasks: check-in, messages, game, sticker, gift, chat-3; DailyTaskPanel modal
- [x] **Fix ChatComposer integration** — gift/game/poll/red-packet props now properly connected to ChatWindow

### What's Planned (Phase 3)

- [ ] **Idiom chain** (成语接龙, CN mode only)
- [ ] **AI trivia quiz** (AI generates questions from chat context)
- [ ] **Friend interaction log** — timeline of interaction milestones
- [ ] **Leaderboards** — opt-in rankings (points, streaks, achievements)
- [ ] **Character events** — birthday events, holiday specials (characters post unique content)

### Key Files

- `src/components/CheckInPanel.jsx`
- `src/pages/AchievementsPage.jsx`
- `src/context/SocialContext.jsx`
- `src/context/FriendContext.jsx`

### Dependencies

- T06 (character events linked to affinity)
- T11 (event posts in Moments)

---

## T11 — Moments & Feed System

**Version**: v0.2.7 | **Priority**: P1 | **Status**: ✅ Done

### What's Done

- [x] Posts (text + images + likes + comments)
- [x] AI auto-posting (personality-based)
- [x] AI commenting + AI-to-AI interaction
- [x] Emoji reactions (6 types)
- [x] Comment reply threads
- [x] Location tags (including anime worlds)
- [x] Visibility settings
- [x] AI content search
- [x] Image API placeholder
- [x] **Draft box** — auto-save, restore on reopen, discard option
- [x] **Hashtag topics** — `#topic` clickable tags, feed filtering with dismiss pill
- [x] **Pagination/load-more** — 10 posts per page, load-more button
- [x] **Story events** — birthday posts for all 13 personas, seasonal holiday specials (New Year, Valentine's, Halloween, Christmas)
- [x] **Repost/share** — forward moment to any chat as formatted message

### Skipped

- [ ] **AI image generation** — depends on external image generation API (deferred)

### Key Files

- `src/features/moments/MomentsPage.jsx`
- `src/features/moments/context/MomentsContext.jsx`
- `src/features/moments/components/MomentCard.jsx`
- `src/features/moments/components/PostComposer.jsx`

### Dependencies

- T10 (social infrastructure)
- T06 (character personality for AI posting)

---

## T12 — AI Memory & Cognitive System

**Version**: v0.3.0 | **Priority**: P2 | **Status**: Mostly new development

### Vision

> Characters should feel like they truly _know_ you and each other.
> Memory is not a database lookup — it's emergent, imperfect, and personal.

### What's Done

- [x] Context compression (long conversation summarization)
- [x] Token usage optimization

### Architecture Design

```
Memory Architecture:
┌─────────────────────────────────────────────┐
│              Memory Layer                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Luna's   │  │ Max's    │  │ Rem's    │  │
│  │ Memory   │  │ Memory   │  │ Memory   │  │
│  │ Store    │  │ Store    │  │ Store    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │        │
│  ┌────┴──────────────┴──────────────┴────┐  │
│  │        Memory Exchange Bus            │  │
│  │  (Request → Decide → Share/Refuse)    │  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│              Context Layer                   │
│  ┌──────────────┐  ┌──────────────────┐     │
│  │ Group Chat   │  │ Private Chat     │     │
│  │ Context      │→ │ Context (can     │     │
│  │ (shared)     │  │ access group)    │     │
│  └──────────────┘  └──────────────────┘     │
├─────────────────────────────────────────────┤
│              Compression Layer               │
│  ┌──────────────────────────────────────┐   │
│  │  Summarize → Extract Key Facts →     │   │
│  │  Store to Long-term Memory           │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### What's Planned

- [ ] **Long-term memory storage**
  - Per-character key-value memory (facts, preferences, events)
  - Stored in IndexedDB (namespaced per character)
  - Injected into system prompt as "What you remember about this user"
- [ ] **Independent character memory**
  - Each character only remembers what they've been told
  - No omniscient knowledge sharing by default
- [ ] **Group chat context sharing**
  - Group chat messages become context for all participants
  - Characters can reference group conversations in private chats
  - "I saw you mention X in the group chat..."
- [ ] **Memory exchange tool**
  - Characters can invoke: `[MEMORY_REQUEST: target=Luna, topic="user's birthday"]`
  - Target character's AI decides response:
    - Share truthfully
    - Refuse ("That's between me and the user")
    - Lie or deflect (emergent behavior)
  - The requesting character incorporates the response into their context
- [ ] **Forgetting mechanism**
  - Old, unimportant memories fade (decay function)
  - Important memories (high emotional weight) persist
  - Memory capacity limits per character
- [ ] **Memory UI** — view what each character remembers (Settings > Character > Memory)

### Key Files (to be created)

- `src/core/memory/MemoryStore.js` — Per-character memory CRUD
- `src/core/memory/MemoryExchange.js` — Inter-character memory sharing
- `src/core/memory/ContextCompressor.js` — Extracted from existing compression logic

### Dependencies

- T02 (IndexedDB storage)
- T06 (affinity affects memory sharing willingness)
- T05 (memory influences proactive messaging topics)

---

## T13 — AI Agent & Tool System

**Version**: v0.3.1 | **Priority**: P2 | **Status**: Needs de-mocking

### What's Done

- [x] 6 task agents (Coder, Muse, Scholar, Sensei, Aurora, Pixel)
- [x] Agent Skills system (17+ skills)
- [x] ReAct tool calling architecture
- [x] toolService (mostly mock)
- [x] Agent Workspace
- [x] Contact list filtering

### What's Planned

- [ ] **Real code sandbox** — WebAssembly or sandboxed iframe for JS/Python execution
- [ ] **Agent collaboration** — one agent delegates subtasks to another
- [ ] **Custom agents** — user defines agent via skill combination + system prompt
- [ ] **Tool result visualization** — code output panels, search result cards
- [ ] **Agent task history** — browse and reuse previous agent conversations

### Key Files

- `src/features/chat/services/toolService.js`
- `src/core/chat/AIPipeline.js`
- `src/data/taskAgents.js`
- `src/data/agentSkills.js`
- `src/pages/AgentWorkspace.jsx`

### Dependencies

- T12 (agents need memory for continuity)
- T02 (API config for different model routing)

---

## T14 — Knowledge Base & RAG System

**Version**: v0.3.2 | **Priority**: P2 | **Status**: Needs search upgrade

### What's Done

- [x] TF-IDF document indexing
- [x] Text chunking
- [x] Client-side similarity search
- [x] DocumentContext
- [x] AI file generation ([FILE:name:content])

### What's Planned

- [ ] **Vector embedding search** — integrate local embedding model API
- [ ] **Knowledge base management UI** — list, delete, edit uploaded documents
- [ ] **Incremental document updates** — add/remove chunks without full re-index
- [ ] **Hybrid search** — combine keyword + vector for better recall

### Key Files

- `src/utils/ragUtils.js`
- `src/context/DocumentContext.jsx`
- `src/utils/fileGeneration.js`

### Dependencies

- T02 (API for embedding models)
- T13 (agents use RAG as a tool)

---

## T15 — Professional Agent Capabilities

**Version**: v0.3.3 | **Priority**: P2 | **Status**: Needs deepening

### What's Done

- [x] Muse: Two-step translation, domain detection, format preservation
- [x] Sensei: Socratic teaching, knowledge graph, math engine, progress tracking
- [x] RouteLLM: Smart model routing
- [x] Scholar: Perplexity Sonar, citations, deep research, fact-checking

### What's Planned

- [ ] **Translation comparison view** — source/target side-by-side
- [ ] **Knowledge graph expansion** — user adds custom concept nodes
- [ ] **Learning report export** — PDF/chart visualization of progress
- [ ] **Search result cards** — visual cards for Scholar citations
- [ ] **Multi-model panel** — manual model switching + token cost dashboard
- [ ] **Coder diff view** — visual code diff for Coder agent suggestions

### Key Files

- `src/data/taskAgents.js` — Agent system prompts
- `src/services/ai/translationService.js`
- `src/data/knowledgeGraph.js`
- `src/services/perplexityService.js`

### Dependencies

- T13 (agent infrastructure)
- T14 (RAG for knowledge-augmented agents)

---

## Development Sequence

```
Phase 1 (Foundation)
  T01 → T02 → T03 (phased)

Phase 2 (Core Role-Play)
  T04 → T05 → T06 → T07 → T08

Phase 3 (Atmosphere & Social)
  T09 → T10 → T11

Phase 4 (Intelligence)
  T12 → T13 → T14 → T15
```

> Within each phase, themes can overlap.
> T03 UI redesign runs continuously across all phases.
