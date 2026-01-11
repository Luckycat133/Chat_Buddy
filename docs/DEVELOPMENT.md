# Development Guide

本文档帮助你快速搭建开发环境。

[English](#english) | [中文](#中文)

---

## English

### Prerequisites

- Node.js v16+ (v18+ recommended)
- npm v7+

### Setup

```bash
git clone https://github.com/Luckycat133/Chat_Buddy.git
cd Chat_Buddy
npm install
cp .env.example .env
# Edit .env with your API key
npm run dev
```

### Environment Variables

```env
VITE_AI_API_URL=https://api.deepseek.com
VITE_AI_API_KEY=your_api_key
VITE_AI_MODEL=deepseek-chat
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |

### Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/core/` | Domain logic (no React) |
| `src/services/` | API and storage |
| `src/features/` | Feature modules |
| `src/components/` | Shared UI |

### Adding a Persona

1. Edit `src/data/personas.js`
2. Add avatar to `public/avatars/`

### Adding Translations

1. Add keys to `src/data/locales/en.js` and `zh.js`
2. Use: `const { t } = useLanguage(); t('key')`

---

## 中文

### 前置要求

- Node.js v16+（推荐 v18+）
- npm v7+

### 配置

```bash
git clone https://github.com/Luckycat133/Chat_Buddy.git
cd Chat_Buddy
npm install
cp .env.example .env
# 编辑 .env 填入 API 密钥
npm run dev
```

### 环境变量

```env
VITE_AI_API_URL=https://api.deepseek.com
VITE_AI_API_KEY=你的API密钥
VITE_AI_MODEL=deepseek-chat
```

### 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | 运行 ESLint |

### 目录结构

| 目录 | 用途 |
|------|------|
| `src/core/` | 领域逻辑（无 React） |
| `src/services/` | API 和存储 |
| `src/features/` | 功能模块 |
| `src/components/` | 共享 UI |

### 添加角色

1. 编辑 `src/data/personas.js`
2. 头像放入 `public/avatars/`

### 添加翻译

1. 在 `src/data/locales/en.js` 和 `zh.js` 添加 key
2. 使用：`const { t } = useLanguage(); t('key')`
