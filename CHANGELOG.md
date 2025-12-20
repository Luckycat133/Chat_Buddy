# Changelog

All notable changes to Chat Buddy Remake will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
