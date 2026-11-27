# AGENTS.md — Chat Buddy Remake

## 当前维护范围与技能入口

先读 [README.md](README.md) 与 [WEB_TO_IOS_MIGRATION.md](WEB_TO_IOS_MIGRATION.md)：Web 端当前以**关键修复和向 iOS 迁移为主**，不盲目扩写无关大重构。按当前任务从 [.agents/SKILLS.md](.agents/SKILLS.md) 选用项目 Skill（产品行为任务先加载 [.agents/skills/chat-buddy-web-demo-development/SKILL.md](.agents/skills/chat-buddy-web-demo-development/SKILL.md)）；切勿一次全量加载所有 Skill。

## 构建与校验命令

```bash
npm run dev              # 开发服务 (http://localhost:5173)
npm run build            # 生产构建 (输出 dist/)
npm run lint             # ESLint 校验
npm run test             # Vitest + jsdom 单元测试
npx playwright test      # E2E 测试（需先启 :5173 开发服务）
npm run prompt:bench     # Prompt 回归评测
```

改动完成后，在跑通受影响的单测 / `npm run lint` / `npm run build` 前不得宣称完成。

## 架构硬边界与踩坑警告（附原因）

- **领域层纯净性**：`src/core/`（`ChatEngine`、`AIPipeline`、`PresenceService` 等）**严禁引入任何 React 依赖**，因为 iOS 迁移与纯 JS 单测均直接依赖其框架无关的状态机契约。
- **存储与导出兼容**：轻配置在 LocalStorage（命名空间 `chat-buddy:`），聊天/文档/媒体在 IndexedDB。任何数据模型调整必须保护已有导出备份与 IndexedDB 存量数据可读，防止破坏用户记录或 Web→iOS 导入链路。
- **前端环境变量安全**：`VITE_*` 变量会被打包进客户端静态产物，**绝不是密钥保管位置**；严禁把真实 API Key 或私有凭据硬编码进 `VITE_*` 或源码。
- **验证证据分离**：迁移设计、Mock 测试、真实浏览器数据往返与 iOS 导入分别留证，不能用单测通过冒充真实浏览器持久化或 iOS 兼容已通过。
- **TailwindCSS 4**：采用 CSS-first 配置（无 `tailwind.config.js`），勿按 v3 方式新增传统配置文件。

## 深入参考与钩子（1 跳指针）

- 完整目录树、`ChatEngine` 状态结构、核心模块 API 与测试清单：[docs/agent-reference.md](docs/agent-reference.md)
- 项目 Codex SessionStart 钩子边界说明：[.codex/hooks/README.md](.codex/hooks/README.md)
