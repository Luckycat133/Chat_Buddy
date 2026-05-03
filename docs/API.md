# Chat Buddy — API Reference

## Overview

Chat Buddy is a client-side AI chat application. It connects to AI providers (OpenAI, Anthropic, Perplexity) through proxy endpoints. All API keys are managed client-side via the settings panel and stored in `sessionStorage`.

## API Client Architecture

```
User Input → APIClient → API Proxy (/proxy/*) → AI Provider
                                        ↓
User Display ← ChatEngine ← AIPipeline ←
```

## Core Endpoints

All endpoints are proxied through the development server or an Nginx gateway in production.

### Chat Completion

**POST** `/proxy/openai/v1/chat/completions`

```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.7,
  "max_tokens": 2048
}
```

### Anthropic Messages

**POST** `/proxy/anthropic/v1/messages`

Headers: `x-api-key`, `anthropic-version`

### Perplexity Search

**POST** `/proxy/perplexity/chat/completions`

```json
{
  "model": "sonar-pro",
  "messages": [...]
}
```

## APIClient Usage

```javascript
import { callAI } from '../features/chat/services/chatService';

const response = await callAI(
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  { maxTokens: 1024, temperature: 0.7 }
);
```

## APIClient Configuration

The `APIClient` class supports:

| Method | Description |
|---|---|
| `sendChatMessage(messages, options)` | Send a chat completion request |
| `setEndpoint(url)` | Override the API endpoint |
| `setApiKey(key)` | Set API key for authentication |
| `abort()` | Cancel an in-flight request |

## Error Handling

APIClient returns structured errors:

```javascript
try {
  await apiClient.sendChatMessage(messages);
} catch (error) {
  // error.code: 'NETWORK_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'AUTH_ERROR' | 'API_ERROR'
  // error.message: human-readable message
  // error.status: HTTP status code (if applicable)
}
```

## Storage Service

### Chat Storage (IndexedDB)

```javascript
import chatStorage from '../services/storage/ChatStorageService';

await chatStorage.saveChats(chats);
const loaded = await chatStorage.loadChats();
await chatStorage.clearAll();
```

### Key-Value Storage (localStorage)

```javascript
import { storage } from '../services/storage/StorageService';

storage.set('theme', 'dark');
const theme = storage.get('theme', 'dark');
storage.remove('theme');
```

## Chat Engine

```javascript
import { chatEngine } from '../core/chat/ChatEngine';

chatEngine.init(personas);

chatEngine.sendMessage(chatId, 'Hello!', 'user-me');
chatEngine.sendMessage(chatId, 'Hi there!', 'persona-1');

chatEngine.subscribe((state) => {
  const { chats, typingIndicators, presenceMap } = state;
});

chatEngine.createChat('New Group', ['persona-1', 'persona-2']);
chatEngine.deleteChat(chatId);
chatEngine.destroy();
```

## Personas

The app ships with 13 built-in personas:

| ID | Name | Agent Type | Description |
|---|---|---|---|
| `miku` | Miku | social | Iconic virtual singer |
| `goku` | Goku | social | Saiyan warrior |
| `sailor-moon` | Sailor Moon | social | Guardian of love and justice |
| `levi` | Levi | social | Humanity's strongest soldier |
| `sakura` | Sakura | social | Magical girl warrior |
| `luffy` | Luffy | social | Future Pirate King |
| `naruto` | Naruto | social | Future Hokage |
| `hinata` | Hinata | social | Byakugan princess |
| `gojo` | Gojo | social | The strongest sorcerer |
| `task-architect` | Architect | task-specialist | Technical assistant |
| `tool-agent` | Agent | task-specialist | Multi-mode assistant |

## Events

ChatEngine emits these state properties:

| Property | Type | Description |
|---|---|---|
| `chats` | `Array<Chat>` | All chats sorted by activity |
| `typingIndicators` | `Record<string, string[]>` | Active typing indicators per chat |
| `editingIndicators` | `Record<string, Set>` | Active editing indicators per chat |
| `presenceMap` | `Record<string, string>` | Online/offline/idle status per persona |
| `moodMap` | `Record<string, object>` | Mood object per persona |
