# 测试实施指南 - Chat Buddy 项目

> **目标**: 从0%测试覆盖率提升到70%+
> **时间**: 4-6周
> **策略**: 从简单到复杂，从工具函数到核心逻辑

---

## 📋 目录

1. [Phase 1: 搭建测试基础设施](#phase-1-搭建测试基础设施-第1周)
2. [Phase 2: 编写工具函数测试](#phase-2-编写工具函数测试-第1-2周)
3. [Phase 3: 编写核心逻辑测试](#phase-3-编写核心逻辑测试-第2-3周)
4. [Phase 4: 编写服务层测试](#phase-4-编写服务层测试-第3-4周)
5. [Phase 5: 配置CI/CD](#phase-5-配置cicd-第4-5周)
6. [最佳实践与技巧](#最佳实践与技巧)

---

## Phase 1: 搭建测试基础设施 (第1周)

### 步骤 1.1: 安装依赖

```bash
# 安装Vitest和测试库
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom happy-dom
```

### 步骤 1.2: 创建Vitest配置文件

创建 `vitest.config.js` 在项目根目录：

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules', 'dist', 'public'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/data/**',           // 静态数据
        'src/test/**',           // 测试工具
        'src/main.jsx',          // React入口
        'src/utils/cn.js',       // 简单封装
        'src/**/*.test.{js,jsx}' // 测试文件本身
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### 步骤 1.3: 创建测试设置文件

创建 `src/test/setup.js`:

```javascript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// 扩展expect匹配器
expect.extend(matchers);

// 每个测试后清理
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};

  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

global.localStorage = localStorageMock;

// Mock环境变量
vi.stubEnv('VITE_AI_API_URL', 'https://api.test.com');
vi.stubEnv('VITE_AI_API_KEY', 'test-key-123');
vi.stubEnv('VITE_AI_MODEL', 'test-model');
```

### 步骤 1.4: 创建测试工具目录

```bash
mkdir -p src/test/mocks
mkdir -p src/test/fixtures
mkdir -p src/test/helpers
```

创建 `src/test/mocks/mockPersonas.js`:

```javascript
export const mockPersonas = [
  {
    id: 'ai-1',
    name: 'TestAI',
    name_zh: '测试AI',
    avatar: '/avatars/test.png',
    personality: 'Test personality',
    personality_zh: '测试性格',
    interests: ['testing'],
    style: 'Professional',
    color: 'bg-blue-100 text-blue-800',
    responseDelay: { min: 100, max: 200 },
    readDelay: { min: 50, max: 100 },
    typingSpeed: 'fast'
  }
];

export const mockTaskAgent = {
  id: 'agent-test',
  name: 'TestAgent',
  agentType: 'task-specialist',
  category: 'productivity',
  systemPrompt: 'You are a test agent',
  skills: ['testing'],
  tools: [
    {
      name: 'test_tool',
      description: 'A test tool'
    }
  ],
  toolsEnabled: true,
  responseDelay: { min: 100, max: 200 },
  readDelay: { min: 50, max: 100 },
  typingSpeed: 'fast'
};
```

### 步骤 1.5: 更新package.json

在 `package.json` 中添加测试脚本：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:coverage:ui": "vitest --ui --coverage"
  }
}
```

### 步骤 1.6: 验证安装

```bash
# 运行测试（此时应该显示0个测试）
npm run test

# 打开测试UI
npm run test:ui
```

✅ **Phase 1 完成标志**: 运行 `npm run test` 无错误，显示 "No test files found"

---

## Phase 2: 编写工具函数测试 (第1-2周)

### 为什么从工具函数开始？
- ✅ 最简单，没有依赖
- ✅ 纯函数，易于测试
- ✅ 快速建立信心
- ✅ 高ROI（代码少但覆盖率高）

### 步骤 2.1: 测试 `formatTime.js` (最简单的起点)

创建 `src/utils/formatTime.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatRelativeTime, formatChatListTime } from './formatTime';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Mock当前时间为固定值
    vi.setSystemTime(new Date('2026-02-08T10:00:00Z'));
  });

  it('应该返回"刚刚"当时间差小于1分钟', () => {
    const timestamp = new Date('2026-02-08T09:59:30Z').toISOString();
    expect(formatRelativeTime(timestamp, 'zh')).toBe('刚刚');
    expect(formatRelativeTime(timestamp, 'en')).toBe('Just now');
  });

  it('应该返回"X分钟前"当时间差小于1小时', () => {
    const timestamp = new Date('2026-02-08T09:45:00Z').toISOString();
    expect(formatRelativeTime(timestamp, 'zh')).toBe('15分钟前');
    expect(formatRelativeTime(timestamp, 'en')).toBe('15 minutes ago');
  });

  it('应该返回时间当消息在今天', () => {
    const timestamp = new Date('2026-02-08T08:30:00Z').toISOString();
    const result = formatRelativeTime(timestamp, 'zh');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('应该返回"昨天 HH:mm"当消息在昨天', () => {
    const timestamp = new Date('2026-02-07T15:00:00Z').toISOString();
    const result = formatRelativeTime(timestamp, 'zh');
    expect(result).toContain('昨天');
  });

  it('应该返回完整日期当消息在不同年份', () => {
    const timestamp = new Date('2025-12-25T10:00:00Z').toISOString();
    const result = formatRelativeTime(timestamp, 'zh');
    expect(result).toMatch(/2025/);
  });
});

describe('formatChatListTime', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-02-08T10:00:00Z'));
  });

  it('应该返回时间当消息在今天', () => {
    const timestamp = new Date('2026-02-08T09:30:00Z').toISOString();
    const result = formatChatListTime(timestamp, 'zh');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('应该返回"昨天"当消息在昨天', () => {
    const timestamp = new Date('2026-02-07T10:00:00Z').toISOString();
    expect(formatChatListTime(timestamp, 'zh')).toBe('昨天');
    expect(formatChatListTime(timestamp, 'en')).toBe('Yesterday');
  });

  it('应该返回星期几当消息在本周', () => {
    const timestamp = new Date('2026-02-05T10:00:00Z').toISOString();
    const result = formatChatListTime(timestamp, 'zh');
    expect(result).toMatch(/星期/);
  });
});
```

**运行测试**:
```bash
npm run test formatTime.test.js
```

### 步骤 2.2: 测试 `fileUtils.js`

创建 `src/utils/fileUtils.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import {
  getFileExtension,
  isFileTypeSupported,
  formatFileSize,
  validateFile,
  extractTextContent
} from './fileUtils';

describe('getFileExtension', () => {
  it('应该提取文件扩展名', () => {
    expect(getFileExtension('file.js')).toBe('js');
    expect(getFileExtension('document.pdf')).toBe('pdf');
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });

  it('应该处理没有扩展名的文件', () => {
    expect(getFileExtension('README')).toBe('');
    expect(getFileExtension('.gitignore')).toBe('');
  });

  it('应该处理空字符串', () => {
    expect(getFileExtension('')).toBe('');
  });
});

describe('isFileTypeSupported', () => {
  it('应该识别支持的文件类型', () => {
    const supported = ['txt', 'md', 'js', 'jsx', 'json', 'py', 'java', 'cpp'];
    supported.forEach(ext => {
      expect(isFileTypeSupported(ext)).toBe(true);
    });
  });

  it('应该拒绝不支持的文件类型', () => {
    const unsupported = ['exe', 'zip', 'bin', 'dll'];
    unsupported.forEach(ext => {
      expect(isFileTypeSupported(ext)).toBe(false);
    });
  });
});

describe('formatFileSize', () => {
  it('应该格式化字节', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('应该格式化KB', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1536)).toBe('1.50 KB');
    expect(formatFileSize(1048575)).toBe('1024.00 KB');
  });

  it('应该格式化MB', () => {
    expect(formatFileSize(1048576)).toBe('1.00 MB');
    expect(formatFileSize(5242880)).toBe('5.00 MB');
  });

  it('应该处理0字节', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
});

describe('validateFile', () => {
  it('应该通过有效文件', () => {
    const validFile = {
      name: 'test.js',
      size: 1024,
      type: 'text/javascript'
    };
    expect(validateFile(validFile)).toEqual({ valid: true });
  });

  it('应该拒绝超大文件', () => {
    const largeFile = {
      name: 'huge.txt',
      size: 10 * 1024 * 1024, // 10MB
      type: 'text/plain'
    };
    const result = validateFile(largeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('5MB');
  });

  it('应该拒绝不支持的文件类型', () => {
    const unsupportedFile = {
      name: 'malware.exe',
      size: 1024,
      type: 'application/x-msdownload'
    };
    const result = validateFile(unsupportedFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not supported');
  });
});

describe('extractTextContent', () => {
  it('应该格式化JSON文件', () => {
    const json = '{"name":"test","value":123}';
    const result = extractTextContent(json, 'json');
    expect(result).toContain('"name"');
    expect(result).toContain('"test"');
  });

  it('应该移除HTML标签', () => {
    const html = '<div><p>Hello <strong>World</strong></p></div>';
    const result = extractTextContent(html, 'html');
    expect(result).toBe('Hello World');
  });

  it('应该通过纯文本', () => {
    const text = 'Plain text content';
    const result = extractTextContent(text, 'txt');
    expect(result).toBe(text);
  });

  it('应该处理格式错误的JSON', () => {
    const invalidJson = '{invalid json}';
    const result = extractTextContent(invalidJson, 'json');
    expect(result).toBe(invalidJson); // 返回原始文本
  });
});
```

**运行测试**:
```bash
npm run test fileUtils.test.js
npm run test:coverage
```

### 步骤 2.3: 测试 `cleanMessageContent` (最重要的工具函数)

创建 `src/features/chat/services/chatService.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { cleanMessageContent } from './chatService';

describe('cleanMessageContent', () => {
  describe('特殊标记移除', () => {
    it('应该移除MULTI标记', () => {
      expect(cleanMessageContent('[MULTI:hello|world] extra')).toBe('extra');
      expect(cleanMessageContent('[MULTI:a|b|c]')).toBe('');
    });

    it('应该移除SCHEDULE标记', () => {
      expect(cleanMessageContent('Hello [SCHEDULE:30] there')).toBe('Hello there');
      expect(cleanMessageContent('[SCHEDULE:15]Message')).toBe('Message');
    });

    it('应该移除SILENCE标记', () => {
      expect(cleanMessageContent('[SILENCE]')).toBe('');
      expect(cleanMessageContent('[SILENCE] text')).toBe('text');
    });

    it('应该提取REACT标记中的emoji', () => {
      expect(cleanMessageContent('[REACT: 👍]')).toBe('👍');
      expect(cleanMessageContent('[REACT:❤️]')).toBe('❤️');
    });
  });

  describe('参考编号移除', () => {
    it('应该移除引用编号', () => {
      expect(cleanMessageContent('According to sources[1][2]'))
        .toBe('According to sources');
      expect(cleanMessageContent('Text[1][2][3]more'))
        .toBe('Textmore');
    });

    it('应该移除单个括号数字', () => {
      expect(cleanMessageContent('Reference[1] here'))
        .toBe('Reference here');
    });
  });

  describe('Markdown保护', () => {
    it('应该保留Markdown表格的管道符', () => {
      const table = '| Col1 | Col2 |\n|------|------|\n| a    | b    |';
      expect(cleanMessageContent(table)).toBe(table);
    });

    it('应该保留代码块', () => {
      const code = '```js\nconst x = 1;\n```';
      expect(cleanMessageContent(code)).toBe(code);
    });
  });

  describe('嵌套标记处理', () => {
    it('应该处理嵌套的MULTI标记', () => {
      const nested = '[MULTI:[MULTI:a|b]|c]';
      const result = cleanMessageContent(nested);
      expect(result).not.toContain('[MULTI');
    });

    it('应该处理混合标记', () => {
      const mixed = '[SCHEDULE:10]Hello[1] [MULTI:a|b] world';
      const result = cleanMessageContent(mixed);
      expect(result).toBe('Hello world');
    });
  });

  describe('边界情况', () => {
    it('应该处理null和undefined', () => {
      expect(cleanMessageContent(null)).toBe('');
      expect(cleanMessageContent(undefined)).toBe('');
    });

    it('应该处理空字符串', () => {
      expect(cleanMessageContent('')).toBe('');
      expect(cleanMessageContent('   ')).toBe('');
    });

    it('应该处理仅包含标记的消息', () => {
      expect(cleanMessageContent('[MULTI:a|b][SILENCE][SCHEDULE:10]')).toBe('');
    });

    it('应该处理非常长的字符串', () => {
      const longString = 'a'.repeat(10000);
      const result = cleanMessageContent(longString);
      expect(result.length).toBe(10000);
    });
  });

  describe('Unicode和特殊字符', () => {
    it('应该正确处理中文', () => {
      expect(cleanMessageContent('你好[SCHEDULE:10]世界')).toBe('你好世界');
    });

    it('应该正确处理emoji', () => {
      expect(cleanMessageContent('Hello 👋 [SILENCE]')).toBe('Hello 👋');
    });

    it('应该正确处理混合语言', () => {
      expect(cleanMessageContent('Hello你好[1]World世界'))
        .toBe('Hello你好World世界');
    });
  });
});
```

**运行并查看覆盖率**:
```bash
npm run test chatService.test.js
npm run test:coverage
```

### 步骤 2.4: 批量运行所有工具函数测试

完成以下文件的测试：
- ✅ `formatTime.test.js`
- ✅ `fileUtils.test.js`
- ✅ `chatService.test.js` (cleanMessageContent)
- 📝 `ragUtils.test.js` (参考下面的模板)
- 📝 `searchUtils.test.js`
- 📝 `fileGeneration.test.js`

**ragUtils.test.js 快速模板**:

```javascript
import { describe, it, expect } from 'vitest';
import { chunkText, extractKeywords, calculateSimilarity } from './ragUtils';

describe('chunkText', () => {
  it('应该按段落分块', () => {
    const text = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
    const chunks = chunkText(text, 50);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].text).toContain('Paragraph 1');
  });

  it('应该处理空文本', () => {
    expect(chunkText('')).toEqual([]);
  });
});

describe('extractKeywords', () => {
  it('应该提取关键词并过滤停用词', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const keywords = extractKeywords(text);
    expect(keywords).not.toContain('the');
    expect(keywords).toContain('quick');
  });

  it('应该按频率排序', () => {
    const text = 'apple orange apple banana apple orange';
    const keywords = extractKeywords(text);
    expect(keywords[0]).toBe('apple'); // 出现3次
  });
});

describe('calculateSimilarity', () => {
  it('应该返回0对于完全不同的集合', () => {
    expect(calculateSimilarity(new Set(['a']), new Set(['b']))).toBe(0);
  });

  it('应该返回1对于相同的集合', () => {
    expect(calculateSimilarity(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
  });

  it('应该返回正确的Jaccard系数', () => {
    const sim = calculateSimilarity(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']));
    expect(sim).toBeCloseTo(0.5); // 2个交集 / 4个并集
  });
});
```

✅ **Phase 2 完成标志**:
- 运行 `npm run test:coverage`
- 覆盖率达到 **20-30%**
- 所有工具函数测试通过

---

## Phase 3: 编写核心逻辑测试 (第2-3周)

### 步骤 3.1: 测试 `StorageService` (最关键的基础服务)

创建 `src/services/storage/StorageService.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import StorageService from './StorageService';

describe('StorageService', () => {
  let storage;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageService();
  });

  describe('get()', () => {
    it('应该返回存储的值', () => {
      localStorage.setItem('chat-buddy:test', JSON.stringify({ value: 123 }));
      const result = storage.get('test');
      expect(result).toEqual({ value: 123 });
    });

    it('应该返回默认值当键不存在', () => {
      const result = storage.get('nonexistent', { default: true });
      expect(result).toEqual({ default: true });
    });

    it('应该回退到legacy键', () => {
      // 旧格式: chat-buddy-test
      localStorage.setItem('chat-buddy-test', JSON.stringify({ legacy: true }));
      const result = storage.get('test');
      expect(result).toEqual({ legacy: true });
    });

    it('应该处理JSON解析错误', () => {
      localStorage.setItem('chat-buddy:test', 'invalid json{');
      const result = storage.get('test', { error: 'fallback' });
      expect(result).toEqual({ error: 'fallback' });
    });
  });

  describe('set()', () => {
    it('应该存储值', () => {
      storage.set('test', { data: 'value' });
      const stored = localStorage.getItem('chat-buddy:test');
      expect(JSON.parse(stored)).toEqual({ data: 'value' });
    });

    it('应该覆盖已存在的值', () => {
      storage.set('test', 'old');
      storage.set('test', 'new');
      expect(storage.get('test')).toBe('new');
    });
  });

  describe('remove()', () => {
    it('应该移除prefixed键', () => {
      storage.set('test', 'value');
      storage.remove('test');
      expect(storage.get('test')).toBeNull();
    });

    it('应该同时移除legacy键', () => {
      localStorage.setItem('chat-buddy-test', 'old');
      localStorage.setItem('chat-buddy:test', 'new');
      storage.remove('test');
      expect(localStorage.getItem('chat-buddy-test')).toBeNull();
      expect(localStorage.getItem('chat-buddy:test')).toBeNull();
    });
  });

  describe('clear()', () => {
    it('应该只清除chat-buddy前缀的键', () => {
      localStorage.setItem('chat-buddy:test1', 'value');
      localStorage.setItem('other-app:data', 'keep-me');
      storage.clear();
      expect(localStorage.getItem('chat-buddy:test1')).toBeNull();
      expect(localStorage.getItem('other-app:data')).toBe('keep-me');
    });
  });

  describe('_getKey()', () => {
    it('应该保留legacy键不变', () => {
      expect(storage._getKey('chats')).toBe('chat-buddy-chats');
      expect(storage._getKey('user')).toBe('chat-buddy-user');
    });

    it('应该为新键添加前缀', () => {
      expect(storage._getKey('new-feature')).toBe('chat-buddy:new-feature');
    });

    it('应该不重复添加前缀', () => {
      expect(storage._getKey('chat-buddy:test')).toBe('chat-buddy:test');
    });
  });
});
```

### 步骤 3.2: 测试 `ChatEngine` (最核心的状态机)

创建 `src/core/chat/ChatEngine.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatEngine } from './ChatEngine';
import { mockPersonas } from '../../test/mocks/mockPersonas';

describe('ChatEngine', () => {
  let engine;

  beforeEach(() => {
    // 创建新实例并mock持久化
    engine = new ChatEngine();
    engine.personas = mockPersonas;
    engine.chats = [];
    engine.save = vi.fn(() => engine._notify());
    engine._triggerAIResponse = vi.fn();
    engine._checkAutoNaming = vi.fn();
  });

  describe('createChat()', () => {
    it('应该创建一个新聊天', () => {
      const chatId = engine.createChat('Test Chat', ['ai-1']);

      expect(engine.chats).toHaveLength(1);
      expect(engine.chats[0]).toMatchObject({
        id: chatId,
        name: 'Test Chat',
        participants: ['user-me', 'ai-1'],
        admins: ['user-me'],
        messages: [],
        polls: []
      });
    });

    it('应该将新聊天添加到数组开头', () => {
      const chat1 = engine.createChat('Chat 1', ['ai-1']);
      const chat2 = engine.createChat('Chat 2', ['ai-1']);

      expect(engine.chats[0].id).toBe(chat2);
      expect(engine.chats[1].id).toBe(chat1);
    });

    it('应该自动添加user-me到参与者', () => {
      engine.createChat('Test', ['ai-1', 'ai-2']);

      expect(engine.chats[0].participants).toContain('user-me');
      expect(engine.chats[0].participants).toHaveLength(3);
    });
  });

  describe('sendMessage()', () => {
    let chatId;

    beforeEach(() => {
      chatId = engine.createChat('Test Chat', ['ai-1']);
    });

    it('应该发送消息到正确的聊天', () => {
      engine.sendMessage(chatId, 'Hello!', 'user-me');

      const chat = engine.chats.find(c => c.id === chatId);
      expect(chat.messages).toHaveLength(1);
      expect(chat.messages[0]).toMatchObject({
        content: 'Hello!',
        senderId: 'user-me',
        status: 'sent'
      });
    });

    it('应该忽略空消息', () => {
      engine.sendMessage(chatId, '', 'user-me');
      engine.sendMessage(chatId, '   ', 'user-me');

      const chat = engine.chats.find(c => c.id === chatId);
      expect(chat.messages).toHaveLength(0);
    });

    it('应该忽略无效的chatId', () => {
      engine.sendMessage('invalid-id', 'Hello', 'user-me');

      const chat = engine.chats.find(c => c.id === chatId);
      expect(chat.messages).toHaveLength(0);
    });

    it('应该更新lastMessage和updatedAt', () => {
      engine.sendMessage(chatId, 'Test message', 'user-me');

      const chat = engine.chats.find(c => c.id === chatId);
      expect(chat.lastMessage.content).toBe('Test message');
      expect(chat.updatedAt).toBeDefined();
    });

    it('应该触发AI响应（仅对user-me消息）', () => {
      engine.sendMessage(chatId, 'Hello AI', 'user-me');
      expect(engine._triggerAIResponse).toHaveBeenCalledWith(chatId);

      engine._triggerAIResponse.mockClear();
      engine.sendMessage(chatId, 'AI reply', 'ai-1');
      expect(engine._triggerAIResponse).not.toHaveBeenCalled();
    });

    it('应该支持引用回复', () => {
      engine.sendMessage(chatId, 'Original', 'user-me');
      const originalId = engine.chats[0].messages[0].id;

      engine.sendMessage(chatId, 'Reply', 'user-me', originalId);
      const reply = engine.chats[0].messages[1];
      expect(reply.quotedMessageId).toBe(originalId);
    });
  });

  describe('deleteMessage()', () => {
    let chatId, messageId;

    beforeEach(() => {
      chatId = engine.createChat('Test', ['ai-1']);
      engine.sendMessage(chatId, 'Message 1', 'user-me');
      engine.sendMessage(chatId, 'Message 2', 'user-me');
      messageId = engine.chats[0].messages[0].id;
    });

    it('应该删除指定消息', () => {
      engine.deleteMessage(chatId, messageId);

      const chat = engine.chats.find(c => c.id === chatId);
      expect(chat.messages).toHaveLength(1);
      expect(chat.messages.find(m => m.id === messageId)).toBeUndefined();
    });

    it('应该忽略无效的messageId', () => {
      engine.deleteMessage(chatId, 'invalid-id');

      const chat = engine.chats.find(c => c.id === chatId);
      expect(chat.messages).toHaveLength(2);
    });
  });

  describe('pinMessage()', () => {
    let chatId, messageId;

    beforeEach(() => {
      chatId = engine.createChat('Test', ['ai-1']);
      engine.sendMessage(chatId, 'Pin me', 'user-me');
      messageId = engine.chats[0].messages[0].id;
    });

    it('应该固定消息', () => {
      engine.pinMessage(chatId, messageId, true);

      const chat = engine.chats.find(c => c.id === chatId);
      expect(chat.pinnedMessages).toContain(messageId);
    });

    it('应该取消固定消息', () => {
      engine.pinMessage(chatId, messageId, true);
      engine.pinMessage(chatId, messageId, false);

      const chat = engine.chats.find(c => c.id === chatId);
      expect(chat.pinnedMessages).not.toContain(messageId);
    });

    it('应该不重复固定已固定的消息', () => {
      engine.pinMessage(chatId, messageId, true);
      engine.pinMessage(chatId, messageId, true);

      const chat = engine.chats.find(c => c.id === chatId);
      expect(chat.pinnedMessages.filter(id => id === messageId)).toHaveLength(1);
    });
  });

  describe('subscribe()', () => {
    it('应该返回unsubscribe函数', () => {
      const unsubscribe = engine.subscribe(() => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('应该通知订阅者状态变化', () => {
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.createChat('Test', ['ai-1']);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toHaveProperty('chats');
    });

    it('unsubscribe应该停止接收通知', () => {
      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);

      unsubscribe();
      engine.createChat('Test', ['ai-1']);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('votePoll()', () => {
    let chatId, pollId;

    beforeEach(() => {
      chatId = engine.createChat('Test', ['ai-1']);
      const chat = engine.chats[0];
      pollId = 'poll-1';
      chat.polls = [{
        id: pollId,
        question: 'Test poll?',
        options: [
          { id: 'opt-1', text: 'Option 1', votes: [] },
          { id: 'opt-2', text: 'Option 2', votes: [] }
        ]
      }];
    });

    it('应该记录投票', () => {
      engine.votePoll(chatId, pollId, 'opt-1', 'user-me');

      const chat = engine.chats.find(c => c.id === chatId);
      const poll = chat.polls.find(p => p.id === pollId);
      const option = poll.options.find(o => o.id === 'opt-1');

      expect(option.votes).toContain('user-me');
    });

    it('应该允许更改投票', () => {
      engine.votePoll(chatId, pollId, 'opt-1', 'user-me');
      engine.votePoll(chatId, pollId, 'opt-2', 'user-me');

      const chat = engine.chats.find(c => c.id === chatId);
      const poll = chat.polls.find(p => p.id === pollId);

      expect(poll.options[0].votes).not.toContain('user-me');
      expect(poll.options[1].votes).toContain('user-me');
    });
  });
});
```

### 步骤 3.3: 测试 `APIClient`

创建 `src/services/api/APIClient.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import APIClient from './APIClient';

// Mock global fetch
global.fetch = vi.fn();

describe('APIClient', () => {
  let client;

  beforeEach(() => {
    client = new APIClient('https://api.test.com', {
      'Authorization': 'Bearer test-token'
    });
    vi.clearAllMocks();
  });

  describe('request()', () => {
    it('应该构建正确的URL', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await client.get('/users');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.test.com/users',
        expect.any(Object)
      );
    });

    it('应该合并headers', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      await client.post('/data', { test: 'value' }, {
        'X-Custom': 'header'
      });

      const callArgs = fetch.mock.calls[0][1];
      expect(callArgs.headers.Authorization).toBe('Bearer test-token');
      expect(callArgs.headers['X-Custom']).toBe('header');
    });

    it('应该处理绝对URL', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      await client.get('https://other-api.com/data');

      expect(fetch).toHaveBeenCalledWith(
        'https://other-api.com/data',
        expect.any(Object)
      );
    });
  });

  describe('setAuthToken()', () => {
    it('应该设置Authorization header', () => {
      client.setAuthToken('new-token');
      expect(client.headers.Authorization).toBe('Bearer new-token');
    });

    it('应该移除Authorization header当传入null', () => {
      client.setAuthToken(null);
      expect(client.headers.Authorization).toBeUndefined();
    });
  });

  describe('_fetchWithRetry()', () => {
    it('应该在429错误时重试', async () => {
      fetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      const result = await client.get('/data');

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it('应该在5xx错误时重试', async () => {
      fetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      const result = await client.get('/data');

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('应该在4xx错误时不重试（除了429）', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(client.get('/notfound')).rejects.toThrow('HTTP 404: Not Found');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('应该尊重maxRetries限制', async () => {
      fetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(client.get('/data')).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(4); // 1 + 3 retries
    });

    it('应该在网络错误时重试', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      const result = await client.get('/data');

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });
  });

  describe('timeout', () => {
    it('应该在超时后中断请求', async () => {
      const slowClient = new APIClient('https://api.test.com', {}, {
        timeout: 100
      });

      fetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ ok: true }), 500))
      );

      await expect(slowClient.get('/slow')).rejects.toThrow();
    }, 10000);
  });
});
```

**运行测试**:
```bash
npm run test -- ChatEngine.test.js APIClient.test.js StorageService.test.js
npm run test:coverage
```

✅ **Phase 3 完成标志**:
- 覆盖率达到 **40-50%**
- ChatEngine、StorageService、APIClient 测试通过
- 核心状态管理逻辑被验证

---

## Phase 4: 编写服务层测试 (第3-4周)

### 步骤 4.1: 测试 `toolService.js`

创建 `src/features/chat/services/toolService.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { executeTool } from './toolService';

describe('toolService', () => {
  describe('execute_code', () => {
    it('应该执行简单的JavaScript代码', async () => {
      const result = await executeTool('execute_code', { code: '2 + 2' });
      expect(result).toContain('4');
    });

    it('应该捕获console.log输出', async () => {
      const result = await executeTool('execute_code', {
        code: 'console.log("Hello World")'
      });
      expect(result).toContain('Hello World');
    });

    it('应该处理语法错误', async () => {
      const result = await executeTool('execute_code', {
        code: 'invalid javascript {'
      });
      expect(result).toContain('Error');
    });

    it('应该处理运行时错误', async () => {
      const result = await executeTool('execute_code', {
        code: 'throw new Error("Test error")'
      });
      expect(result).toContain('Test error');
    });
  });

  describe('execute_math', () => {
    it('应该计算数学表达式', async () => {
      const result = await executeTool('execute_math', {
        expression: 'sqrt(16)'
      });
      expect(result).toContain('4');
    });

    it('应该处理无效表达式', async () => {
      const result = await executeTool('execute_math', {
        expression: 'invalid_function(x)'
      });
      expect(result).toContain('Error');
    });
  });

  describe('web_search', () => {
    it('应该返回搜索结果格式', async () => {
      const result = await executeTool('web_search', {
        query: 'test query'
      });
      expect(result).toContain('Searching for');
    });
  });

  describe('unknown tool', () => {
    it('应该返回错误消息', async () => {
      const result = await executeTool('nonexistent_tool', {});
      expect(result).toContain('Unknown tool');
    });
  });
});
```

### 步骤 4.2: 测试 Hooks

创建 `src/hooks/useLocalStorage.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useLocalStorage from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('应该返回初始值当localStorage为空', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'initial')
    );

    expect(result.current[0]).toBe('initial');
  });

  it('应该从localStorage读取值', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'));

    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'initial')
    );

    expect(result.current[0]).toBe('stored');
  });

  it('应该更新localStorage当调用setValue', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'initial')
    );

    act(() => {
      result.current[1]('new value');
    });

    expect(result.current[0]).toBe('new value');
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new value'));
  });

  it('应该支持函数式更新', () => {
    const { result } = renderHook(() =>
      useLocalStorage('counter', 0)
    );

    act(() => {
      result.current[1](prev => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it('应该处理复杂对象', () => {
    const { result } = renderHook(() =>
      useLocalStorage('user', { name: 'Test', age: 25 })
    );

    act(() => {
      result.current[1]({ name: 'Updated', age: 26 });
    });

    expect(result.current[0]).toEqual({ name: 'Updated', age: 26 });
  });

  it('应该处理JSON解析错误', () => {
    localStorage.setItem('test-key', 'invalid json{');

    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'fallback')
    );

    expect(result.current[0]).toBe('fallback');
  });
});
```

**运行测试**:
```bash
npm run test -- toolService.test.js useLocalStorage.test.js
npm run test:coverage
```

✅ **Phase 4 完成标志**:
- 覆盖率达到 **55-65%**
- 服务层和Hooks测试完成

---

## Phase 5: 配置CI/CD (第4-5周)

### 步骤 5.1: 创建GitHub Actions工作流

创建 `.github/workflows/test.yml`:

```yaml
name: Test & Coverage

on:
  push:
    branches: [ main, remake, develop ]
  pull_request:
    branches: [ main, remake, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm run test:coverage

      - name: Check coverage thresholds
        run: |
          npm run test:coverage -- --reporter=json --outputFile=coverage-summary.json
          node -e "
            const coverage = require('./coverage-summary.json');
            const { lines, functions, branches, statements } = coverage.total;
            const threshold = 60;
            if (lines.pct < threshold || functions.pct < threshold ||
                branches.pct < threshold || statements.pct < threshold) {
              console.error('❌ Coverage below threshold!');
              process.exit(1);
            }
            console.log('✅ Coverage meets threshold');
          "

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: true

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          lcov-file: ./coverage/lcov.info
```

### 步骤 5.2: 添加Pre-commit Hook

创建 `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 运行linter
npm run lint

# 运行测试
npm run test

# 检查测试是否通过
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Commit aborted."
  exit 1
fi

echo "✅ All tests passed!"
```

安装Husky:
```bash
npm install -D husky
npx husky install
npx husky add .husky/pre-commit "npm run test"
```

### 步骤 5.3: 添加测试覆盖率徽章

在 `README.md` 中添加:

```markdown
![Tests](https://github.com/Luckycat133/Chat_Buddy/workflows/Test%20&%20Coverage/badge.svg)
![Coverage](https://codecov.io/gh/Luckycat133/Chat_Buddy/branch/main/graph/badge.svg)
```

✅ **Phase 5 完成标志**:
- CI/CD pipeline运行成功
- PR自动运行测试
- 覆盖率报告自动生成

---

## 最佳实践与技巧

### 1. 测试命名约定

```javascript
// ✅ 好的命名 - 描述行为
it('应该在超时后中断请求', () => {});
it('should abort request after timeout', () => {});

// ❌ 差的命名 - 不清晰
it('test timeout', () => {});
it('works', () => {});
```

### 2. 测试隔离

```javascript
// ✅ 每个测试独立
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ❌ 测试间依赖
it('test 1', () => {
  localStorage.setItem('key', 'value');
});

it('test 2', () => {
  // 依赖test 1的数据 ❌
  expect(localStorage.getItem('key')).toBe('value');
});
```

### 3. 使用Fixtures

```javascript
// src/test/fixtures/chatFixtures.js
export const mockChat = {
  id: 'chat-123',
  name: 'Test Chat',
  participants: ['user-me', 'ai-1'],
  messages: [
    {
      id: 'msg-1',
      content: 'Hello',
      senderId: 'user-me',
      timestamp: '2026-02-08T10:00:00Z'
    }
  ]
};
```

### 4. Mock外部依赖

```javascript
// ✅ Mock API调用
vi.mock('../services/api/aiClient', () => ({
  aiClient: {
    post: vi.fn(() => Promise.resolve({
      choices: [{ message: { content: 'Mocked response' } }]
    }))
  }
}));
```

### 5. 测试覆盖率目标

| 代码类型 | 目标覆盖率 |
|---------|-----------|
| 工具函数 | 90%+ |
| 核心逻辑 | 85%+ |
| 服务层 | 80%+ |
| Hooks | 75%+ |
| 组件 | 60%+ |

### 6. 快速测试开发循环

```bash
# 监听模式 - 实时运行
npm run test:watch

# 只运行失败的测试
npm run test -- --reporter=verbose --reporter=junit --bail=1

# 运行特定文件
npm run test formatTime

# 查看覆盖率UI
npm run test:ui
```

### 7. 调试测试

```javascript
// 在测试中添加调试点
it('debug test', () => {
  const result = myFunction();
  debugger; // 会在这里暂停
  expect(result).toBe(expected);
});

// 运行单个测试并查看详细输出
npm run test -- --reporter=verbose formatTime.test.js
```

---

## 检查清单

### Phase 1完成 ✓
- [ ] Vitest已安装
- [ ] vitest.config.js已配置
- [ ] src/test/setup.js已创建
- [ ] package.json scripts已更新
- [ ] 运行 `npm run test` 无错误

### Phase 2完成 ✓
- [ ] formatTime.test.js (15+ tests)
- [ ] fileUtils.test.js (15+ tests)
- [ ] chatService.test.js - cleanMessageContent (20+ tests)
- [ ] ragUtils.test.js (15+ tests)
- [ ] 覆盖率 ≥ 20%

### Phase 3完成 ✓
- [ ] StorageService.test.js (12+ tests)
- [ ] ChatEngine.test.js (20+ tests)
- [ ] APIClient.test.js (15+ tests)
- [ ] 覆盖率 ≥ 40%

### Phase 4完成 ✓
- [ ] toolService.test.js (10+ tests)
- [ ] useLocalStorage.test.js (8+ tests)
- [ ] 覆盖率 ≥ 55%

### Phase 5完成 ✓
- [ ] GitHub Actions workflow已配置
- [ ] Pre-commit hooks已设置
- [ ] 覆盖率报告自动生成
- [ ] 覆盖率 ≥ 60%

---

## 下一步

完成基础测试后，你可以：

1. **继续提高覆盖率** - 添加更多组件测试
2. **集成E2E测试** - 使用Playwright或Cypress
3. **性能测试** - 测试大量数据场景
4. **可访问性测试** - 使用jest-axe
5. **视觉回归测试** - 使用Chromatic或Percy

---

**祝测试顺利！** 🎉

记住：**好的测试不仅仅是覆盖率数字，更重要的是测试关键路径和边界情况。**
