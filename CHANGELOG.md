# Changelog

All notable changes to Chat Buddy Remake will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.3.0] - 2026-01-08

### Added
- **Specialized AI Agents System**
  - Introduced 6 new Task Agents with professional personas:
    - **Coder**: Programming assistant for debugging and code generation
    - **Muse**: Creative writing and translation aide
    - **Scholar**: Research and fact-checking specialist
    - **Sensei**: Educational tutor and quiz generator
    - **Aurora**: Emotional support and mindfulness guide
    - **Pixel**: UI/UX design and creative direction assistant
  - Modular **Agent Skills** system with 17 reusable capabilities
- **ReAct Tool Calling Architecture**
  - Implemented Reason+Act loop for autonomous agent behavior
  - Created `toolService` with mock implementations for:
    - `run_code`, `search_docs` (Programming)
    - `web_search`, `analyze_data`, `cite_sources` (Research)
    - `generate_image`, `color_palette` (Creative)
    - `check_grammar`, `translate` (Writing)
  - Agents can now understand task-specific system prompts and execute tools
- **Contact List Enhancements**
  - Added filter tabs: **All**, **Social Companions**, **Task Assistants**
  - Smart categorization based on agent type
- **UI Enhancements**
  - Placeholder avatars for new agents (Cyberpunk, Watercolor, Minimalist styles)
- **Muse Immersive Translation System**
  - **Reflective Workflow**: Two-step translation (Literal → Polished) for high fidelity
  - **Domain Detection**: Auto-identifies Technical, Literary, or General content
  - **Smart Formatting**: Preserves code blocks, markdown, and HTML tags strictly
- **Sensei 2.0 Cognitive Architecture**
  - **Semi-Socratic Teaching**: Implemented adaptable guiding strategy (Probing/Hint/Direct Instruction) based on student frustration levels.
  - **GraphRAG Knowledge Graph**: Integrated local knowledge graph with 25+ nodes covering Math, Coding, and Science to understand concept dependencies.
  - **Prerequisite Checking**: Automatically checks for missing foundational knowledge before teaching complex topics.
  - **Symbolic Math Engine**: Integrated `math.js` to eliminate mathematical hallucinations and ensure calculation accuracy.
  - **Learning Progress Tracking**: Implemented LRS-Lite using localStorage to record mastery, struggles, and quiz history.
- **RouteLLM Cost Optimization**
  - Implemented smart model routing: Simple queries use small models, while complex reasoning triggers large/online models.
  - **Terminology Management**: Built-in glossary for consistent technical terms
- **Perplexity Sonar API Integration (Scholar Agent)**
  - **Real-time Research**: Enabled searching the web with citation-backed accuracy using Sonar models
  - **Structured Citations**: Automatic parsing of `[1]` markers with title, snippet, and date metadata
  - **Dual-Layer Control**: System prompt handles generation style while API parameters control search domains
  - **Domain Filtering**: Built-in presets for Academic, News, and Tech sources
  - **Deep Research**: Implemented multi-hop search capabilities for complex queries
  - **Fact Checking**: New tool to verify claims with confidence scores

### Changed
- Updated `chatService.js` to support dynamic system prompts
- Refactored `ChatContext.js` to handle recursive tool execution loops
- Upgraded localization files with support for all new agent types and skills

## [0.2.5] - 2025-12-27

### Added
- Expanded Avatar Collection
  - 13 new high-quality Character Avatars (AI Personas & Anime Characters)
  - 10+ new Default User Avatars in diverse styles:
    - Watercolor Collection (Dog, Flower, Mountain, Bird, Coffee, Splash)
    - 3D Art Collection (Glassmorphism, Fluid Art, Low Poly, Claymorphism)
    - Pixel Art (Stardew Valley Style)
    - Realistic & Minimalist options
- Enhanced Avatar Selector UI with clear categories

---

## [0.2.4] - 2025-12-21

### Added
- AI Moments Enhancement
  - API-powered dynamic AI post generation
  - Intelligent AI commenting with context awareness
  - AI-to-AI interactions in Moments
  - Emoji reactions (😂❤️👍🔥😮😢) on posts
  - Comment reply threads
- WeChat-style Features
  - Location tags with custom locations (anime worlds supported)
  - Visibility settings (public/partial/hidden/private)
  - Reply-to-comment functionality
- AI Content Search
  - AI can search group chats they're in
  - AI remembers their own Moments history
  - Context-aware content generation
- Image API placeholder for future AI-generated images

### Changed
- Completely rewrote MomentsContext.jsx with new AI capabilities
- Enhanced MomentCard.jsx with reactions and location display
- Updated PostComposer.jsx with location picker and visibility selector
- Added 16 new bilingual translation keys

---

## [0.2.3] - 2025-12-20

### Added
- Social Features
  - User Profile system with avatar, nickname, signature
  - Moments/Timeline with posts, likes, comments
  - AI auto-posting in Moments with personality-based content
  - Friends management with groups and starring
  - Friend detail panel with quick actions
  - Daily Check-in system with streak tracking
  - Achievement system with points
  - Red Packet feature (virtual points)
  - Gift system
  - Rock-Paper-Scissors mini game
  - Sticker picker
  - Message forwarding
  - Message search panel
  - Group announcements
  - Group polls
- Theme & Notification Settings
  - Dark mode toggle
  - Chat background customization
  - Notification sound toggle
  - Do Not Disturb mode
  - Browser push notifications

### Fixed
- Fixed incorrect version display in Settings (v0.3.0 → v0.2.3)

---

## [0.2.2] - 2025-12-14

### Added
- WeChat-Style Features
  - Emoji picker with 8 categories and recent tracking
  - Message context menu (copy, quote, delete)
  - Message quoting/reply feature
  - File upload system (TXT, JSON, MD, JS, PY, etc.)
- RAG (Retrieval Augmented Generation)
  - Document indexing with TF-IDF
  - Text chunking algorithm
  - Client-side similarity search
  - DocumentContext for knowledge base
- AI File Generation Tools
  - [FILE:name:content] parser
  - Download generated files
  - Code preview component

### Changed
- Completely rewritten ChatWindow.jsx with new features
- Added 60+ new translation keys for bilingual support
- Updated ChatContext.jsx with deleteMessage function
- Added scale-in animation for popup menus

### Fixed
- Language mixing issues with hardcoded strings
- Typing indicator now uses translation keys

---

## [0.2.1] - 2025-12-13

### Added
- AI Tool-Based Messaging System
  - Personality-based response delays
  - "Message seen" delay simulation
  - Typing indicators
  - AI proactive messaging
    - AI can schedule follow-up messages using [SCHEDULE:X] tool
  - AI multi-message support
    - AI can send multiple consecutive messages like real users
- WeChat-style Time Display
  - Relative time formatting (Just now, X minutes ago, etc.)
  - Time separators between message groups
  - Bilingual time formatting support
- Context Compression
  - Automatic summarization of long conversations
  - Token usage optimization
- Modern UI Enhancements
  - Unique Chat Buddy logo
  - Message entrance animations
  - Typing dots animation
  - Glass effect utilities
  - Enhanced shadows and design tokens
  - Realistic selfie-style avatars for all 13 personas

### Changed
- Refactored ChatContext.jsx with new AI messaging architecture
- Updated index.css with comprehensive animation system
- Improved ChatWindow.jsx with time separators and typing indicators
- Enhanced personas.js with responseDelay, readDelay, typingSpeed configs
- Updated About page with new logo and v0.2.1 changelog
- Updated README.md with new feature documentation

### Fixed
- Message cleaning: AI tool markers ([MULTI:], [REACT:], [1][2], etc.) now properly stripped
- Case-insensitive MULTI tag parsing

---

## [0.2.0] - 2025-12-07

### Added
- 8 new anime character AI personas (Hatsune Miku, Rem, Rin Tohsaka, Naruto, L, Zero Two, Asuna, Gojo Satoru)
- Custom generated avatars for all anime characters
- About page with version info and changelog summary
- Help & FAQ page with frequently asked questions

### Changed
- Updated personas.js to include anime characters

---

## [0.1.1] - 2025-12-06

### Added
- Bilingual support (English/Chinese) with seamless language switching
- Enhanced Settings page with WeChat-style UI
- Search functionality in chat list
- AI Capabilities settings in group details

### Fixed
- Localization consistency across all UI components
- Language switching for Settings, ChatList, and GroupDetails

---

## [0.1.0] - 2025-12-05

### Added
- Initial release of Chat Buddy Remake
- 5 AI personas with unique personalities (Luna, Max, Bella, Oliver, Sophie)
- One-on-one and group chat functionality
- DeepSeek API integration for AI responses
- Local storage for chat history and settings
- Macaroon Orange theme with modern UI
- React + Vite + TailwindCSS tech stack

---

[Unreleased]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Luckycat133/Chat_Buddy/releases/tag/v0.1.0
