# Changelog

All notable changes to Chat Buddy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Version Architecture:**

- `v0.1.x` — Foundation Layer (i18n, API, UI Design System)
- `v0.2.x` — Basic Role-Play (Characters, Chat, Social)
- `v0.3.x` — Basic Agent (Memory, Agents, RAG, Professional Skills)

---

## [Unreleased]

> Planned features not yet assigned to a specific version.

---

## Foundation Layer — v0.1.x

### [0.1.3] — T03 Modern UI Design System

> Design language: iOS 26 Liquid Glass + ChatGPT Fluid Minimalism

#### Added

- **Dark Mode & OLED**
  - Full `.dark` mode CSS variable overrides across all components
  - OLED Pure Black variant (`.dark.oled`, `#000000` backgrounds)
  - Glass utility classes: `.glass`, `.glass-strong`, `.glass-crystal`, `.glass-aurora`
  - WCAG AA text contrast compliance
  - Enhanced shadow depth for visual hierarchy
- **Bento Grid Dashboard** (`/dashboard`)
  - `BentoGrid.jsx` and `BentoCard` components with 7 size presets
  - Skeleton loading states and responsive column adjustment
  - 8 widget types: Recent Chats, Daily Check-in, AI Agents, Moments Preview, Friends, Achievements, Recommended Character, Stats
  - Dynamic greeting based on time of day
  - **Draggable widgets** — T03 Phase 4
    - Drag-and-drop reordering with `@dnd-kit`
    - Persist layout to localStorage
    - Reset layout button
- **Theme Customization** — T03 Phase 4
  - **Accent Color Picker** (`AccentColorPicker.jsx`)
  - 8 preset palettes (coral, lavender, mint, sky, gold, rose, indigo)
  - Custom color picker with native color input
  - Real-time theme updates
- **Keyboard Shortcuts** — T03 Phase 4
  - `useKeyboardShortcuts` hook for global shortcut handling
  - Navigation: `Ctrl+1/2/3/4/5` for Chats/Agents/Friends/Moments/Settings
  - Actions: `Ctrl+K` for search, `Ctrl+/` for help, `Esc` to close
  - `KeyboardShortcutsModal` for shortcut reference
- **Onboarding Tutorial** — T03 Phase 4
  - 5-step spotlight tour for first-time users
  - Highlights: Chats, Agents, Settings, Moments
  - Persistent state with localStorage
  - Reset tutorial option in Settings
- **Accessibility Foundations** — T03 Phase 4
  - `useFocusTrap` hook for modal focus management
  - ARIA attributes on interactive components
  - Keyboard navigation support
- **Layout & Navigation**
  - Responsive sidebar + bottom bar layout
  - About page with version info
  - Help & FAQ page
  - Chat Buddy logo
  - Notification settings (sound, DnD, browser push)

#### Changed

- Component theming refactor: replaced hardcoded `bg-white` in Settings, Layout, ChatWindow, ChatHeader, ChatComposer with CSS variables
- Refined scrollbar, selection, and input styles for dark mode

#### Planned

- Liquid glass design language overhaul (blur layers, refraction, dynamic transparency)
- Conversation-centered minimal layout (reference ChatGPT)
- Auto system `prefers-color-scheme` detection
- Scheduled theme switching (sunrise/sunset)
- Theme switch transition animation
- In-app notification center

---

### [0.1.2] — T02 Core Architecture & API Compatibility

> Any OpenAI-format API should plug in and work.

#### Added

- DeepSeek API integration for AI responses
- `APIClient.js` base HTTP client with retry/timeout
- `aiClient.js` singleton (Perplexity/DeepSeek/OpenAI-compatible)
- `StorageService.js` with `chat-buddy:` namespace
- LocalStorage persistence for chat history and settings

#### Changed

- Multi-provider switching in Settings UI with `ApiConfigPanel.jsx`
- Data export/import (JSON backup with `_meta` validation)

#### Planned

- Full OpenAI Chat Completions format compatibility (messages/tools/streaming)
- IndexedDB support for large data scenarios

---

### [0.1.1] — T01 Internationalization & Localization

> Bilingual foundation for all UI text.

#### Added

- English/Chinese bilingual support with seamless language switching
- `LanguageContext.jsx` with `useLanguage()` hook
- `locales.js` with 500+ translation keys covering all UI
- Enhanced Settings page with WeChat-style UI
- Chat list search functionality
- AI capability settings in group details
- Browser language auto-detection (`navigator.language`)
- AI conversation language setting independent from UI language
- Parameter interpolation support: `t('key', { param: value })`

#### Fixed

- Localization consistency across all UI components
- Language switching for Settings, ChatList, and GroupDetails

#### Planned

- Architecture for additional languages (JP/KR/ES)

---

### [0.1.0] — Project Initialization

> Minimum viable chat application.

#### Added

- Initial release of Chat Buddy
- 5 AI personas with unique personalities (Luna, Max, Bella, Oliver, Sophie)
- One-on-one and group chat functionality
- React 19 + Vite + TailwindCSS 4 tech stack
- Macaroon Orange theme with modern UI

---

## Basic Role-Play — v0.2.x

### [0.2.7] — T11 Moments & Feed System

> AI-driven social feed — the top layer of social experience.

#### Added

- **Moments/Timeline**
  - Posts with text, images, likes, and comments
  - AI auto-posting based on character personality
  - API-powered dynamic AI post generation
- **AI Social Intelligence**
  - Context-aware AI commenting
  - AI-to-AI interactions in Moments
  - AI content search (remembers own Moments, can search group chats)
- **Interaction Features**
  - Emoji reactions (😂❤️👍🔥😮😢)
  - Comment reply threads
  - Reply-to-comment functionality
- **WeChat-style Controls**
  - Location tags (including anime world locations)
  - Visibility settings (public/partial/hidden/private)
- Image generation API placeholder

#### Changed

- Rewrote `MomentsContext.jsx` with AI orchestration capabilities
- Enhanced `MomentCard.jsx` with reactions and location display
- Updated `PostComposer.jsx` with location picker and visibility selector

#### Planned

- Moments repost/share
- Hashtag topics + topic aggregation page
- Special story events (holiday/birthday posts)
- Draft box for Moments
- Pagination / lazy loading optimization
- AI image generation for posts (pending API)

---

### [0.2.6] — T10 Social & Interaction Features

> Social infrastructure — built before Moments, designed with restraint.

#### Added

- **User Profile** (avatar, nickname, signature)
- **Friends Management** (groups, starring, remark names, search)
- **Friend Detail Panel** with quick actions
- **Daily Check-in** with streak tracking
- **Achievement System** with points
- **Red Packet** (virtual points)
- **Gift System**
- **Rock-Paper-Scissors** mini game

#### Design Principle

> All social features are **passively discoverable** (sidebar entries, long-press triggers). No forced pop-ups or badge bombing. Points and tasks are "icing on the cake", not mandatory.

#### Planned

- More mini games (number guessing, idiom chain, AI quiz)
- **Points spending** (unlock themes/avatars/effects)
- Friend interaction log (milestone records)
- **Daily task system** (expand check-in with diverse daily tasks)
- Leaderboards (points/check-in/achievements)
- AI character birthday/holiday events

---

### [0.2.5] — T09 Immersive Background System

> Unique atmosphere for every character and conversation.

#### Added

- **Background Management**
  - `BackgroundContext` for global and per-chat background control with automatic fallback chain: per-chat → character default → global theme
  - `BackgroundLayer` component with smooth animated transitions
  - `BackgroundSettingsModal` with four tabs: Theme Library, Dynamic, Upload, Adjust
  - Migrated storage keys to `StorageService` namespace (`background:global-theme`, `background:chat-backgrounds`)
- **Content Library**
  - 100+ preset backgrounds across 12 categories (Exclusive, Dreamy, Surreal, IP, Characters, Nature, Space, Minimalist, Game, Movie, Novel, Art)
  - 6 animated dynamic presets: Star Particles, Aurora Borealis, Rainy City, Gradient Flow, Pink Aurora, Fireflies
- **Dynamic Backgrounds**
  - `DynamicBackground` component with 4 animation types:
    - `particles` — floating particle field
    - `aurora` — animated gradient aurora
    - `rain` — cascading raindrops
    - `gradient` — flowing mesh gradient
  - CSS keyframes `rainFall` and `gradientFlow` added to `index.css`
- **Parallax Effect**
  - Mouse-tracking parallax on image backgrounds (0–100 intensity slider)
  - Smooth `transform` applied via `mousemove` listener on `window`
- **Video Backgrounds**
  - URL input for MP4/WebM video backgrounds
  - Rendered via `<video autoPlay muted loop playsInline>`
- **Time-Based Auto-Switch**
  - Optional day (6:00–18:00) / night (18:00–6:00) background switching
  - Configurable per background with toggle and separate URL inputs
  - Interval check runs every 60 seconds
- **Image Upload with Compression**
  - Canvas-based compression: scales to max 1920×1080, JPEG quality 85%
  - File size validation: rejects uploads over 10 MB with error feedback
  - Compressing progress indicator during upload
- **IndexedDB Image Storage** (`ImageStorageService`)
  - Custom images stored in `chat-buddy-images` IndexedDB database instead of localStorage
  - Config stores only the image ID (UUID); data layer resolves ID → base64 at render time
  - One-time migration from legacy localStorage base64 blobs on first launch
- **Background Config Export / Import** (`BackgroundShareService`)
  - Export current config as a `.json` file (strips base64 for file size)
  - Import validates `_type: "chat-buddy-background"` magic field before applying
- **Full i18n**
  - All hardcoded strings replaced with `t()` calls
  - 28 new `background.*` translation keys added to `locales.js` (English + Chinese)

---

### [0.2.4] — T08 Markdown & Content Rendering

> Pure rendering layer — how message content is displayed.

#### Added

- **Core Markdown Support**
  - Integrated `react-markdown` + `remark-gfm` for GFM syntax
  - Integrated `react-syntax-highlighter` (VS Code Dark theme)
  - Added `@tailwindcss/typography` plugin for prose styling
  - Support for tables, code blocks, headings, lists, and more
- **Code Block Enhancements**
  - Copy button with hover reveal and "Copied!" toast feedback
  - Theme switching: auto light/dark based on system preference (`vs` / `vscDarkPlus`)
- **LaTeX Math Rendering** — Phase 3
  - Inline math: `$E = mc^2$`
  - Block math: `$$...$$`
  - `rehype-katex` plugin integration
  - Dark mode color overrides
- **Mermaid Diagram Rendering** — Phase 4
  - Flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams
  - `MermaidRenderer.jsx` component with async rendering
  - Auto theme switching (default/dark)
  - Error fallback with source code display
- **Link Preview Cards** — Phase 5
  - Hover to reveal preview card with favicon and domain
  - `LinkPreview.jsx` component using Google's favicon service
  - "Open Link" button for external URLs

#### Fixed

- `cleanMessageContent()` regex: `\s{2,}` → `[^\S\n]{2,}` to preserve line breaks
- Disabled `\s*\|\s*` replacement to preserve table delimiters
- Message bubble overflow: `min-w-0`, `overflow-hidden`, `overflow-x-auto`

#### Technical

- New dependencies: `rehype-katex`, `katex`, `mermaid`
- New components: `CodeBlock`, `MermaidRenderer`, `LinkWithPreview`
- Added KaTeX CSS import and dark mode overrides in `index.css`

---

### [0.2.3] — T07 Message Feature Enhancement

> Rich messaging interactions approaching WeChat experience.

#### Added

- **Emoji & Stickers**
  - Emoji picker with 8 categories and recent tracking
  - Sticker picker
- **Message Actions**
  - Context menu (copy, quote, delete, bookmark)
  - Message quoting/reply
  - Message forwarding
  - Message search panel
  - Message pinning (top of chat)
- **File System**
  - File upload (TXT, JSON, MD, JS, PY, etc.)
- **Group Features**
  - Group announcements
  - Group polls with anonymous voting, multi-choice, and timer support
- **Voice Messages** — T07 Phase 8
  - Record via MediaRecorder API
  - Waveform visualization with `VoicePlayer.jsx`
  - Play/pause controls with progress tracking
- **Image Messages** — T07 Phase 4
  - Inline image display with `[IMG:url]` format
  - Click-to-expand lightbox with `ImageMessage.jsx`
- **Message Bookmarks** — T07 Phase 1
  - Star/save important messages per chat
  - Slide-in panel to view all bookmarks (`BookmarkPanel.jsx`)
  - `BookmarkService.js` for CRUD operations
- **Read Receipts** — T07 Phase 5
  - Double checkmark indicator for read messages
  - `markMessagesAsRead()` tracks who has read each message
- **@Mention Highlighting** — T07 Phase 3
  - `@CharacterName` highlighted in message bubbles
  - Clickable mentions scroll to user's messages
- **Draft Auto-Save** — T07 Phase 2
  - Unfinished messages auto-saved per chat
  - 500ms debounce, 7-day expiry
  - `useDraft.js` hook for draft management
- **Chat History Export** — T07 Phase 6
  - Export as TXT, JSON, or styled HTML
  - `ExportService.js` with `ExportModal.jsx` UI
- **Enhanced Polls** — T07 Phase 7
  - Anonymous voting (hides voter names)
  - Multi-choice selection support
  - Timer/expiration for polls

#### Changed

- Rewrote `ChatWindow.jsx` with all new features
- Added 60+ translation keys for bilingual support
- Added `deleteMessage`, `bookmarkMessage`, `unbookmarkMessage`, `markMessagesAsRead` to ChatContext
- Scale-in animation for popup menus
- `MessageTimeline.jsx` enhanced with image, voice, and mention rendering

#### Fixed

- Language mixing from hardcoded strings
- Typing indicator now uses translation keys
- Lint errors in `useDraft.js`, `ChatComposer.jsx`, `VoicePlayer.jsx`

---

### [0.2.2] — T06 AI Characters & Avatar System

> Character layer — personality, avatars, relationship evolution (no memory).

#### Added

- **Character Expansion**
  - 8 anime character AI personas (Hatsune Miku, Rem, Rin Tohsaka, Naruto, L, Zero Two, Asuna, Gojo Satoru)
  - Custom generated avatars for all anime characters
- **Avatar Collection**
  - 13 realistic selfie-style avatars for all personas
  - 13 new high-quality character avatars
  - 10+ default user avatars (Watercolor, 3D Art, Pixel Art, Realistic, Minimalist)
  - Enhanced Avatar Selector UI with clear categories
- **Affinity/Fondness System**
  - Chat-based intimacy gain (+1 per message with 5-minute cooldown)
  - 5 intimacy levels: Acquaintance (0-19), Friend (20-39), Good Friend (40-59), Close Friend (60-79), Soulmate (80-100)
  - AI response tone adapts to intimacy level (formal → intimate)
  - Affinity meter UI in Friend Detail panel with colored progress bar
  - Affinity level badge displayed in Chat Header
- **Character Mood System**
  - 5 moods: Happy, Calm, Tired, Excited, Melancholy
  - Mood computed based on time of day, presence status, and personality traits
  - Mood-aware AI prompts affect response style
  - Mood emoji displayed in Chat Header next to character name
  - Deterministic mood per persona+hour for consistency

#### Changed

- `ChatEngine.js`: Added callback hooks for affinity gain and context provider for mood/intimacy
- `AIPipeline.js`: System prompts now include relationship-level tone and mood behavior hints
- `SocialContext.jsx`: Expanded with `addChatIntimacy` method and cooldown tracking
- 16 new translation keys for affinity levels and moods (EN/ZH)

#### Planned

- Custom user avatar upload & crop tool
- Custom character creator (planned, not for immediate implementation)

---

### [0.2.1] — T05 AI Behavior Humanization

> System-level simulation — making AI use the chat app like a real person.

#### Added

- **Response Simulation**
  - Personality-based response delays (`responseDelay`, `readDelay`, `typingSpeed`)
  - "Message seen" delay simulation
  - Typing indicators with animation
- **Proactive Behavior**
  - AI proactive messaging via `[SCHEDULE:X]` tool
  - AI multi-message support (consecutive messages like real users)
- **Auto Chat Naming**
  - New chats generate descriptive titles from first user message
  - AI topic extraction (max 6 words)
- **Time Display**
  - WeChat-style relative time formatting
  - Time separators between message groups
  - Bilingual time formatting
- **Dynamic Presence System**
  - Online/Busy/Offline status based on character schedules
  - Timezone-aware scheduling (each persona has own timezone)
  - Visual presence indicators (colored dots, status text)
  - Real-time presence updates every 60s
- **Proactive Greetings**
  - Window-open greeting when reopening chat after inactivity
  - Re-engagement greetings after long absence
  - Character-specific greeting messages

#### Changed

- Refactored `ChatContext.jsx` with new AI messaging architecture
- Enhanced `personas.js` with `responseDelay`, `readDelay`, `typingSpeed` configs
- Created `PresenceService.js` and `GreetingService.js` for presence/greeting logic
- `ChatEngine.js` integrated with presence and greeting systems

#### Fixed

- AI tool markers (`[MULTI:]`, `[REACT:]`, `[1][2]`) now properly stripped
- Case-insensitive MULTI tag parsing

#### Planned

- AI "editing" state (visual feedback for long reply revision)
- Message recall simulation (occasional "unsend" for realism)

---

### [0.2.0] — T04 Character Visuals & Interaction Design

> Visual identity for each character — reference Character.AI / ChatGPT / Grok.

#### Added

- **Character Theme System**
  - 8 unique color palettes (Rem Ice Blue, Zero Two Coral Red, Miku Teal, Gojo Royal Blue, Rin Crimson, Naruto Orange, L Dark Gray, Asuna Coral)
  - `CharacterTheme.jsx` module for dynamic theme management
  - CSS variables (`--character-rem-primary`, etc.)
- **Message Animations**
  - Bouncy `bubbleIn` entrance animation
  - Wave-style `typingWave` indicator
  - Avatar pulse on new messages
  - Hover lift effect on message bubbles
  - Staggered delays for consecutive messages
- **Character Glow Effects**
  - AI message bubbles with ambient glow in theme color
  - Hover glow intensification
  - Dark mode glow visibility (35% → 45% opacity)
- **iOS 26 Style Refinement**
  - Global border-radius: 44px → 24px
  - Softened animation intensities
  - Subtler hover/active scale effects

#### Fixed

- Message bubble overflow with character glow (`overflow-visible`)
- Animation performance with `prefers-reduced-motion` support
- Mobile layout overflow (bottom nav hiding in chat, padding fixes)
- Message text clipping from oversized border-radius

#### Changed

- Character theme color extended to full chat UI:
  - Header gradient tint + avatar ring color
  - Input box focus ring + quote accent line
  - Send button & record button use character gradient

#### Planned

- Custom character color override (user picks their own palette)

---

## Basic Agent — v0.3.x

### [0.3.3] — T15 Professional Agent Capabilities

> Deep specialization for each agent type.

#### Added

- **Muse Immersive Translation**
  - Reflective workflow: Literal → Polished (two-step translation)
  - Domain detection: Technical / Literary / General
  - Smart formatting: preserves code blocks, markdown, HTML tags
  - Terminology management with built-in glossary
- **Sensei 2.0 Cognitive Architecture**
  - Semi-Socratic teaching (Probing / Hint / Direct Instruction based on frustration)
  - GraphRAG knowledge graph (25+ nodes, Math/Coding/Science)
  - Prerequisite checking before complex topics
  - Symbolic math engine (`math.js`) for calculation accuracy
  - LRS-Lite learning progress tracking (mastery, struggles, quiz history)
- **RouteLLM Cost Optimization**
  - Smart model routing: simple queries → small models, complex reasoning → large/online models
- **Perplexity Sonar API Integration (Scholar)**
  - Real-time web search with citation-backed accuracy
  - Structured citations with `[1]` markers, titles, snippets, dates
  - Dual-layer control (system prompt for style, API params for search)
  - Domain filtering presets (Academic, News, Tech)
  - Multi-hop deep research for complex queries
  - Fact-checking with confidence scores

#### Planned

- Translation source/target side-by-side view
- Knowledge graph expansion + user-defined nodes
- Learning report export (PDF/charts)
- Search result card UI (source, date, confidence visualization)
- Multi-model switch panel + token usage stats

---

### [0.3.2] — T14 Knowledge Base & RAG System

> Document-augmented AI responses.

#### Added

- **RAG (Retrieval-Augmented Generation)**
  - TF-IDF document indexing
  - Text chunking algorithm
  - Client-side similarity search
  - `DocumentContext` for knowledge base management
- **AI File Generation**
  - `[FILE:name:content]` parser
  - Download generated files
  - Code preview component

#### Planned

- True vector embedding search (local embedding API)
- Knowledge base management UI (view/delete/edit documents)
- Incremental document updates

---

### [0.3.1] — T13 AI Agent & Tool System

> From character role-play to task execution.

#### Added

- **Task Agent System**
  - 6 specialized agents: Coder, Muse, Scholar, Sensei, Aurora, Pixel
  - Modular Agent Skills system (17+ reusable capabilities)
  - Contact list filter tabs: All / Social Companions / Task Assistants
  - Placeholder avatars (Cyberpunk, Watercolor, Minimalist)
- **ReAct Tool Calling Architecture**
  - Reason+Act loop for autonomous agent behavior
  - `toolService` with implementations: `run_code`, `search_docs`, `web_search`, `analyze_data`, `cite_sources`, `generate_image`, `color_palette`, `check_grammar`, `translate`
  - Dynamic system prompt support
- **Agent Workspace**
  - Dedicated chat spaces (`/agents/:agentId`)
  - Independent conversation history per agent
  - Separated from main chat list

#### Changed

- Updated `chatService.js` for dynamic system prompts
- Refactored `ChatContext.js` for recursive tool execution loops
- Upgraded localization for all agent types and skills

#### Planned

- Real code sandbox execution (WebAssembly/iframe)
- Agent-to-agent collaboration chains
- User-defined custom agents
- Tool execution result visualization
- Agent task history and reuse

---

### [0.3.0] — T12 AI Memory & Cognitive System

> Core innovation — independent character memory + emergent information exchange.

#### Added

- **Context Compression**
  - Automatic summarization of long conversations
  - Token usage optimization

#### Planned

- **Long-term memory** (persistent key information across conversations)
- **Independent character memory** (each character owns its own memory space)
- **Group chat context sharing** (group content automatically becomes context for all participants; private chats can access group context)
- **Memory exchange tool** (characters can actively request memory sharing from other characters)
- **Emergent behavior architecture** (characters autonomously decide whether to share, refuse, or even lie — AI makes the decision, we only provide tools)
- Memory capacity management and forgetting mechanisms

---

[Unreleased]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.3.3...HEAD
[0.3.3]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.7...v0.3.0
[0.2.7]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Luckycat133/Chat_Buddy/releases/tag/v0.1.0
