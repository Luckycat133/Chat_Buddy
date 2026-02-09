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

| # | Theme | Version | Priority | Status |
|---|-------|---------|----------|--------|
| T01 | Internationalization & Localization | v0.1.1 | P0 | ✅ Done |
| T02 | Core Architecture & API Compatibility | v0.1.2 | P0 | ✅ Done |
| T03 | Modern UI Design System | v0.1.3 | P0 | 🔧 Phase 1-3 done, Phase 4 pending |
| T04 | Character Visuals & Interaction Design | v0.2.0 | P1 | ✅ Done |
| T05 | AI Behavior Humanization | v0.2.1 | P1 | Needs new features |
| T06 | AI Characters & Avatar System | v0.2.2 | P1 | Needs affinity/status |
| T07 | Message Feature Enhancement | v0.2.3 | P1 | Needs completion |
| T08 | Markdown & Content Rendering | v0.2.4 | P1 | Needs completion |
| T09 | Immersive Background System | v0.2.5 | P1 | Needs completion |
| T10 | Social & Interaction Features | v0.2.6 | P1 | Needs completion |
| T11 | Moments & Feed System | v0.2.7 | P1 | Needs completion |
| T12 | AI Memory & Cognitive System | v0.3.0 | P2 | Mostly new development |
| T13 | AI Agent & Tool System | v0.3.1 | P2 | Needs de-mocking |
| T14 | Knowledge Base & RAG System | v0.3.2 | P2 | Needs search upgrade |
| T15 | Professional Agent Capabilities | v0.3.3 | P2 | Needs deepening |

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

**Version**: v0.1.3 | **Priority**: P0 Foundation | **Status**: 🔧 Phase 1-3 done

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

### Phase 4 — Page Migration & Polish (Pending)
- [ ] Migrate existing inline button styles to component classes
- [ ] Chat view redesign (clean message list, minimal chrome)
- [ ] Settings page redesign (grouped sections, modern toggles)
- [ ] Dashboard redesign (refined Bento Grid, draggable widgets)
- [ ] Custom accent color picker (multiple preset palettes + custom)
- [ ] Keyboard shortcuts (desktop)
- [ ] Onboarding tutorial for first-time users
- [ ] Accessibility audit (screen reader, focus management, ARIA)

### Key Files
- `src/index.css` — Global styles, CSS variables, utilities
- `src/context/ThemeContext.jsx` — Theme state management
- `src/components/Layout.jsx` — Main layout wrapper
- `src/components/BentoGrid.jsx` — Dashboard grid
- `src/pages/Dashboard.jsx` — Homepage
- `src/pages/Settings.jsx` — Settings page

### Dependencies
- T01 (translations for new UI elements)

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

**Version**: v0.2.1 | **Priority**: P1 | **Status**: Needs new features

### What's Done
- [x] Personality-based response delays
- [x] "Message seen" simulation
- [x] Typing indicators
- [x] Proactive messaging (`[SCHEDULE:X]`)
- [x] Multi-message support
- [x] Auto chat naming
- [x] Time display (WeChat-style)
- [x] Tool marker cleanup

### What's Planned
- [ ] **Online/Offline/Busy status simulation**
  - Each character has a daily schedule pattern
  - Status affects response speed (offline = much longer delay)
  - Visual indicator in chat list (green dot / gray dot / crescent moon)
- [ ] **Time-based proactive messages**
  - Good morning/evening greetings based on user's timezone
  - "Haven't talked in a while" reconnection messages
  - Event-triggered messages (holidays, user milestones)
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

**Version**: v0.2.2 | **Priority**: P1 | **Status**: Needs affinity/status

### What's Done
- [x] 13 characters (5 original + 8 anime)
- [x] Selfie-style avatars
- [x] Character + user avatar collections
- [x] Avatar selector UI with categories

### What's Planned
- [ ] **Affinity/Fondness System**
  - Affinity score (0-100) per character, starts at 50
  - Increases: regular chatting, giving gifts, daily interaction
  - Decreases: long absence, rude behavior (AI-judged)
  - Effect on replies:
    - Low (0-30): Formal, distant, shorter responses
    - Medium (30-70): Friendly, normal personality
    - High (70-100): Intimate, uses nicknames, longer messages, shares more
  - Visual indicator: Heart meter in friend detail panel
- [ ] **Character Status/Mood System**
  - 5 moods: Happy, Calm, Tired, Excited, Melancholy
  - Mood changes based on: time of day, conversation topic, interaction frequency
  - Affects: emoji usage, response length, topic willingness
  - Displayed in chat header (subtle mood icon)
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

**Version**: v0.2.3 | **Priority**: P1 | **Status**: Needs completion

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

### What's Planned
- [ ] **Voice messages** — record via MediaRecorder API, play with waveform visualization
- [ ] **Image messages** — placeholder UI (no vision API), display sent images inline
- [ ] **Message bookmarks** — star/save important messages, view saved list
- [ ] **Message pinning** — pin messages to top of chat
- [ ] **Read receipts (group)** — show who has "read" (simulated for AI)
- [ ] **@mention** — `@CharacterName` to direct message at specific character in group
- [ ] **Draft auto-save** — save unfinished messages per chat
- [ ] **Chat history export** — export as TXT/JSON/HTML
- [ ] **Enhanced polls** — anonymous voting, multi-choice, timer

### Key Files
- `src/features/chat/ChatWindow.jsx`
- `src/features/chat/components/window/ChatComposer.jsx`
- `src/features/chat/components/window/MessageTimeline.jsx`

### Dependencies
- T01 (translations for new features)
- T04 (visual design for new message types)

---

## T08 — Markdown & Content Rendering

**Version**: v0.2.4 | **Priority**: P1 | **Status**: Needs completion

### What's Done
- [x] react-markdown + remark-gfm
- [x] react-syntax-highlighter (VS Code Dark)
- [x] @tailwindcss/typography
- [x] Tables, code blocks, headings, lists
- [x] cleanMessageContent() regex fixes
- [x] Bubble overflow fixes

### What's Planned
- [ ] **Code block copy button** — one-click copy with feedback toast
- [ ] **Code theme switching** — auto light/dark matching system theme
- [ ] **LaTeX rendering** — `react-katex` or `rehype-katex` for math formulas
- [ ] **Mermaid diagrams** — flowcharts, sequence diagrams in messages
- [ ] **Link preview cards** — fetch Open Graph data, show title/description/image

### Key Files
- `src/features/chat/components/window/MessageTimeline.jsx` — Message rendering

### Dependencies
- T03 (theme-aware code highlighting)

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

### What's Planned
- [ ] **More mini-games**
  - Number guessing (AI picks, user guesses)
  - Idiom chain (成语接龙, CN mode)
  - AI trivia quiz (AI generates questions from chat context)
- [ ] **Points economy**
  - Spending: unlock themes, avatar frames, chat effects
  - Earning: daily check-in, tasks, games
  - Balance displayed in profile
- [ ] **Friend interaction log** — timeline of interaction milestones
- [ ] **Daily task system** — diverse tasks beyond check-in (e.g., "Chat with 3 characters", "Send a sticker", "Play a game")
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

**Version**: v0.2.7 | **Priority**: P1 | **Status**: Needs completion

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

### What's Planned
- [ ] **Repost/share** — share moments to other chats
- [ ] **Hashtag topics** — `#topic` tags with aggregation page
- [ ] **Story events** — character birthday posts, holiday specials, seasonal content
- [ ] **Draft box** — save unfinished posts
- [ ] **Pagination/lazy loading** — virtual scroll for performance
- [ ] **AI image generation** — generate post images via API (when available)

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
> Characters should feel like they truly *know* you and each other.
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
