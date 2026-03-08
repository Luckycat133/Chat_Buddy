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

### Added — UI Accessibility & Interaction Improvements (2026-03-08)

- **ARIA Accessibility Enhancements** (`src/components/Layout.jsx`, `src/pages/Settings.jsx`)
  - Added `role="navigation"` to sidebar and mobile navigation
  - Added `role="main"` to Settings page content area
  - Added `role="switch"` and `aria-checked` to ControlCard components
  - Added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` to modals
  - Added `aria-label` and `aria-current="page"` to navigation items
- **Active State Indicator** (`src/components/Layout.jsx`)
  - Added left-side white indicator bar for active navigation item
  - Improved visual feedback for current page selection
- **Semantic HTML Improvements** (`src/pages/Settings.jsx`)
  - Converted ControlCard and SettingItem from `<div>` to `<button>` elements
  - Added `focus-visible` styles for keyboard navigation
  - Added hover transform effect (translate-x) for SettingItem
- **CSS Accessibility** (`src/index.css`)
  - Added `prefers-reduced-motion` media query support
  - Enhanced focus outline styles for better keyboard navigation visibility

---

## [0.3.3-patch-2] — UI Completeness & Agent Tools (2026-03-06)

> Completion of stub UI elements and implementation of missing agent tool capabilities.

### Added — Phase 1: UI Fixes

- **Settings Privacy & Logout** (`src/pages/Settings.jsx`)
  - Privacy & Security modal with data management options
  - Export data and Clear all data functionality with confirmation dialogs
  - Logout flow that clears localStorage and resets application state
  - New translation keys: `confirm_logout`, `logout_success`, `privacy_title`, etc.
- **Global Search Shortcut (Ctrl+K)** (`src/components/Layout.jsx`)
  - Keyboard shortcut `Ctrl+K` opens global message search panel
  - Escape key handling to close search panel
- **Group Add Member** (`src/features/chat/GroupDetails.jsx`)
  - "+" button in group details now opens Add Member modal
  - New `AddMemberModal` component for selecting AI personas not in group
  - Sends system message when new members are added
  - New translation keys: `add_member_title`, `add_member_btn`, `no_available_members`
- **Translation Updates** (`src/data/locales.js`)
  - Added `gift_desc`, `red_packet_desc`, `game_desc`, `poll_desc` to replace "coming soon" texts

### Added — Phase 2: Agent Tools

- **Pixel Agent Tools Enabled** (`src/data/taskAgents.js`)
  - Changed `toolsEnabled: false` to `toolsEnabled: true` for Pixel creative agent
- **Grammar Check Tool** (`src/features/chat/services/toolService.js`)
  - AI-powered grammar checking with detailed feedback
  - Detects grammar errors, spelling mistakes, punctuation issues, and style improvements
- **Data Analysis Tool** (`src/features/chat/services/toolService.js`)
  - AI-powered data analysis with summary statistics
  - Identifies patterns, trends, and provides suggestions for further analysis
- **Image Generation Tool** (`src/features/chat/services/toolService.js`)
  - AI-based image generation description (simulated, no external API required)
  - Describes what the generated image would look like based on prompt
- **Color Palette Tool** (`src/features/chat/services/toolService.js`)
  - AI-powered color palette generation with mood and base color support
  - Predefined fallback palettes: warm, cool, dark, pastel, vibrant, nature, ocean, sunset

### Added — Phase 3: AI Behavior Enhancement

- **AI "Editing" State** (`AIPipeline.js`, `ChatEngine.js`, `TypingBubble.jsx`)
  - Detects long conversation context (>500 characters) and shows "Editing..." status
  - Pencil icon with animated pulse effect in typing bubble
  - New `editingIndicators` state alongside existing `typingIndicators`
- **Message Recall Simulation** (`AIPipeline.js`, `ChatEngine.js`, `MessageTimeline.jsx`)
  - 5% probability AI will recall and revise a sent message
  - Recalled messages shown as gray text: "XX recalled a message"
  - AI sends revised version after brief delay for natural conversation flow

### Added — Phase 4: User Customization

- **Avatar Upload Modal** (`AvatarUploadModal.jsx`)
  - Professional avatar upload with 3-step workflow: select → crop → preview
  - Canvas-based image cropping with zoom controls (0.5x - 2x)
  - Automatic resizing to 256x256 output
  - Base64 storage to `chat-buddy-user-profile` localStorage
  - Supports JPG/PNG formats up to 5MB
- **Character Creator Modal** (`CharacterCreatorModal.jsx`)
  - 4-step wizard for creating custom AI personas
  - Step 1: Basic info (English/Chinese names)
  - Step 2: Personality & interests with 6 speaking style presets
  - Step 3: Avatar selection (preset avatars or custom upload)
  - Step 4: Theme color selection (8 color options)
  - Auto-generated system prompt based on character traits
- **Dynamic Persona Support** (`personas.js`)
  - `getCustomPersonas()` - Load custom personas from `chat-buddy-custom-personas` localStorage
  - `saveCustomPersona()` - Persist new custom persona
  - `deleteCustomPersona()` - Remove custom persona
  - `getAllPersonas()` now includes custom personas alongside built-in ones
- **New Translation Keys** (`locales.js`)
  - Avatar upload: `crop_avatar`, `preview_avatar`, `select_photo`, `avatar_upload_desc`, `avatar_upload_hint`, etc.
  - Character creator: `create_custom_character`, `basic_info`, `personality_interests`, `speaking_style`, `theme_color`, etc.

---

## [0.3.3-patch] — T15 + T14 + T10 Phase 3 Completion (2026-03-02)

> All remaining roadmap items for v0.3.x completed — professional agent capabilities deepened, RAG upgraded, and social feature set finalized.

### Added — T15 Professional Agent Capabilities (Phase 2)

- **Translation Compare View** (`TranslationCompareView.jsx`)
  - Side-by-side source/target display with language code badges (EN/ZH/JA etc.)
  - Per-panel copy-to-clipboard buttons
  - Parses `[TRANSLATION:source||target||from||to]` markers from Muse agent output
  - `parseTranslationMarker()` utility exported for reuse
- **Scholar Citation Cards** (`ScholarResultCard.jsx`)
  - Visual citation cards with verdict badges: Verified ✅ / Disputed ⚠️ / Unverifiable ❓
  - Expandable snippet preview, external link button
  - Parses `[CITATION:n|url|title|snippet|verdict]` markers from Scholar output
- **Coder Diff View** (`CodeDiffView.jsx`)
  - LCS (longest common subsequence)-based line diff algorithm
  - Unified and split view modes with toggle
  - Added/removed line counts badge, copy button for revised code
  - Parses `[DIFF:lang|before||after]` markers from Coder agent output
- **Model Switcher Panel** (`ModelSwitcherPanel.jsx`)
  - 5 model presets: DeepSeek Chat, DeepSeek R1, Claude Sonnet 4, GPT-4o Mini, Custom
  - Live token usage stats from `chat-buddy-token-usage` localStorage
  - Estimated cost display based on selected model pricing
  - Accessible from Settings > Advanced Tools
- **Knowledge Graph Panel** (`KnowledgeGraphPanel.jsx`)
  - Browse 25+ built-in concept nodes (Math/Science/Coding categories)
  - Add/delete custom concept nodes with name, category, and description
  - Custom nodes persisted to `chat-buddy-custom-kg-nodes` localStorage
  - Search filter, category color badges, prerequisite display
- **Learning Report Panel** (`LearningReportPanel.jsx`)
  - Sensei learning progress: sessions completed, average quiz score
  - Topic mastery progress bars with lesson and struggle counts
  - Quiz history cards with score and date
  - Export report as `.txt` file download via Blob URL

### Added — T14 Knowledge Base & RAG System (Phase 2)

- **Hybrid Search** (`ragUtils.js`)
  - BM25 scoring (K1=1.5, B=0.75) alongside Jaccard similarity
  - Combined score: 60% normalized BM25 + 40% Jaccard for improved recall over pure TF-IDF
  - Average document length normalization for fair cross-chunk comparison
  - `calculateBM25Score()` function exported
- **Knowledge Base Management UI** (`KnowledgeBasePanel.jsx`)
  - Document list with name, file size, type, chunk count, and upload date
  - Inline content preview toggle (first 400 chars in monospace)
  - Per-document delete, clear-all with double-tap confirmation (3s timeout)
  - File upload: accepts txt/md/json/csv/js/py/ts/jsx/tsx/html/css/yaml
  - RAG enable/disable toggle
  - Accessible from Settings > Advanced Tools

### Added — T10 Social & Interaction Features (Phase 3)

- **Idiom Chain Game** (`IdiomChain.jsx`)
  - 成语接龙 — Chinese-only mode (hidden in English UI)
  - Player and AI alternate 4-character Chinese idioms
  - Validates correct chain continuation (first char must match previous last char)
  - Duplicate idiom detection; AI uses `callAI()` for responses
  - Points awarded on AI surrender: `max(10, score × 5)`
  - Accessible via Games menu in chat
- **AI Trivia Quiz** (`TriviaQuiz.jsx`)
  - 3-phase UI: category select → playing → results
  - 6 categories: General Knowledge, Science, History, Pop Culture, Technology, Math (EN+ZH)
  - 5 questions generated in parallel via AI; strict JSON format with fallback
  - 6 points per correct answer; explanation shown after each answer
  - Progress dots with color coding (green/red/pending)
- **Friend Interaction Log** (`FriendInteractionLog.jsx`)
  - Vertical timeline of interaction history per friend
  - 6 activity types with colored icons: Viewed Moment, Sent Gift, Chatted, Liked Moment, Commented, Mentioned
  - Relative time display (just now / Xm / Xh / Xd / date)
- **Leaderboard Page** (`LeaderboardPage.jsx`)
  - 4 tabs: Intimacy Rankings, Points, Streak, Achievements
  - Intimacy tab: ranks all 19 personas (companions + agents) by intimacy score
  - Top 3 medals (🥇🥈🥉), progress bars, intimacy level labels
  - Points/Streak/Achievement tabs show user's own current stats
  - Accessible at `/leaderboard` route
- **Character Events Service** (`characterEvents.js`)
  - `checkAndTriggerEvents(personas, addPost)` — checks birthdays (MM-DD format) and 4 holidays
  - Pre-defined bilingual event content for 5 characters + default fallback
  - 4 seasonal holidays: New Year, Valentine's Day, Halloween, Christmas
  - Uses `chat-buddy-triggered-events` localStorage to prevent duplicate posts per day
  - `getUpcomingBirthdays(personas)` — returns next 7 days upcoming birthdays

### Changed

- `GameSelectorPanel.jsx`: Added Trivia and Idiom Chain to games list; Idiom Chain filtered to Chinese mode only (`langFilter: 'zh'`)
- `ChatWindow.jsx`: Added lazy-loaded `TriviaQuiz` and `IdiomChain` components
- `Settings.jsx`: Added 4 new Advanced Tools items (Knowledge Base, Model Switcher, Knowledge Graph, Learning Report) with lazy-loaded panels
- `App.jsx`: Added `/leaderboard` route pointing to `LeaderboardPage`
- `locales.js`: Added ~110 new translation keys (EN+ZH) for all new components

---

## [0.2.7-patch] — Audit Remediation (2026-02-22)

> Full quality audit pass based on v1.0 audit report — all P0/P1 blockers resolved, P2 visual defects patched.

### Fixed

- **L-002 (P0)** — `FriendDetail.jsx`: "Start Chat" button now correctly navigates to an existing DM or creates a new one via `createChat()` + `navigate()`; button label updates to "View Chat" when conversation already exists
- **L-003 (P0)** — `ChatEngine.js`: Newly created sessions are persisted immediately on `createChat()` via `this.save()` → `StorageService.set()`; `_loadChatsWithMigration()` handles legacy key fallback for zero data-loss upgrades
- **T08 / B-001 (P0→P1)** — `MessageTimeline.jsx`: Full Markdown rendering with `react-markdown` + `remark-gfm`; code blocks with syntax highlighting (VS Code themes), copy button; LaTeX with `rehype-katex`; Mermaid diagrams; table styling
- **B-002 (P1)** — `GroupDetails.jsx`: "Group Announcement" and "Group Poll" menu items now gated behind `!isDirectChat` guard; 1-on-1 chat settings no longer show group-specific options
- **B-003 (P1)** — `ProfileEditor.jsx`: Nickname field validates non-empty trimmed value; inline `nicknameError` state prevents saving blank display names
- **B-004 (P1)** — `ChatList.jsx`: Search `filteredChats` useMemo correctly filters against `searchTerm` state across chat name and last message preview
- **T02 (P1)** — `ApiConfigPanel.jsx`: Model name field now includes a `<datalist>` with 16 common model suggestions (GPT, Claude, Gemini, DeepSeek, Qwen, GLM, Moonshot); added 5 quick-fill provider preset buttons (OpenAI, Anthropic, Google, DeepSeek, Ollama) to auto-populate Base URL + model
- **G-001 (P2)** — `index.css`: Light mode suppresses dark glow pseudo-elements — `html:not(.dark) .message-bubble-ai::after { opacity: 0 }` and `html:not(.dark) .character-glow::before { opacity: 0 }`
- **G-002 (P2)** — `index.css`: Sidebar inactive nav links in light mode now use `#4a4e6a` (WCAG AA compliant) instead of the semi-transparent `--color-text-muted`; hover restores brand primary color
- **R-001 (P2)** — `index.css`: Added `@media (min-width: 768px) and (max-width: 900px)` breakpoint — sidebar collapses from 88px to 56px, icons scale down, hover tooltips hidden to prevent layout overflow on tablet-width viewports
- **R-002 (P2)** — `index.css`: Mobile `.page-content` has `padding-bottom: calc(6.5rem + env(safe-area-inset-bottom))` to prevent fixed bottom nav from obscuring list content
- **T03 — OLED** — `ThemeContext.jsx`: `toggleOLEDMode()` and `.dark.oled` CSS class fully functional; Settings UI control verified
- **T03 — Shortcuts** — `Layout.jsx` + `useKeyboardShortcuts.js`: Global `keydown` listener active; `Ctrl+1-5` navigation, `Ctrl+/` shortcut modal, `Esc` back/close all working


## Basic Role-Play — v0.2.x

### [0.2.7] — T11 Moments & Feed System (Phase 2)

#### Added

- **Draft Box** — `PostComposer` auto-saves in-progress posts (debounced 500ms); restores on reopen with "Draft restored" banner; explicit "Discard" button clears draft
- **Hashtag Topics** — `#hashtag` tokens in moment content are rendered as clickable primary-colored spans; clicking sets an `activeHashtag` filter in `MomentsPage`; dismissible filter pill shown above feed
- **Pagination / Load More** — Feed shows 10 posts by default; "Load more" button appends 10 more; pagination resets when hashtag filter changes
- **Story Events** — On first mount each day, system checks for birthdays and seasonal holidays; matching personas auto-post themed content; birthdays defined for all 13 personas; 4 seasonal events (New Year, Valentine's Day, Halloween, Christmas); uses `lastStoryEventDate` in state to prevent duplicate runs
- **Repost to Chat** — `RepostSheet` bottom-sheet lists all chats; selecting one sends a formatted `[Shared Moment · Author]\n{content}` message; shows checkmark confirmation before closing
- **Birthday fields** — Added `birthday: 'MM-DD'` to all 13 social companion personas in `personas.js`
- **New locale keys** — `discard_draft`, `load_more`, `repost`, `repost_success`, `select_chat_to_share`, `birthday_post_hint`, `happy_birthday` (EN + ZH)

#### Technical

- `MomentsState.jsx`: Added `draft` and `lastStoryEventDate` to `DEFAULT_MOMENTS_DATA`
- `MomentsActions.jsx`: Added `saveDraft`, `clearDraft`, `generateStoryPost` actions
- `MomentsContext.jsx`: Added `useStoryEvents` hook called from `MomentsAIOrchestrator`
- `momentsService.js`: Added `generateBirthdayPostSystemPrompt`, `generateHolidayPostSystemPrompt`, `SEASONAL_EVENTS`, `getTodayEvents`
- `RepostSheet.jsx`: New component using `useChatService` for chat list and `sendMessage`

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

#### Design Principle

> All social features are **passively discoverable** (sidebar entries, long-press triggers). No forced pop-ups or badge bombing. Points and tasks are "icing on the cake", not mandatory.

#### Added (Phase 1 — Foundation)

- **User Profile** (avatar, nickname, signature)
- **Friends Management** (groups, starring, remark names, search)
- **Friend Detail Panel** with quick actions
- **Daily Check-in** with streak tracking
- **Achievement System** with 11 milestones and point rewards
- **Red Packet** (virtual points — UI complete)
- **Gift System** (6 gifts with intimacy boosts, deducts points)
- **Rock-Paper-Scissors** mini-game

#### Added (Phase 2 — Engagement Loop)

- **Daily Task System** (`DailyTaskPanel.jsx`)
  - 6 rotating daily tasks: Check-in, Send 5 messages, Play a game, Send a sticker, Send a gift, Chat with 3 characters
  - Progress bars for multi-step tasks
  - Auto-resets at midnight; point rewards on completion (up to 165 pts/day)
  - Accessible from Settings profile card and AchievementsPage header
- **Number Guess Mini-Game** (`NumberGuessGame.jsx`)
  - AI picks a secret number 1–100; player has 7 attempts
  - Directional feedback: "too high" / "too low"
  - Win reward: **+30 points**; auto-completes "Play a game" daily task
- **Game Selector** (`GameSelectorPanel.jsx`)
  - Replaces direct-launch: clicking Game button shows a picker (RPS or Number Guess)
- **RPS Point Rewards**
  - Each round win now grants **+10 points** with inline toast
- **Daily Task Integration Hooks**
  - Sending a regular message → `task_messages` progress (+1 per send)
  - Sending a sticker → `task_sticker` complete
  - Sending a gift → `task_gift` complete
  - Playing any game → `task_game` complete
  - Checking in → `task_checkin` complete
- **Bug Fix: ChatComposer ↔ ChatWindow props**
  - Gift, Game, Poll, Red Packet buttons in the `+` menu were showing `alert()` stubs instead of opening the actual panels — now correctly wired to parent handlers

#### Changed

- `SocialContext`: Added `getDailyTasks()`, `updateTaskProgress()`, `getDailyTaskProgress()` methods; `dailyTasks` field added to persisted social data
- `AchievementsPage`: Added daily task progress banner above stats grid
- `Settings`: Profile card stats row expanded to 3 columns (Streak / Points / Daily Tasks)
- `ChatWindow`: Added `GameSelectorPanel`, `NumberGuessGame` lazy imports; message send handler tracks task progress
- 50+ new translation keys added (`task_*`, `number_guess_*`, `select_game`, `rps_win_points`)

#### Planned (Phase 3)

- Idiom chain (成语接龙, CN mode)
- AI trivia quiz (generates questions from chat context)
- Friend interaction log (milestone timeline UI)
- Leaderboards (opt-in point/streak/achievement rankings)
- AI character birthday and holiday events

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
- **Translation Compare View**, **Scholar Citation Cards**, **Coder Diff View**, **Model Switcher Panel**, **Knowledge Graph Panel**, **Learning Report Panel** — see `[0.3.3-patch]` entry above

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

- **Hybrid Search**, **Knowledge Base Management UI** — see `[0.3.3-patch]` entry above

---

### [0.3.1] — T13 AI Agent & Tool System (Phase 2)

> Custom agents, real sandbox execution, tool visualization, and agent collaboration.

#### Added

- **Custom Agent Editor** — `AgentEditorModal.jsx` lets users create/edit/delete custom AI agents
  - Fields: name, Chinese name, description, system prompt, skills (multi-select), theme color
  - Persisted to IndexedDB via `AgentStore`; merged with built-in agents at runtime
  - "Create" button in AgentsPage header; "Edit" pencil icon on custom agent cards
  - "Custom" badge distinguishes user-created agents from built-in ones
- **Code Sandbox Worker** — `public/sandbox.worker.js` isolates code execution from main thread
  - JavaScript: uses Worker-scope `Function` with `console.log` capture; 10-second kill timeout
  - Python: lazy-loads Pyodide (WebAssembly) on first Python request; 30-second timeout
  - Infinite-loop protection: terminates and recreates the Worker on timeout
- **Tool Result Cards** — `ToolResultCard.jsx` renders inline tool events in chat timeline
  - Three states: loading (spinner), success (green check), error (red X)
  - Expandable output panel (capped at 500 chars); labeled by tool type with appropriate icon
  - AIPipeline now emits `onToolStart`/`onToolEnd` callbacks before/after each tool call
  - ChatEngine inserts ephemeral `type: 'tool_event'` messages; completes and saves on finish
- **Agent Collaboration** — `delegate_task` tool allows agents to sub-delegate to peers
  - Invocation: `[TOOL_CALL: delegate_task {"agentId": "agent-coder", "prompt": "..."}]`
  - Max delegation depth 2 — infinite loop guard
  - Result surfaces as a `[Delegated response from X]` block in the calling agent's context

#### Changed

- **AgentsPage**: loads and merges custom agents from IndexedDB; shows custom badge + edit button
- **ChatEngine**: `addPersona()` and `removePersona()` for runtime persona registration
- **AIPipeline**: passes `delegationDepth` to `executeTool` extras; `onToolStart`/`onToolEnd` emitted around every standard tool call
- **toolService**: `run_code` now routes through sandbox worker; `delegate_task` case added
- **eslint.config.js**: `globals.worker` added for `public/sandbox.worker.js`

#### Technical

- `AgentStore.js`: IndexedDB CRUD for custom agents (singleton `agentStore`)
- `ToolResultCard.jsx`: collapsible glass card, 14 tool-type icon mappings
- `public/sandbox.worker.js`: JS + Python (Pyodide) isolated execution with timeout
- `_buildToolInputSummary()` helper in ChatEngine for human-readable tool labels

---

### [0.3.1-base] — T13 AI Agent & Tool System (Phase 1)

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
