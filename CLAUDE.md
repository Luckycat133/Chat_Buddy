# CLAUDE.md - AI Assistant Guide for Chat Buddy

**Version**: 0.3.1 | **Last Updated**: 2026-02-08 | **For**: AI Development Assistants

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start for AI Assistants](#quick-start-for-ai-assistants)
3. [Architecture & Design Patterns](#architecture--design-patterns)
4. [Directory Structure](#directory-structure)
5. [Core Systems](#core-systems)
6. [Development Workflows](#development-workflows)
7. [Common Tasks](#common-tasks)
8. [Important Patterns](#important-patterns)
9. [Testing Strategy](#testing-strategy)
10. [Debugging Guide](#debugging-guide)
11. [Key Files Reference](#key-files-reference)

---

## 🎯 Project Overview

### What is Chat Buddy?

Chat Buddy is a **modern AI chat application** built with React 19 and Vite, featuring:
- **13 unique AI personas** (5 original + 8 anime characters)
- **6 specialized task agents** (Coder, Sensei, Scholar, Muse, Mentor, Analyst)
- **Group chats** with multi-AI interactions
- **WeChat-inspired Moments** (social feed)
- **Bilingual support** (English/Chinese)
- **Local-first architecture** (browser storage, no backend)
- **ReAct AI reasoning** with tool calling capabilities

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI framework |
| Vite | 7.2.4 | Build tool & dev server |
| TailwindCSS | 4.1.17 | Styling system |
| React Router | 7.10.1 | Client-side routing |
| Framer Motion | 12.26.2 | Animations |
| Perplexity API | - | AI responses (primary) |
| DeepSeek API | - | AI responses (alternative) |

### Core Capabilities

- **Multi-personality AI**: Each persona has unique personality, speaking style, and interests
- **Group conversations**: Multiple AIs interact with each other and the user
- **ReAct reasoning loop**: AIs can reason, call tools, and refine responses
- **Tool calling**: Execute code, search web, perform math calculations
- **Proactive messaging**: AIs can schedule future messages
- **Context compression**: Handles long conversations efficiently
- **Bilingual UI**: Seamless English/Chinese switching

---

## 🚀 Quick Start for AI Assistants

### Essential Reading Order

1. **First**: Read this entire CLAUDE.md file
2. **Then**: Review `docs/ARCHITECTURE.md` for detailed architecture
3. **Next**: Study `src/core/chat/ChatEngine.js` - the heart of the system
4. **Finally**: Explore `src/core/chat/AIPipeline.js` - AI reasoning logic

### Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with API credentials:
# VITE_AI_API_URL=https://api.perplexity.ai
# VITE_AI_API_KEY=your-key-here
# VITE_AI_MODEL=sonar-pro

# 3. Start development server
npm run dev
# Opens at http://localhost:5173

# 4. Run linter before committing
npm run lint
```

### Key Principles for AI Assistants

1. **Understand before modifying**: Always read existing code before making changes
2. **Follow Clean Architecture**: Respect the layer separation (Presentation → Application → Domain → Infrastructure)
3. **Test your changes**: Manually test in browser, ensure no console errors
4. **Maintain bilingual support**: Add translations for any new UI text
5. **Use existing patterns**: Follow established conventions for naming, structure, and code style
6. **Don't break the core**: ChatEngine and AIPipeline are critical - be extra careful
7. **Think local-first**: All data persists to localStorage, no backend calls

---

## 🏗️ Architecture & Design Patterns

### Clean Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                     │
│  React Components, Pages, UI Elements               │
│  Location: src/pages/, src/features/*/components/   │
└────────────────────┬────────────────────────────────┘
                     │ Props, Events
┌────────────────────▼────────────────────────────────┐
│              APPLICATION LAYER                      │
│  Hooks (useChatService), Context Providers          │
│  Location: src/features/*/hooks/, src/context/      │
└────────────────────┬────────────────────────────────┘
                     │ Commands, Queries
┌────────────────────▼────────────────────────────────┐
│              DOMAIN LAYER (Pure JS)                 │
│  ChatEngine, AIPipeline                            │
│  Location: src/core/                                │
│  ⚠️ NO React dependencies allowed here              │
└────────────────────┬────────────────────────────────┘
                     │ Interface calls
┌────────────────────▼────────────────────────────────┐
│           INFRASTRUCTURE LAYER                      │
│  APIClient, StorageService, External APIs           │
│  Location: src/services/                            │
└─────────────────────────────────────────────────────┘
```

### Design Patterns Used

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Singleton** | ChatEngine | Single source of truth for chat state |
| **Observer** | ChatEngine.subscribe() | Notify components of state changes |
| **Dependency Injection** | AIPipeline constructor | Inject callbacks for events |
| **Facade** | ChatContext | Hide complexity, provide simple API |
| **Strategy** | AI personas | Different behavior implementations |
| **Pipeline** | AIPipeline | Multi-step AI processing |
| **Repository** | StorageService | Abstract storage mechanism |

### Key Architectural Decisions

1. **ChatEngine as Singleton**: Central nervous system managing all chat state
   - Single source of truth
   - Handles persistence automatically
   - Manages AI orchestration

2. **Pure JavaScript Domain Layer**: ChatEngine and AIPipeline have NO React dependencies
   - Testable in isolation
   - Reusable in other contexts (CLI, mobile)
   - Easier to reason about

3. **Observer Pattern for State Updates**: Components subscribe to ChatEngine
   - Decoupled from React's state management
   - Can switch UI frameworks without changing core logic

4. **Callback Injection in AIPipeline**: Pass handlers for typing, messages, scheduling
   - Flexible integration
   - Clear separation of concerns

5. **Local-First Architecture**: All data in localStorage
   - No backend required
   - Privacy-focused
   - Works offline

---

## 📁 Directory Structure

```
Chat_Buddy/
├── public/                         # Static assets
│   ├── avatars/                   # AI persona avatars (256x256 PNG)
│   └── backgrounds/               # Per-persona background images (20+ each)
│
├── src/
│   ├── core/                      # 🔴 DOMAIN LAYER (Pure JS)
│   │   └── chat/
│   │       ├── ChatEngine.js      # State machine, persistence, orchestration
│   │       └── AIPipeline.js      # ReAct loop, tool calling, AI reasoning
│   │
│   ├── services/                  # 🟡 INFRASTRUCTURE LAYER
│   │   ├── api/
│   │   │   ├── APIClient.js       # HTTP client with retry/timeout
│   │   │   └── aiClient.js        # AI API singleton (Perplexity/DeepSeek)
│   │   ├── ai/
│   │   │   └── translationService.js
│   │   ├── storage/
│   │   │   └── StorageService.js  # localStorage abstraction
│   │   └── perplexityService.js   # Perplexity Sonar API
│   │
│   ├── features/                  # 🟢 FEATURE MODULES
│   │   ├── chat/
│   │   │   ├── hooks/
│   │   │   │   └── useChatService.js  # 🔥 Bridge: Domain → React
│   │   │   ├── context/
│   │   │   │   └── ChatContext.jsx    # Facade context
│   │   │   ├── services/
│   │   │   │   ├── chatService.js     # AI calling, compression
│   │   │   │   └── toolService.js     # Tool execution
│   │   │   └── components/
│   │   │       ├── ChatList.jsx
│   │   │       ├── ChatWindow.jsx
│   │   │       ├── CreateChat.jsx
│   │   │       └── window/
│   │   │           ├── ChatComposer.jsx
│   │   │           ├── MessageTimeline.jsx
│   │   │           └── ChatHeader.jsx
│   │   │
│   │   ├── moments/              # Social feed feature
│   │   │   ├── MomentsPage.jsx
│   │   │   ├── components/
│   │   │   ├── context/
│   │   │   └── services/
│   │   │
│   │   └── background/           # Chat background theming
│   │
│   ├── context/                  # 🟠 GLOBAL CONTEXTS
│   │   ├── LanguageContext.jsx   # i18n (en/zh)
│   │   ├── UserContext.jsx       # User profile
│   │   ├── ThemeContext.jsx      # Dark mode, backgrounds
│   │   ├── SocialContext.jsx     # Intimacy, achievements
│   │   └── ...
│   │
│   ├── providers/
│   │   └── AppProviders.jsx      # Context composition
│   │
│   ├── data/                     # 🔵 DATA & CONFIG
│   │   ├── personas.js           # 13 AI personas
│   │   ├── taskAgents.js         # 6 specialized agents
│   │   ├── locales.js            # Translations (en/zh)
│   │   ├── knowledgeGraph.js     # Learning topics
│   │   └── ...
│   │
│   ├── components/               # Shared UI components
│   ├── pages/                    # Route pages
│   ├── hooks/                    # Custom hooks
│   ├── utils/                    # Utility functions
│   │   ├── formatTime.js
│   │   ├── fileUtils.js
│   │   └── cn.js
│   │
│   ├── App.jsx                   # Router setup
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Global styles + CSS variables
│
├── docs/
│   ├── ARCHITECTURE.md           # Detailed architecture
│   └── DEVELOPMENT.md            # Dev setup guide
│
├── .env.example                  # Environment template
├── vite.config.js               # Vite configuration
├── eslint.config.js             # ESLint rules
├── package.json                 # Dependencies
└── CLAUDE.md                    # 👈 You are here
```

### Important Path Patterns

- **Components**: `src/features/{feature}/components/`
- **Hooks**: `src/features/{feature}/hooks/`
- **Services**: `src/features/{feature}/services/`
- **Contexts**: `src/context/` (global) or `src/features/{feature}/context/` (local)
- **Data**: `src/data/`
- **Core logic**: `src/core/`

---

## 🎛️ Core Systems

### 1. ChatEngine (`src/core/chat/ChatEngine.js`)

**Purpose**: Central state machine managing all chat operations.

**Key Responsibilities**:
- Store and manage all chats and messages
- Persist state to localStorage automatically
- Orchestrate AI responses
- Handle typing indicators
- Manage observers (components subscribe to state changes)

**Critical Methods**:

```javascript
// Initialize with persona definitions
chatEngine.init(personas);

// Create new chat
chatEngine.createChat(name, participantIds, avatar);

// Send user message
chatEngine.sendMessage(chatId, content, senderId, quotedMessageId);

// Subscribe to state changes (returns unsubscribe function)
const unsubscribe = chatEngine.subscribe((newState) => {
    // Update React state
});

// Delete message
chatEngine.deleteMessage(chatId, messageId);

// Update chat properties
chatEngine.updateChat(chatId, updates);

// Pin/unpin message
chatEngine.pinMessage(chatId, messageId, isPinned);
```

**State Structure**:

```javascript
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
                    readBy: ['ai-1', ...]
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

**Internal Workflow**:

```
User sends message
    ↓
ChatEngine.sendMessage() adds to chat.messages
    ↓
Auto-triggers _triggerAIResponse()
    ↓
Determines which AIs should respond based on:
    - Mention detection (@name)
    - Last speaker
    - Recent activity
    - Randomness
    ↓
For each candidate AI:
    aiPipeline.processTurn(chat, personas, ai)
    ↓
    AIPipeline runs ReAct loop
    ↓
    Returns response via _handleAIMessage() callback
    ↓
    ChatEngine adds AI message to chat
    ↓
    Notifies all subscribers
    ↓
    UI re-renders
```

### 2. AIPipeline (`src/core/chat/AIPipeline.js`)

**Purpose**: Implements AI "mental model" - reasoning, tool calling, response generation.

**Key Responsibilities**:
- Run ReAct reasoning loop (Reason → Act → Observe → Repeat)
- Execute tool calls
- Manage context compression
- Handle typing delays and simulations
- Parse special response markers

**Processing Flow**:

```
1. Calculate Delays
   - Read delay (time to "read" messages)
   - Thinking delay (time to "think")

2. Signal Typing to UI

3. Wait for thinking delay

4. Prepare Context
   - Compress old messages if needed
   - Extract last 12 messages for history
   - Merge consecutive messages from same sender
   - Include polls, quoted messages

5. Generate System Prompt
   - Persona: name, personality, style, interests
   - Available tools (for task agents)
   - Instructions: SILENCE, MULTI, SCHEDULE markers

6. Run ReAct Loop (max depth: 3)
   - Call LLM with history
   - Check response for [TOOL_CALL:name {...args}]
   - If found:
       → Execute tool via toolService
       → Append result to history
       → Recurse (depth + 1)
   - If not found or max depth:
       → Proceed to final response

7. Parse Final Response
   - Extract [SCHEDULE:15] → Schedule proactive message in 15 mins
   - Extract [MULTI:msg1|msg2|msg3] → Send multiple messages
   - Extract [SILENCE] → Don't send anything
   - Send each message with typing simulation
```

**Special Response Markers**:

```javascript
// Don't send message
"[SILENCE]"

// Send multiple messages sequentially
"[MULTI:First message|Second message|Third message]"

// Schedule proactive message in N minutes
"[SCHEDULE:15]I'll check back later!"

// Execute tool and continue reasoning
"[TOOL_CALL: execute_code {"code": "2 + 2"}]"
```

**Tool Call Format**:

```javascript
// AI response contains:
"Let me calculate that. [TOOL_CALL: execute_math {\"expression\": \"integrate(x^2, x)\"}]"

// AIPipeline extracts and executes:
{
    name: 'execute_math',
    args: { expression: 'integrate(x^2, x)' }
}

// Tool returns result:
"Result: x^3/3 + C"

// Appended to history, LLM called again:
// AI now has tool result and can explain
```

### 3. useChatService Hook (`src/features/chat/hooks/useChatService.js`)

**Purpose**: Bridge between ChatEngine (domain) and React components (presentation).

**What it provides**:

```javascript
const {
    // State
    chats,                    // All chats array
    typingIndicators,         // { chatId: [aiIds] }
    personas,                 // All AI personas
    currentUser,              // User profile

    // Actions
    sendMessage,              // Send user message
    createChat,               // Create new chat
    deleteChat,               // Delete chat
    updateChat,               // Update chat properties
    deleteMessage,            // Delete message
    pinMessage,               // Pin/unpin message
    votePoll,                 // Vote in poll
    addReaction,              // Add emoji reaction
    removeReaction            // Remove emoji reaction
} = useChatService();
```

**Usage in Components**:

```javascript
import { useChatService } from '../hooks/useChatService';

export default function ChatWindow({ chatId }) {
    const { chats, sendMessage, typingIndicators } = useChatService();
    const chat = chats.find(c => c.id === chatId);

    const handleSend = (content) => {
        sendMessage(chatId, content, 'user-me');
    };

    return (
        <div>
            {/* Render messages, typing indicators, etc. */}
        </div>
    );
}
```

### 4. Context Hierarchy

All contexts are composed in `src/providers/AppProviders.jsx`:

```javascript
export default function AppProviders({ children }) {
    return (
        <LanguageProvider>        {/* i18n */}
            <ThemeProvider>       {/* Dark mode, backgrounds */}
                <NotificationProvider>  {/* Toast notifications */}
                    <SocialProvider>    {/* Intimacy, achievements */}
                        <StickerProvider>
                            <DocumentProvider>
                                <UserProvider>
                                    <FriendProvider>
                                        <MomentsProvider>
                                            <ChatProvider>  {/* useChatService */}
                                                <BackgroundProvider>
                                                    {children}
                                                </BackgroundProvider>
                                            </ChatProvider>
                                        </MomentsProvider>
                                    </FriendProvider>
                                </UserProvider>
                            </DocumentProvider>
                        </StickerProvider>
                    </SocialProvider>
                </NotificationProvider>
            </ThemeProvider>
        </LanguageProvider>
    );
}
```

### 5. Data Models

#### AI Persona

```javascript
{
    id: 'ai-1',                          // Unique identifier
    name: 'Luna',                        // English name
    name_zh: '露娜',                     // Chinese name
    avatar: '/avatars/avatar1.png',      // Avatar path
    personality: 'Dreamer, empathetic...', // Personality description (en)
    personality_zh: '梦想家，善解人意...',  // Personality (zh)
    interests: ['astrology', 'art'],     // List of interests
    style: 'Poetic, thoughtful...',      // Speaking style
    color: 'bg-purple-100 text-purple-800', // Theme color
    responseDelay: { min: 1000, max: 2500 }, // Response delay (ms)
    readDelay: { min: 500, max: 1500 },  // Read delay (ms)
    typingSpeed: 'normal'                // 'fast' | 'normal' | 'slow'
}
```

#### Task Agent

```javascript
{
    id: 'agent-coder',
    name: 'Coder',
    agentType: 'task-specialist',
    category: 'productivity',
    systemPrompt: 'You are a programming assistant...',
    skills: ['programming', 'debugging', 'code-review'],
    tools: [
        {
            name: 'execute_code',
            description: 'Execute JavaScript code'
        }
    ],
    toolsEnabled: true,
    responseDelay: { min: 800, max: 2000 },
    readDelay: { min: 400, max: 1000 },
    typingSpeed: 'fast'
}
```

#### Chat

```javascript
{
    id: 'uuid',
    name: 'Chat with Luna',
    avatar: null,
    participants: ['user-me', 'ai-1'],
    admins: ['user-me'],
    messages: [Message],
    theme: 'default',
    settings: {
        muteValues: { 'ai-1': false }
    },
    polls: [],
    pinnedMessages: [],
    backgroundId: 'luna-1',
    lastMessage: Message,
    updatedAt: '2026-02-08T10:30:00Z',
    createdAt: '2026-02-08T09:00:00Z'
}
```

#### Message

```javascript
{
    id: 'uuid',
    senderId: 'user-me' | 'ai-1',
    content: 'Hello!',
    timestamp: '2026-02-08T10:30:00Z',
    status: 'sent' | 'delivered' | 'read',
    quotedMessageId?: 'uuid',  // Reply-to message
    readBy: ['ai-1'],
    reactions?: {
        '😀': ['user-me'],
        '❤️': ['ai-1']
    }
}
```

---

## 🔧 Development Workflows

### Adding a New AI Persona

**File**: `src/data/personas.js`

```javascript
// 1. Add to INITIAL_PERSONAS array
{
    id: 'ai-new',                    // Unique ID
    name: 'CharacterName',
    name_zh: '角色名',
    avatar: '/avatars/avatar_new.png',
    personality: 'Description...',
    personality_zh: '描述...',
    interests: ['interest1', 'interest2'],
    style: 'Speaking style...',
    color: 'bg-blue-100 text-blue-800',
    responseDelay: { min: 1000, max: 2500 },
    readDelay: { min: 500, max: 1500 },
    typingSpeed: 'normal'
}

// 2. Add avatar image
// public/avatars/avatar_new.png (256x256 recommended)

// 3. Optional: Add 20+ background images
// public/backgrounds/avatar_new/bg-1.png
// public/backgrounds/avatar_new/bg-2.png
// ...

// 4. Add translations to src/data/locales.js
```

### Adding a New Task Agent with Tools

**File**: `src/data/taskAgents.js`

```javascript
// 1. Add to TASK_AGENTS array
{
    id: 'agent-newtype',
    name: 'NewAgent',
    agentType: 'task-specialist',
    category: 'productivity',  // 'productivity' | 'education' | 'creative'
    systemPrompt: `You are a specialized AI assistant that...

Available tools:
- tool_name: Description of what it does

Instructions:
- Use tools when appropriate
- Format: [TOOL_CALL: tool_name {"arg": "value"}]
`,
    skills: ['skill1', 'skill2'],
    tools: [
        {
            name: 'tool_name',
            description: 'What the tool does'
        }
    ],
    toolsEnabled: true,
    responseDelay: { min: 800, max: 2000 },
    readDelay: { min: 400, max: 1000 },
    typingSpeed: 'fast'
}
```

**File**: `src/features/chat/services/toolService.js`

```javascript
// 2. Implement the tool
async function executeToolName(args) {
    try {
        // Tool implementation
        const result = someOperation(args);
        return `Result: ${result}`;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

// 3. Add case to executeTool() switch
export async function executeTool(toolName, args) {
    switch (toolName) {
        case 'tool_name':
            return await executeToolName(args);

        // ... existing tools

        default:
            return `Unknown tool: ${toolName}`;
    }
}
```

### Adding New Translation Keys

**File**: `src/data/locales.js`

```javascript
export const translations = {
    en: {
        // Add your key
        new_feature_title: 'New Feature',
        new_feature_description: 'This is a new feature',
    },
    zh: {
        // Add Chinese translation
        new_feature_title: '新功能',
        new_feature_description: '这是一个新功能',
    }
};
```

**Usage in Components**:

```javascript
import { useLanguage } from '../context/LanguageContext';

export default function MyComponent() {
    const { t } = useLanguage();

    return (
        <div>
            <h1>{t('new_feature_title')}</h1>
            <p>{t('new_feature_description')}</p>
        </div>
    );
}
```

### Creating a New Feature Module

```bash
# 1. Create feature directory
mkdir -p src/features/my-feature/{components,hooks,context,services}

# 2. Create files
touch src/features/my-feature/MyFeaturePage.jsx
touch src/features/my-feature/hooks/useMyFeature.js
touch src/features/my-feature/context/MyFeatureContext.jsx
touch src/features/my-feature/services/myFeatureService.js

# 3. Follow the pattern:
# - Page component in root
# - Hooks for logic
# - Context for state
# - Services for external interactions
```

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit frequently
git add .
git commit -m "feat: add new feature X"

# 3. Follow Conventional Commits:
# - feat: New feature
# - fix: Bug fix
# - docs: Documentation
# - style: Formatting
# - refactor: Code restructuring
# - test: Tests
# - chore: Maintenance

# 4. Push to remote
git push -u origin feature/my-feature

# 5. Create pull request on GitHub
```

---

## 📝 Common Tasks

### Task 1: Modify an Existing Persona

```javascript
// File: src/data/personas.js

// Find the persona by id and modify properties:
{
    id: 'ai-1',
    name: 'Luna',
    // Change personality
    personality: 'New personality description...',
    personality_zh: '新的性格描述...',

    // Adjust response speed
    responseDelay: { min: 500, max: 1500 },  // Faster

    // Change speaking style
    style: 'More casual and friendly...'
}

// Changes take effect immediately on reload
```

### Task 2: Add a New Tool to Existing Agent

```javascript
// 1. Update agent definition in src/data/taskAgents.js
{
    id: 'agent-coder',
    // ... existing properties
    tools: [
        // ... existing tools
        {
            name: 'new_tool',
            description: 'What this tool does'
        }
    ]
}

// 2. Update systemPrompt to document the tool
systemPrompt: `
Available tools:
- new_tool: Description and usage instructions
...
`

// 3. Implement in src/features/chat/services/toolService.js
async function executeNewTool(args) {
    // Implementation
    return result;
}

export async function executeTool(toolName, args) {
    switch (toolName) {
        case 'new_tool':
            return await executeNewTool(args);
        // ... other cases
    }
}
```

### Task 3: Change AI API Provider

```javascript
// Option A: Change environment variables
// File: .env
VITE_AI_API_URL=https://api.openai.com/v1
VITE_AI_API_KEY=sk-...
VITE_AI_MODEL=gpt-4o-mini

// Option B: Use DeepSeek
VITE_AI_API_URL=https://api.deepseek.com
VITE_AI_API_KEY=your-key
VITE_AI_MODEL=deepseek-chat

// Option C: Modify code
// File: src/services/api/aiClient.js
const aiClient = new APIClient(
    import.meta.env.VITE_AI_API_URL || 'https://api.perplexity.ai',
    {
        'Authorization': `Bearer ${import.meta.env.VITE_AI_API_KEY}`,
        'Content-Type': 'application/json'
    }
);
```

### Task 4: Adjust Context Compression

```javascript
// File: src/features/chat/services/chatService.js

// Find the compression logic:
if (messages.length > 20) {  // Change threshold here
    const recentMessages = messages.slice(-12);  // Keep last N messages
    const oldMessages = messages.slice(0, -12);

    const summary = await summarizeMessages(oldMessages);
    // ...
}
```

### Task 5: Add New Page/Route

```javascript
// 1. Create page component
// File: src/pages/MyNewPage.jsx
export default function MyNewPage() {
    return <div>My New Page</div>;
}

// 2. Add route
// File: src/App.jsx
import MyNewPage from './pages/MyNewPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Layout />}>
                    {/* Existing routes */}
                    <Route path="/my-page" element={<MyNewPage />} />
                </Route>
            </Routes>
        </Router>
    );
}

// 3. Add navigation link if needed
// File: src/components/Layout.jsx
<Link to="/my-page">My Page</Link>
```

### Task 6: Debug AI Response Issues

```javascript
// 1. Check console for logs
// Look for: [AIPipeline], [ChatEngine], [APIClient]

// 2. Verify API key
console.log('API Key configured:', !!import.meta.env.VITE_AI_API_KEY);

// 3. Check network tab
// Look for requests to API endpoint, check response

// 4. Add temporary logging
// File: src/core/chat/AIPipeline.js
async _runReActLoop(chatId, ai, systemPrompt, history, depth = 0) {
    console.log('Running ReAct loop', { chatId, ai: ai.id, depth });
    console.log('History:', history);
    console.log('System prompt:', systemPrompt);
    // ...
}

// 5. Check persona configuration
// Ensure responseDelay, readDelay are reasonable

// 6. Test with simple message
// Send "Hello" and verify response
```

---

## 🎨 Important Patterns

### Pattern 1: State Subscription (Observer)

```javascript
// ChatEngine exposes subscribe() for state updates
// Components use this to stay in sync

// ✅ DO: Use in hooks or effects
useEffect(() => {
    const unsubscribe = chatEngine.subscribe((newState) => {
        setState(newState);
    });
    return unsubscribe;  // Cleanup on unmount
}, []);

// ❌ DON'T: Subscribe without cleanup
useEffect(() => {
    chatEngine.subscribe((newState) => setState(newState));
    // Missing: return unsubscribe
});
```

### Pattern 2: Domain Layer Purity

```javascript
// ✅ DO: Keep core/ pure JavaScript
// File: src/core/chat/ChatEngine.js
class ChatEngine {
    sendMessage(chatId, content, senderId) {
        // Pure logic, no React dependencies
        const message = { id: uuid(), content, senderId, timestamp: new Date().toISOString() };
        this.state.chats = this.state.chats.map(chat =>
            chat.id === chatId
                ? { ...chat, messages: [...chat.messages, message] }
                : chat
        );
        this._notifySubscribers();
    }
}

// ❌ DON'T: Use React in domain layer
class ChatEngine {
    sendMessage(chatId, content) {
        const [state, setState] = useState();  // ❌ NO!
        // ...
    }
}
```

### Pattern 3: Callback Injection

```javascript
// ✅ DO: Pass callbacks to decouple domain from infrastructure
const aiPipeline = new AIPipeline({
    onTyping: (chatId, aiId, isTyping) => {
        chatEngine.setTyping(chatId, aiId, isTyping);
    },
    onMessage: (chatId, content, aiId) => {
        chatEngine._handleAIMessage(chatId, content, aiId);
    }
});

// ❌ DON'T: Direct dependencies
class AIPipeline {
    sendMessage() {
        chatEngine.addMessage();  // ❌ Tight coupling
    }
}
```

### Pattern 4: Context Facade

```javascript
// ✅ DO: Provide simple API via context
export function ChatProvider({ children }) {
    const chatService = useChatService();
    return (
        <ChatContext.Provider value={chatService}>
            {children}
        </ChatContext.Provider>
    );
}

// Components consume via hook
export function useChat() {
    return useContext(ChatContext);
}

// ❌ DON'T: Expose complex internals
export function ChatProvider({ children }) {
    return (
        <ChatContext.Provider value={chatEngine}>
            {children}
        </ChatContext.Provider>
    );
}
```

### Pattern 5: Bilingual Support

```javascript
// ✅ DO: Use translation system
export default function MyComponent() {
    const { t } = useLanguage();
    return <button>{t('button_label')}</button>;
}

// Add both languages in locales.js:
en: { button_label: 'Click me' },
zh: { button_label: '点击我' }

// ❌ DON'T: Hardcode strings
export default function MyComponent() {
    return <button>Click me</button>;  // ❌ No i18n
}
```

### Pattern 6: Error Handling

```javascript
// ✅ DO: Handle errors gracefully
async function callAI(messages) {
    try {
        const response = await apiClient.post('/chat/completions', {
            messages
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error('[ChatService] AI call failed:', error);
        return '[Error: Could not get response from AI]';
    }
}

// ❌ DON'T: Let errors bubble unhandled
async function callAI(messages) {
    const response = await apiClient.post('/chat/completions', { messages });
    return response.choices[0].message.content;
}
```

### Pattern 7: Tool Call Format

```javascript
// ✅ DO: Follow the exact format
"Let me calculate: [TOOL_CALL: execute_math {\"expression\": \"2+2\"}]"

// Parsed as:
{
    name: 'execute_math',
    args: { expression: '2+2' }
}

// ❌ DON'T: Use incorrect format
"[TOOL: math, expression=2+2]"  // ❌ Wrong format
"TOOL_CALL execute_math 2+2"   // ❌ Wrong format
```

---

## 🧪 Testing Strategy

### Current Status

- **No formal test framework configured**
- Manual testing in browser required
- Future: Add Vitest + React Testing Library

### Recommended Testing Approach

#### Unit Tests (Core Logic)

```javascript
// Test: src/core/chat/ChatEngine.test.js
describe('ChatEngine', () => {
    test('sendMessage adds message to chat', () => {
        const engine = new ChatEngine();
        engine.init(mockPersonas);
        const chat = engine.createChat('Test', ['user-me', 'ai-1']);

        engine.sendMessage(chat.id, 'Hello', 'user-me');

        const updated = engine.state.chats.find(c => c.id === chat.id);
        expect(updated.messages).toHaveLength(1);
        expect(updated.messages[0].content).toBe('Hello');
    });
});

// Test: src/core/chat/AIPipeline.test.js
describe('AIPipeline', () => {
    test('parses MULTI marker correctly', () => {
        const response = '[MULTI:First|Second|Third]';
        const messages = parseMultiResponse(response);
        expect(messages).toEqual(['First', 'Second', 'Third']);
    });
});
```

#### Integration Tests (Services)

```javascript
// Test: src/features/chat/hooks/useChatService.test.js
describe('useChatService', () => {
    test('initializes ChatEngine on mount', () => {
        const { result } = renderHook(() => useChatService());
        expect(result.current.chats).toBeDefined();
        expect(result.current.personas).toHaveLength(19);  // 13 personas + 6 agents
    });
});
```

#### Component Tests

```javascript
// Test: src/features/chat/ChatWindow.test.jsx
describe('ChatWindow', () => {
    test('renders messages', () => {
        render(<ChatWindow chatId="test-chat" />);
        expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    test('sends message on Enter', async () => {
        const { user } = render(<ChatWindow chatId="test-chat" />);
        const input = screen.getByRole('textbox');

        await user.type(input, 'Test message{Enter}');

        expect(screen.getByText('Test message')).toBeInTheDocument();
    });
});
```

### Manual Testing Checklist

When making changes, test:

- [ ] Create new chat (1-on-1 and group)
- [ ] Send messages (text, with @mentions)
- [ ] AI responses arrive correctly
- [ ] Typing indicators show/hide
- [ ] Tool calls execute (for task agents)
- [ ] Multi-message responses work
- [ ] Reply-to (quoted messages) works
- [ ] Emoji reactions work
- [ ] Language switching (EN ↔ ZH)
- [ ] Dark mode toggle
- [ ] Background changes
- [ ] LocalStorage persistence (refresh page)
- [ ] Check console for errors
- [ ] Check Network tab for API calls

---

## 🐛 Debugging Guide

### Console Logging

All major systems log with prefixes:

```javascript
// ChatEngine
console.log('[ChatEngine] Message sent:', message);

// AIPipeline
console.log('[AIPipeline] Running ReAct loop', { depth, chatId });

// APIClient
console.log('[APIClient] Request:', { method, url, data });

// ToolService
console.log('[ToolService] Executing tool:', { name, args });

// StorageService
console.log('[StorageService] Saving:', key);
```

### Browser DevTools

#### Application Tab → LocalStorage

Check stored data:
- `chat-buddy-chats` - All chats and messages
- `chat-buddy-user` - User profile
- `chat-buddy-social` - Intimacy, achievements
- `chat-buddy-language` - Language preference

#### Network Tab

Monitor API calls:
- Requests to Perplexity/DeepSeek API
- Check request/response bodies
- Look for 401 (auth error), 429 (rate limit)

#### Console Tab

Look for:
- Error messages
- Warning about missing API key
- Validation errors
- State mutation logs

### Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **AI not responding** | Messages sent but no AI reply | • Check `.env` has valid `VITE_AI_API_KEY`<br>• Check Network tab for API errors<br>• Verify API endpoint is correct |
| **Slow responses** | Long delay before AI replies | • Check `responseDelay` in persona config<br>• Reduce `readDelay` and `responseDelay` values<br>• Use faster AI model |
| **Tool calls failing** | Tools not executing | • Check `toolsEnabled: true` in agent<br>• Verify tool implementation in `toolService.js`<br>• Check console for tool errors |
| **UI not updating** | Changes not reflected | • Verify `ChatProvider` wraps components<br>• Check subscription cleanup in useEffect<br>• Ensure state mutations notify subscribers |
| **LocalStorage full** | Quota exceeded error | • Clear old chats from localStorage<br>• Implement data pruning<br>• Use compression |
| **Translation missing** | Shows key instead of text | • Add key to both `en` and `zh` in `locales.js`<br>• Check spelling of translation key |
| **Build errors** | Vite build fails | • Run `npm run lint` to find issues<br>• Check for unused imports<br>• Verify all files use correct paths |

### Debugging Workflow

1. **Reproduce the issue**
   - Identify exact steps to trigger bug

2. **Check console first**
   - Look for error messages, warnings

3. **Add logging**
   - Insert `console.log()` at key points
   - Track data flow through system

4. **Isolate the problem**
   - Is it in domain layer (ChatEngine, AIPipeline)?
   - Is it in presentation layer (React components)?
   - Is it in infrastructure (API, storage)?

5. **Test in isolation**
   - If domain layer: Test without React
   - If component: Render in isolation
   - If API: Test with curl/Postman

6. **Fix and verify**
   - Make minimal change
   - Test thoroughly
   - Remove temporary logging

---

## 📚 Key Files Reference

### Critical Files (⭐⭐⭐⭐⭐ - Don't break these)

| File | Purpose | Lines | Key Exports |
|------|---------|-------|-------------|
| `src/core/chat/ChatEngine.js` | State machine, orchestration | 314 | `chatEngine` (singleton) |
| `src/core/chat/AIPipeline.js` | AI reasoning, tool calling | 244 | `AIPipeline` (class) |
| `src/features/chat/hooks/useChatService.js` | React bridge | 56 | `useChatService()` hook |

### Important Files (⭐⭐⭐⭐ - Modify carefully)

| File | Purpose | Lines | Key Exports |
|------|---------|-------|-------------|
| `src/features/chat/context/ChatContext.jsx` | State provider | 59 | `ChatProvider`, `useChat()` |
| `src/features/chat/services/chatService.js` | AI calling | 200+ | `callAI()`, `compressContext()` |
| `src/features/chat/services/toolService.js` | Tool execution | 400+ | `executeTool()` |
| `src/services/api/APIClient.js` | HTTP client | 119 | `APIClient` (class) |
| `src/services/storage/StorageService.js` | Persistence | 95 | `StorageService` (class) |

### Configuration Files (⭐⭐⭐ - Safe to modify)

| File | Purpose | Key Contents |
|------|---------|--------------|
| `src/data/personas.js` | AI character definitions | `INITIAL_PERSONAS` array |
| `src/data/taskAgents.js` | Task agent definitions | `TASK_AGENTS` array |
| `src/data/locales.js` | Translations | `translations.en`, `translations.zh` |
| `.env` | Environment config | API credentials |
| `vite.config.js` | Build configuration | Vite plugins, settings |
| `tailwind.config.js` | Styling configuration | Theme, colors, fonts |

### UI Components (⭐⭐ - Modify freely)

| File | Purpose |
|------|---------|
| `src/features/chat/ChatWindow.jsx` | Main chat interface |
| `src/features/chat/ChatList.jsx` | Chat sidebar |
| `src/features/chat/CreateChat.jsx` | New chat modal |
| `src/features/chat/components/window/ChatComposer.jsx` | Message input |
| `src/features/chat/components/window/MessageTimeline.jsx` | Message list |
| `src/components/Layout.jsx` | App layout with sidebar |
| `src/pages/Dashboard.jsx` | Home page |
| `src/pages/Settings.jsx` | Settings page |

---

## 🎓 Learning Resources

### Read These First

1. **ARCHITECTURE.md** - Detailed architecture documentation (bilingual)
2. **DEVELOPMENT.md** - Development setup and workflows
3. **README.md** - Project overview and features

### Understand These Concepts

- **Clean Architecture** - Layer separation, dependency direction
- **Observer Pattern** - How ChatEngine notifies components
- **ReAct Loop** - Reasoning + Acting cycle in AIPipeline
- **Dependency Injection** - How callbacks decouple systems
- **Context API** - React's state sharing mechanism

### External Documentation

- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [Perplexity API Docs](https://docs.perplexity.ai/)
- [DeepSeek API Docs](https://platform.deepseek.com/api-docs/)

---

## ✅ Checklist for AI Assistants

Before making ANY changes:

- [ ] I have read this entire CLAUDE.md file
- [ ] I understand the Clean Architecture pattern used
- [ ] I know where ChatEngine and AIPipeline fit in
- [ ] I've read the existing code I'm about to modify
- [ ] I understand the observer pattern for state updates
- [ ] I know how to add bilingual translations

When adding new features:

- [ ] I'm adding to the correct layer (Presentation/Application/Domain/Infrastructure)
- [ ] I'm following existing naming conventions
- [ ] I'm adding translations for any new UI text
- [ ] I'm handling errors gracefully
- [ ] I'm adding console logs for debugging
- [ ] I'm not breaking backward compatibility

Before committing:

- [ ] I've tested in the browser manually
- [ ] There are no console errors
- [ ] `npm run lint` passes
- [ ] All new UI text has translations (en + zh)
- [ ] I've followed Conventional Commits format
- [ ] I've updated relevant documentation

---

## 🤝 Getting Help

### In This Repository

- Read `docs/ARCHITECTURE.md` for deep dive
- Check `docs/DEVELOPMENT.md` for setup issues
- Review existing similar code for patterns

### External Resources

- React DevTools - Inspect component tree
- Browser DevTools - Debug runtime issues
- GitHub Issues - Report bugs

---

## 📄 License

MIT License - see LICENSE file for details.

---

**Last Updated**: 2026-02-08
**Version**: 0.3.1
**Maintained by**: Chat Buddy Development Team

---

*This document is specifically designed for AI assistants (like Claude) working on the Chat Buddy codebase. It provides architectural context, development patterns, and practical guidance for making contributions safely and effectively.*
