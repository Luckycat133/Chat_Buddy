# Development Guide

本文档帮助你快速搭建开发环境。

[English](#english) | [中文](#中文)

---

## English

### Prerequisites

- Node.js `^20.19.0`, `^22.13.0`, or `>=24.0.0`
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

### Native dependency troubleshooting (macOS Apple Silicon)

If `build/test/dev` fails with native-module errors (`rollup`, `lightningcss`, `@tailwindcss/oxide`, `esbuild`), run:

```bash
rm -rf node_modules/@rollup/rollup-darwin-arm64 \
       node_modules/lightningcss \
       node_modules/lightningcss-darwin-arm64 \
       node_modules/@tailwindcss/oxide \
       node_modules/@tailwindcss/oxide-darwin-arm64
npm install
```

### Environment Variables

```env
VITE_AI_API_URL=https://api.deepseek.com
VITE_AI_API_KEY=your_api_key
VITE_AI_MODEL=deepseek-chat
```

If you configure the provider inside the Settings panel instead of `.env`, the API key is kept only for the current browser session. Saved provider profiles keep the base URL and model, but do not persist the key.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Start Vitest in watch mode |
| `npm run test:coverage` | Enforce the 60% gate on regression-critical logic |
| `npm run test:coverage:all` | Generate an observational whole-repository report without a threshold |
| `npm run test:e2e` | Run the Playwright end-to-end suite |
| `npm run stress` | Run the UI stress script |
| `npm run prompt:bench` | Run the prompt regression benchmark |

Coverage is intentionally layered: Vitest gates security, data-integrity, and
chat-domain logic, while Playwright + Axe gate rendered UI behavior. The
whole-repository command remains available to expose untested modules without
making the CI gate permanently red.

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

1. Add keys to `src/data/locales.js` (`en` / `zh` sections)
2. Use: `const { t } = useLanguage(); t('key')`

---

## 中文

### 前置要求

- Node.js `^20.19.0`、`^22.13.0` 或 `>=24.0.0`
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

### 原生依赖故障排查（macOS Apple Silicon）

若 `build/test/dev` 因原生模块报错（`rollup`、`lightningcss`、`@tailwindcss/oxide`、`esbuild`），执行：

```bash
rm -rf node_modules/@rollup/rollup-darwin-arm64 \
       node_modules/lightningcss \
       node_modules/lightningcss-darwin-arm64 \
       node_modules/@tailwindcss/oxide \
       node_modules/@tailwindcss/oxide-darwin-arm64
npm install
```

### 环境变量

```env
VITE_AI_API_URL=https://api.deepseek.com
VITE_AI_API_KEY=你的API密钥
VITE_AI_MODEL=deepseek-chat
```

如果你不是通过 `.env`，而是在设置面板中配置提供商，API 密钥只会保留在当前浏览器会话中。保存的服务方案只保存地址和模型，不会持久化密钥。

### 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | 运行 ESLint |
| `npm run test` | 单次运行 Vitest 测试 |
| `npm run test:watch` | 以监听模式运行 Vitest |
| `npm run test:coverage` | 对安全、数据与聊天核心逻辑执行 60% 覆盖率门禁 |
| `npm run test:coverage:all` | 生成无门槛的全仓覆盖率观测报告 |
| `npm run test:e2e` | 运行 Playwright 端到端测试 |
| `npm run stress` | 运行 UI 压力脚本 |
| `npm run prompt:bench` | 运行 Prompt 回归基准 |

覆盖率采用分层策略：Vitest 对安全、数据完整性和聊天领域逻辑设置硬门禁，
Playwright + Axe 验收真实渲染后的 UI；全仓命令继续暴露未覆盖模块，但不制造必然失败的 CI。

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

1. 在 `src/data/locales.js` 的 `en` / `zh` 分区添加 key
2. 使用：`const { t } = useLanguage(); t('key')`
