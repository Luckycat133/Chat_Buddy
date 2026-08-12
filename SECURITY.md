# Security Notes for Chat_Buddy

> 2026-06-10 由 Finn（code review pass）建立。
> 本文档说明 Chat_Buddy 项目的安全姿态与已知 trade-off。
> **注意：本文不是法律意见，部署到公网前请独立安全审计。**

> **2026-08-12 更新**：工具调用现为默认拒绝并受角色白名单约束；浏览器任意代码
> Worker 已删除；备份导入会先校验再原子写入且不会携带 API key；Mermaid 输出经过
> 严格模式、限长、超时和 DOMPurify 二次净化；npm 与 pnpm 的 low-level audit 均为 0 漏洞。
> 输入富文本同样使用 DOMPurify 解析式净化；朋友圈图片 API key 仅保留在内存中，并自动移除旧持久化值。
> 提交 `73283719` 的远端 JavaScript/TypeScript 与 Python CodeQL 均成功；经源码与数据流复核后开放 Code Scanning 告警为 0，Dependabot 开放告警为 0。

---

## 1. API 密钥管理（核心问题）

### 1.1 当前状态

- 开发模式（`npm run dev`）：从 `.env` 读取 `VITE_*` 变量
- 生产构建（`npm run build`）：**Vite 会把所有 `VITE_` 前缀变量静态替换并 bundle 进客户端 JS**
- `src/config/apiConfig.js` 实现 sessionStorage 覆盖：用户可在 UI 设置界面输入自己的 key，会话级保存

### 1.2 风险矩阵

| 场景 | 风险 | 缓解 |
|---|---|---|
| 本地 `npm run dev` | 低（key 仅本地用） | OK |
| `dist/` 部署到公网静态托管（如 GitHub Pages、Cloudflare Pages） | **高**：key 被任何人 grep | **必须** 改为 server-side proxy 或运行时注入 |
| 自建后端代理 | 中：key 在服务端，但前端直连后端 | 需 CSRF / CORS / rate limit |
| 用户自填 key | 低：用户自己的 key 在 sessionStorage | OK，XSS 仍是风险（见 §2） |

### 1.3 生产部署必须做的事

**选项 A（推荐）：加 server-side proxy**

```
前端 → 你的后端 /api/chat (POST)  →  OpenRouter / MiniMax
                                ↑
                         key 在 server env
```

Vite 自带 dev server proxy（`vite.config.js` `server.proxy`），生产用 Cloudflare Workers / Vercel Edge / Express 都可。

**选项 B（最简单）：用 build-time 变量注入 + 别部署 dist/ 到公网**

- 仅把 `dist/` 当 SSR 资源或本地预览
- 任何公网部署前清掉 `VITE_*` 变量再 build（产物会因 undefined 报错，提示你改）

**选项 C：迁移到完全 serverless + edge function**

- Cloudflare Workers / Deno Deploy 接受环境变量 + 提供 API
- 前端 fetch `/api/*` 路径，由 edge 转发

### 1.4 公网部署前仍需完成

- 把 `VITE_AI_API_KEY` / `VITE_TAVILY_API_KEY` / `VITE_MINIMAX_API_KEY` 从 `.env` **删掉**
- 在 `Settings` UI 强制用户填入（已有 sessionStorage 实现）
- 在 README 加警告段

---

## 2. XSS / localStorage 风险

### 2.1 当前状态

- 多个 Context（Friend / Social / Sticker / Moments）通过 `useLocalStorage` 持久化
- 持久化内容：好友关系、签到、积分、聊天草稿、**部分 API key**
- API key 用 `sessionStorage` 已经是当前最优实践（关 tab 即清）
- 其他社交数据在 `localStorage`（XSS 仍能偷，但价值低）

### 2.2 缓解

- `logger.js` 已有结构化日志（不要 `console.log` 散落写）
- `ErrorBoundary` 已实现（防止错误态导致整页 XSS 触发面扩大）
- 无 `dangerouslySetInnerHTML` 用法（grep 已验证）
- 用户输入（消息、动态）走 React 文本节点自动转义

### 2.3 已知遗留

- `src/` 中仍有 **149 处 `console.log/warn/error/info`**，其中包含有意保留的重试、降级和错误诊断日志
- 这些 console 在 dev 模式可读；生产 build 时 Vite 会去掉一部分（取决于 NODE_ENV），但**部分 console.error 仍会留在 prod bundle**（用于错误上报）
- 风险：prod 用户按 F12 能看到部分错误堆栈。**中等风险**，建议改用 `logger.error` + 自定义 UI toast

---

## 3. 依赖漏洞（已修）

### 2026-08-12 验证

- Mermaid 固定为 `11.16.1`，DOMPurify 固定为 `3.4.13`。
- `npm audit --audit-level=low`：`0 vulnerabilities`。
- `pnpm audit --audit-level low`：`No known vulnerabilities found`。
- CI 在 lint job 中执行完整 `npm audit`。

### 2026-06-10 修复

`npm audit` 之前报 2 个 critical：
- `vitest@3.2.4` — CVE GHSA-5xrq-8626-4rwp（CVSS 9.8，Vitest UI server 任意文件读+执行）
- `@vitest/coverage-v8@3.2.4` — 同 CVE 传递依赖

**修复**：package.json 升到 `^3.2.6`，`npm install` 后 `npm audit` 显示 0 vulnerabilities。

### 持续维护

- 建议 CI 加 `npm audit --production --audit-level=high` 阻断
- Dependabot 已配置（`.github/dependabot.yml` 需确认）
- 定期跑 `npm outdated` 看 minor / major 更新

---

## 4. Context Hell（架构问题，非安全）

`AppProviders.jsx` 嵌套 12 层 Provider（Language → Theme → Notification → Social → Sticker → Document → User → Friend → Moments → Chat → Background → Toast）：

```
LanguageProvider
└─ ThemeProvider
   └─ NotificationProvider
      └─ SocialProvider
         └─ StickerProvider
            └─ DocumentProvider
               └─ UserProvider
                  └─ FriendProvider
                     └─ MomentsProvider
                        └─ ChatProvider
                           └─ BackgroundProvider
                              └─ ToastProvider
```

### 4.1 问题

- 任何 Provider 重渲染 → 整子树重渲染（React 19 的 `use()` API 部分缓解但未重构）
- 单元测试要 mock 12 个 Provider
- 新人上手难

### 4.2 建议（这次没改，列入 P2）

- 用 **Redux Toolkit / Zustand** 抽离全局状态
- 保留 Context 模式但**合并相关 Context**（如 Document + Chat 都是 chat 相关）
- 评估迁移到 **React 19 `use(Context)` + Server Components**

---

## 5. 生产部署清单（部署前必看）

部署到公网前**必须**完成：

- [ ] 删 `.env` 中所有 `VITE_*` 真实 key
- [ ] 实现 server-side API proxy（或迁移到 serverless）
- [ ] `npm run build` 前 `grep -r "VITE_AI_API_KEY\|VITE_TAVILY\|VITE_MINIMAX" dist/`，必须返回空
- [ ] 配置 CSP header（限制内联 script 源）
- [ ] 配置 HSTS / HTTPS only cookie
- [ ] 关闭 `index.html` 中 dev tools（如 `<script type="module" src="...">` 的 sourcemap）
- [ ] Vite build 加 `build.sourcemap: false`（默认 false 但要确认）
- [ ] 跑 `npm audit` 必须 0 high/critical
- [ ] 跑 E2E（`npx playwright test`）通过
- [x] 旧 `coverage/` 生成目录已从版本控制删除；新报告只写入被忽略的 `test_reports/coverage/`
- [ ] 部署到 Cloudflare Pages / Vercel 时设置环境变量**仅服务端**用（Vercel 区分 `VITE_` vs 非 `VITE_`）

---

## 6. 不在本文档范围

以下问题已知但**安全等级低**，不在本次审查范围：

- 29 个 components + 18 个 pages 的可维护性（见 `reviews/2026-06-10-Chat_Buddy.md` §1 架构问题）
- 70KB 的 `index.css`（应该是 tailwind 编译后正常体积）
- 4KB `index.css` × 多个 css 入口的拆分（见 ROADMAP.md）
- 多语言（中/英）漂移风险（CHANGELOG.md / CHANGELOG.zh-CN.md 双份维护）
- 5 个 IndexedDB schema 增长后是否需要 migration 工具

---

## 7. 报告

历史审查报告曾保存在本地工作区；仓库不再引用不可移植的绝对路径。

---

*最后更新: 2026-08-12*
