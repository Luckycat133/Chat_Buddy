# Chat Buddy Remake

<div align="center">

![Version](https://img.shields.io/badge/version-0.3.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18+-61DAFB.svg)

**AI Chat Companion**

A modern, responsive AI chat application featuring multiple personalities, anime characters, group chats, and bilingual support.

[English](README.md) | [中文](README.zh-CN.md)

</div>

---

## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [Changelog](#changelog)

---

## Features

### 🤖 AI Friend System

- **13 Unique AI Personas**: 5 original characters + 8 anime characters
- Each persona has distinct personality traits, speaking styles, and interests
- Powered by DeepSeek API for intelligent, context-aware responses

### 🎌 Anime Characters

Meet your favorite anime characters:

- **Hatsune Miku** - Cheerful virtual idol
- **Rem** - Devoted maid from Re:Zero
- **Rin Tohsaka** - Tsundere magus from Fate
- **Naruto Uzumaki** - Determined ninja
- **L** - Genius detective from Death Note
- **Zero Two** - Mysterious darling
- **Asuna** - Brave swordswoman from SAO
- **Gojo Satoru** - The strongest from Jujutsu Kaisen

### 💬 Group Chat

- Create groups with multiple AIs
- AIs interact with you and each other
- Customize AI capabilities per group

### 🌍 Bilingual Support

- Seamless English/Chinese interface switching
- All UI elements, documentation, and AI responses support both languages

### 🎨 Modern UI

- "Macaroon Orange" theme with WeChat-inspired design
- Smooth animations and responsive layout
- Works on desktop and mobile

### 💾 Local Storage

- Chats and settings saved in browser
- No account required
- Privacy-focused design

### 🤖 Smart AI Features

- **Dynamic Online Status** (v0.2.1): Real-time Online/Busy/Offline states based on character schedules
- **Visual Typing Indicators** (v0.2.1): See when AI is typing with animated bubbles
- **Proactive Greetings** (v0.2.1): AI initiates conversation after long inactivity or on return
- **Multi-message** (v0.2.1): AI can send consecutive messages like real users
- **WeChat-style time display** (v0.2.1)
- **Character Affinity System** (v0.2.2): Build intimacy through chatting and gifts; AI responses adapt from formal to intimate
- **Character Mood System** (v0.2.2): 5 moods (Happy, Calm, Tired, Excited, Melancholy) affect AI tone and response style

### 📸 Moments Enhancements (v0.2.4)

- **AI Dynamic Posts**: AI friends post daily life updates based on their location and personality
- **Smart Interactions**: AI intelligently comments on and likes your posts
- **WeChat-style Features**: Location tags, privacy settings, and cover photos
- **Emoji Reactions**: React to posts with 😂❤️👍🔥😮😢

---

## Demo

![Chat Interface](docs/images/chat-demo.png)

---

## Getting Started

### Prerequisites

| Requirement      | Version                    |
| ---------------- | -------------------------- |
| Node.js          | v16+                       |
| npm              | v7+                        |
| DeepSeek API Key | Optional, for AI responses |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Luckycat133/Chat_Buddy.git
cd Chat_Buddy

# 2. Install dependencies
npm install

# 3. Configure environment
# Copy .env.example to .env and edit
cp .env.example .env
# Edit .env with your API settings

# 4. Start development server
npm run dev
```

### Environment Variables

| Variable          | Required | Description                                     |
| ----------------- | -------- | ----------------------------------------------- |
| `VITE_AI_API_URL` | Yes      | API Base URL (e.g., `https://api.deepseek.com`) |
| `VITE_AI_API_KEY` | Yes      | Your API key for AI responses                   |
| `VITE_AI_MODEL`   | Yes      | Model name (e.g., `deepseek-chat`, `sonar`)     |

> **Supported Providers**: DeepSeek, Perplexity, OpenAI, and other OpenAI-compatible APIs.

---

## Usage Guide

### Creating a Chat

1. Click the **"+"** button or navigate to "New Chat"
2. Select one or more AI friends
3. For group chats, optionally set a group name
4. Click "Create Chat" to start

### Chatting

1. Type your message in the input field
2. Press Enter or click Send
3. AIs will respond based on their personality and context
4. In groups, AIs may also respond to each other

### Settings

- **Language**: Switch between English and Chinese
- **Theme**: Macaroon Orange (default)
- **Help**: View FAQ and usage tips
- **About**: Check version and changelog

---

## Architecture

> See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

### Tech Stack

- Frontend: React 19, Vite
- Styling: TailwindCSS
- State: Clean Architecture (ChatEngine + Context)
- AI: DeepSeek / Perplexity API
- Storage: LocalStorage

### Project Structure

```
src/
├── core/               # Domain logic (pure JS)
│   └── chat/
├── services/           # Infrastructure (API, Storage)
├── features/           # Feature modules
│   ├── chat/
│   └── moments/
├── providers/          # Context composition
├── components/         # Shared UI
└── pages/              # Routes
```

### Data Flow

```mermaid
graph LR
    A[User] --> B[ChatComposer]
    B --> C[ChatEngine]
    C --> D[AIPipeline]
    D --> E[AI API]
    E --> D
    D --> C
    C --> F[Storage]
    C --> G[UI]
```

---

## Contributing

We welcome contributions! Please follow these guidelines:

### How to Contribute

1. **Fork** the repository
2. Create a **feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

### Code Style

- Use ESLint for JavaScript/JSX linting
- Follow React best practices
- Write meaningful commit messages
- Add bilingual support for new UI text

### Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Provide browser and OS information

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

**Current Version**: v0.2.2 (2026-02-15)

### Recent Updates

- 💕 **Affinity/Fondness System**: Build intimacy through chatting and gifts (0-100 scale, 5 levels)
- 😊 **Character Mood System**: 5 moods affect AI response style (Happy, Calm, Tired, Excited, Melancholy)
- 🌐 **Dynamic Presence**: Online/Busy/Offline status based on character schedules
- 👋 **Proactive Greetings**: AI initiates conversation after inactivity
- 🖼️ **Immersive Background System**: 20+ AI-generated backgrounds for each persona
- 🌙 **Dark Mode Overhaul**: Complete CSS variable system with glass effects
- 📱 **iOS 26 Style**: Refined border-radius and subtle animations
- 🎨 **Per-Chat Backgrounds**: Custom background for each conversation
- 🧠 **Specialized AI Agents**: 6 task-focused assistants (Coder, Muse, Scholar, etc.)
- 🛠️ **ReAct Tool Calling**: AI can execute code, search, generate images
- 📸 Enhanced AI Moments with dynamic posting and smart comments
- 📍 Location tags and visibility settings (Public/Private/etc.)
- 💬 Reply threads and emoji reactions in Moments
- 👫 Friends management with groups
- 🎯 Daily Check-in and Achievements
- 🧧 Red Packet and Gift system
- 🎮 Rock-Paper-Scissors mini game
- 😊 Emoji picker with 8 categories

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with ❤️ for anime fans and AI enthusiasts**

[⬆ Back to Top](#chat-buddy-remake)

</div>
