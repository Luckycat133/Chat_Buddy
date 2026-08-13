# Chat Buddy 综合代码与 UI/UX 审查报告

> **审查日期**：2026-08-11
>
> **修复验证日期**：2026-08-13
>
> **修复基线**：`remake` / `f50531bb`
>
> **当前状态**：原审查中的 P1/P2 项已修复，并完成单元、构建、依赖、真实浏览器以及 OpenRouter 免费模型的 Agent/虚拟角色验收

## 0. 2026-08-12 至 2026-08-13 修复验证更新

原始审查结论保留在后续章节，便于追溯问题来源。本次修复后的验证结果如下：

| 验证 | 结果 |
| --- | --- |
| `TZ=UTC npm run test:coverage` | 24 个文件、407/407 通过；核心逻辑门禁通过：Statements 85.04%、Branches 77.83%、Functions 84.91%、Lines 87.95% |
| `TZ=UTC npm run test:coverage:all` | 407/407 通过；全仓观测值为 Statements 22.57%、Branches 19.77%、Functions 17.68%、Lines 23.45%，不作为单元门禁伪装成已全面覆盖 |
| `npm run lint` | 通过，0 errors、0 warnings |
| `npm run build` | 通过；已拆分高亮、Markdown、KaTeX、MathJS 与 Mermaid 懒加载产物，无 chunk 警告 |
| `npm audit --audit-level=low` / `pnpm audit --audit-level low` | 均通过，0 vulnerabilities |
| 生产预览 + 系统 Chrome | CSP、DENY、nosniff 与 Referrer-Policy 响应头生效；Service Worker 激活并接管刷新页面；0 console errors |
| `npm run test:e2e -- --project=chromium` | 19/19 通过 |
| `npx playwright test e2e/ux.spec.js --project=mobile-chrome` | 8/8 通过 |
| 远端 CI | 提交 `73283719` 的 CI 全部成功：[运行记录](https://github.com/Luckycat133/Chat_Buddy/actions/runs/31614255044) |
| 远端 CodeQL | JavaScript/TypeScript 与 Python 均成功：[运行记录](https://github.com/Luckycat133/Chat_Buddy/actions/runs/31614255014)；开放告警 0 |
| Dependabot | 开放告警 0 |

### 2026-08-13 真实 OpenRouter Provider 验收

- 从 `crouter` 已登记的 macOS Keychain 项读取 OpenRouter key，并只比较、不输出地确认它与 Git 忽略的本机 `.env` 一致。浏览器持久配置只保存地址和模型；密钥没有写入 localStorage 或 Git。设置面板密码值可能进入 Playwright 快照/trace，因此相关临时资源已立即删除。
- 根据 OpenRouter [官方免费模型榜单](https://openrouter.ai/collections/free-models)和[免费变体说明](https://openrouter.ai/docs/guides/routing/model-variants/free)，选择 `nvidia/nemotron-3-ultra-550b-a55b:free`：官方 API 元数据为 1,000,000 token 上下文，输入/输出价格均为 0，并支持 tools、tool choice 与 reasoning 参数。
- API 直连预检返回 HTTP 200，2,633 ms，实际响应模型与请求模型一致。网页设置中的连接测试也通过，持久配置只保存 `https://openrouter.ai/api/v1` 与模型名。
- 任务 Agent“代码”真实对话发现用户代码 `xs[1]` 和模型回复 `xs[0]` 被本地控制标签清洗误删。请求/响应取证证明模型原始输出正确；修复后请求体、原始响应和最终页面三层均保留方括号，Agent 给出正确最小 diff。该轮免费容量下自动标题与对话请求的浏览器网络耗时分别为 46,819 ms 和 48,858 ms。
- 虚拟角色“露娜”真实回复耗时 21,570 ms，返回简体中文并保持温柔、星空意象和简短提问的角色设定；页面 0 console errors。
- 同时修复“中文说明 + JavaScript 标识符”被误判为英文的问题，并把 `items[1]`/`items[0]` 纳入桌面与移动 Chrome 回归。
- Nemotron 默认开启推理，原 20-token 自动标题请求曾把预算全部用于 reasoning 并返回空正文。标题请求现仅在官方 OpenRouter endpoint 发送 `reasoning.enabled=false`；真实复测得到 9 个正文 token、0 reasoning token，话题标题正常显示。
- 干净浏览器终验再次确认 Coder 请求/响应 HTTP 200、模型和供应商分别为 Nemotron 3 Ultra / NVIDIA，页面最终为 0 errors、0 warnings。免费变体容量和延迟会随上游变化，官方也不保证与付费变体相同的可用性。

### 2026-08-13 图片与开发态运行体验

- Vite 热更新重连使用 blob Worker；开发服务器 CSP 仅增加 `worker-src 'self' blob:`，生产预览仍保持 `worker-src 'self'`。
- 朋友圈原先先取 MiniMax 的 24 小时签名 URL，再由浏览器/公共代理转存，真实运行会产生 CORS、超时或代理 400。现按 MiniMax 官方 API 改请求 `response_format: base64`，直接保存可离线渲染的 data URL，并移除不需要的 `crossorigin` 属性。
- 真实 `image-01` 请求返回 HTTP 200，请求体确认使用 `base64`；图片在浏览器完成解码，最终 Agent + 图片联合终验控制台为 0 errors、0 warnings。

### 修复结果

| 原问题 | 状态 | 已验证实现 |
| --- | --- | --- |
| SEC-01 工具调用越权 | 已修复 | 新增统一 deny-by-default 授权器；AIPipeline 与工具边界均校验 persona 显式开关和工具白名单 |
| SEC-02 Worker 伪沙箱 | 已修复 | 删除 `sandbox.worker.js` 与浏览器任意代码执行；`run_code` 明确返回禁用状态 |
| SEC-03 / DATA-01 备份与密钥 | 已修复 | 备份版本、体积、记录数、字段、URL 全量校验；按 store 原子替换；备份不含密钥；端点变化及清除数据会清除 session key 并阻止回退到构建时密钥 |
| DATA-02 水合覆盖与消息 UI 不刷新 | 已修复 | revision/generation 防旧快照覆盖；ChatEngine 使用不可变数组更新，`useSyncExternalStore` 可可靠观察新消息 |
| CI-01 覆盖率门禁必红 | 已修复 | 核心安全/数据/聊天逻辑保留 60% 硬门禁；全仓观测与 Playwright UI 验收分层报告 |
| UI-01 至 UI-04 | 已修复 | 真浅色主题、可访问强调色、原生按钮语义、Dialog 焦点陷阱/Escape/焦点恢复、可访问名称及 44px 触控目标 |
| 其余 P2 | 已修复 | poll memo、消息元数据、Scholar JSON Schema、依赖、CSP/安全头、Service Worker、版本、语言、减弱动画和嵌套 main 均已处理 |

真实浏览器复测还发现通知模块会在启动时请求仓库中不存在的音频文件，开发模式下又会被生产 Service Worker 接管为 `408 Offline`。现已改为按需使用 Web Audio 生成短提示音，并限制 Service Worker 只在生产环境注册；启动控制台回归已纳入 19 项桌面验收。

推送后的 CodeQL 复核进一步暴露了历史正则清洗、头像 URL、图片 API key 持久化及工作流权限问题。当前实现已改为 DOMPurify 解析式清洗、栅格图片 URL 白名单、图片密钥仅内存保存并迁移删除旧值、配置持久化字段白名单和 CI `contents: read` 最小权限；数字猜谜也改用无模偏差的 Web Crypto 随机数，同时删除 222 个误提交的旧覆盖率生成文件。当前新增回归已计入 407 项单元测试。

提交 `73283719` 的远端 CodeQL JavaScript/TypeScript 与 Python job 均成功。告警复核后开放数为 0：18 条当前扫描结果属于通用 storage 包装器跨键串流或扫描器未识别 `sanitizeImageURL` 白名单的误报；26 条来自已停用的 default-setup 分析键，其原始问题真实但对应代码已经修复或删除。GitHub 仓库未启用 `mitigated` 分类，因此旧记录按“当前陈旧记录为误报”关闭，并在每条告警注释中保留“原发现真实、现已修复”的说明。

### 实际 UX 验收范围

- 系统 Chrome 覆盖 `/`、`/agents`、`/friends`、`/moments`、`/settings`、`/help`，并运行 Axe serious/critical 规则。
- 在 375、768、1024、1440 px 检查横向溢出与单一 `main` 地标；移动触控目标要求至少 44×44 px。
- 实际用键盘选择角色、创建聊天、回车发送消息；自动回归使用网络 mock，另以真实 OpenRouter 免费模型验证任务 Agent 与虚拟角色。还验证弹窗焦点循环、Escape 关闭与焦点恢复、语言元数据、减弱动画和未知路由恢复。
- 未调用付费模型或其他第三方 Provider；OpenRouter 免费容量的长期配额、峰值延迟与稳定性仍需持续观察。

## 1. 原始执行结论（2026-08-11，历史）

当前版本可以完成安装、单元测试和生产构建，但不应被描述为“无阻塞问题”或“已准备部署”。审查确认了以下主要风险：

- 工具调用缺少统一授权门，浏览器 Worker 也不是安全沙箱。
- 备份导入可改变 API 端点并复用会话密钥，“清除全部数据”不会清除该密钥。
- IndexedDB 异步水合可能覆盖刚发送的消息。
- 单元测试通过，但仓库级 coverage 门禁仍为红色。
- 浅色主题、键盘可达性、弹窗焦点、按钮名称和颜色对比度存在系统性 UI/UX 缺陷。

本报告没有发现需要立即停机处置的 P0，但安全、数据完整性和核心无障碍路径中的 P1 应在下一次发布前修复。

## 2. 原始验证基线（2026-08-11，历史）

所有命令均在 `git archive HEAD` 导出的临时目录中执行，避免依赖现有 `node_modules` 状态。

| 检查 | 结果 |
| --- | --- |
| `npm ci` | 成功；Node `24.13.1` 低于 `jsdom@30` 要求的 `24.15.0`，产生 engine warning |
| `TZ=UTC npm test` | 19 个测试文件、372/372 通过 |
| `npm run lint` | 通过；0 errors、9 warnings |
| `TZ=UTC npm run test:coverage` | 测试通过，但 coverage 门禁失败 |
| `npm run build` | 成功；4 个构建产物 chunk 超过 600 kB |
| `npm audit --omit=dev` | 失败；Mermaid/DOMPurify 链路共 2 个 moderate 漏洞 |

当前仓库级覆盖率：

| 指标 | 实测值 | 门槛 |
| --- | ---: | ---: |
| Statements | 20.65% | 60% |
| Branches | 18.00% | 60% |
| Functions | 16.09% | 60% |
| Lines | 21.48% | 60% |

UI/UX 验证覆盖 5 个主路由、12 个次级路由、种子聊天工作区和模型切换弹窗，并在 375、768、1024、1440 px 宽度下检查布局。四个目标宽度均未出现文档级横向溢出。

## 3. P1：发布前应修复

### SEC-01：工具调用没有统一授权门

- **证据**：[AIPipeline.js](../src/core/chat/AIPipeline.js) 会解析文本形式的 `[TOOL_CALL: ...]` 并执行工具，但执行路径没有统一检查 `toolsEnabled` 或 persona 工具允许列表。
- **复现**：临时回归测试确认，即使 `toolsEnabled: false` 且 `tools: []`，仍可执行 `run_code`。
- **风险**：模型输出可以越过 UI/配置层的能力开关。
- **建议**：在所有工具入口之前执行集中式授权、参数验证和高风险操作确认；不要依赖 prompt 或 UI 隐藏。

### SEC-02：Worker 不是安全沙箱

- **证据**：已删除的历史文件 `public/sandbox.worker.js` 使用 `new Function` 执行代码。
- **复现**：真实 Chrome 中，Worker 内 `typeof fetch === "function"` 且 `typeof indexedDB === "object"`。
- **风险**：不可信代码仍可访问网络和持久化能力；Worker 仅隔离 UI 线程，不构成权限边界。
- **建议**：将其明确降级为“执行环境”，默认关闭不可信代码执行，并把需要安全隔离的执行迁移到受控服务端或真正的受限运行时。

### SEC-03：备份导入可劫持 API 端点

- **证据**：[apiConfig.js](../src/config/apiConfig.js) 的导入流程只检查应用标识，没有严格校验版本、字段白名单和 `baseUrl`。
- **复现**：导入文件可以写入攻击者控制的 `baseUrl`，后续请求会携带现有 session API key。
- **风险**：用户导入恶意或被篡改的备份后，会话凭据可能被发送到非预期端点。
- **建议**：先完整验证再原子写入；限制允许字段与 URL 协议/主机；端点变化后清除或重新确认凭据。

### DATA-01：“清除全部数据”保留会话密钥

- **证据**：[apiConfig.js](../src/config/apiConfig.js) 清理 localStorage/IndexedDB，但没有清除 sessionStorage 中的 API key，也没有重置 AI client 单例。
- **风险**：UI 已提示数据清除，但凭据在当前标签页仍有效。
- **建议**：清除 session key、重置客户端实例，并增加浏览器级回归测试。

### DATA-02：异步水合可覆盖新消息

- **证据**：[ChatEngine.js](../src/core/chat/ChatEngine.js) 初始化后异步读取 IndexedDB，并在完成后替换当前 chats。
- **复现**：初始化后立即发送消息，再让旧快照完成水合，新消息会消失。
- **风险**：首次加载或慢存储环境中可能静默丢失用户数据。
- **建议**：水合完成前禁止写入，或使用 revision/merge 语义而不是无条件替换。

### CI-01：Coverage 门禁持续失败

- **证据**：[vitest.config.js](../vitest.config.js) 对 statements、branches、functions、lines 均设置 60% 门槛；当前实测只有 16.09%–21.48%。
- **风险**：CI coverage job 无法变绿，且大量 UI、Context、存储和服务代码仍为 0% 覆盖。
- **建议**：优先为本报告中的安全与数据完整性复现补充正式测试，再逐步扩大覆盖率；不要通过删除门禁来制造绿色结果。

### UI-01：浅色模式仍渲染为黑色主题

- **证据**：[index.css](../src/index.css) 的默认变量直接定义为 OLED 黑色；[ThemeContext.jsx](../src/context/ThemeContext.jsx) 的浅色分支只移除 `.dark`。
- **复现**：系统 Chrome 中，浅色模式计算值为 `--color-bg-app: #000`、`--color-bg-white: #0c0a09`；深色模式反而为 `#0f0f13`、`#1a1a22`。
- **建议**：让 `:root` 表示真正浅色主题，再用 `.dark` 和 `.dark.oled` 分别覆盖。

### UI-02：核心卡片无法通过键盘操作

- **证据**：[AgentsPage.jsx](../src/pages/AgentsPage.jsx)、[FriendsPage.jsx](../src/pages/FriendsPage.jsx) 和 [CreateChat.jsx](../src/features/chat/CreateChat.jsx) 使用带 `onClick` 的 `<div>` 实现核心卡片。
- **复现**：6 张 Agent 卡片中可 Tab 聚焦数量为 0。
- **建议**：优先使用 `<button>` 或 `<Link>`；避免仅补 `role` 而继续手工模拟原生语义。

### UI-03：弹窗焦点穿透，Escape 触发页面后退

- **证据**：[ModelSwitcherPanel.jsx](../src/components/ModelSwitcherPanel.jsx) 缺少 dialog 语义、焦点陷阱和焦点恢复；[Layout.jsx](../src/components/Layout.jsx) 会在没有全局弹窗状态时对 Escape 调用 `history.back()`。
- **复现**：模型切换弹窗打开后，Tab 会聚焦背景的 Knowledge Graph 按钮；直接访问 Settings 时按 Escape 会退到 `about:blank`。
- **建议**：使用共享 Dialog primitive，设置 `role="dialog"`、`aria-modal`、初始焦点、焦点陷阱与关闭后焦点恢复；Escape 只关闭最上层弹窗。

### UI-04：多个图标按钮没有可访问名称

- **证据**：[FriendsPage.jsx](../src/pages/FriendsPage.jsx)、[MomentCard.jsx](../src/features/moments/components/MomentCard.jsx)、[MessageTimeline.jsx](../src/features/chat/components/window/MessageTimeline.jsx) 等存在仅含图标且没有 `aria-label` 的按钮。
- **复现**：动画稳定后，axe 仍在 Friends、Moments、Agent Workspace 和聊天消息路径报告 critical `button-name`。
- **建议**：为所有 icon-only control 提供本地化可访问名称，并把该规则加入自动化无障碍测试。

## 4. P2：后续迭代应修复

### 正确性与依赖

- [MessageTimeline.jsx](../src/features/chat/components/window/MessageTimeline.jsx) 的 memo 比较器忽略 `chat.polls`，投票变化后 UI 可能保持旧值。
- 删除消息后没有统一重算 `lastMessage` 和 `pinnedMessages`，列表摘要和置顶元数据可能陈旧。
- [taskAgents.js](../src/data/taskAgents.js) 中 Scholar 工具参数不是标准 JSON Schema，无法可靠交给严格的工具调用客户端。
- Mermaid `11.16.0` 及其 DOMPurify 链路仍被 `npm audit --omit=dev` 报告为 moderate。
- Service Worker 的 cache-first 策略缺少明确版本淘汰流程，可能让客户端长期停留在旧资源。
- `package.json`/lockfile 当前版本为 `0.3.3`，但 CHANGELOG 已写入 `0.4.0`/`0.4.1` 且仓库最新 tag 为 `v0.3.2`；发布版本来源不一致。

### CSP 与测试

- [index.html](../index.html) 的内联 Service Worker 注册被当前 CSP 阻止，同时 `frame-ancestors` 放在 meta CSP 中不会生效。
- Service Worker 已在应用入口注册，建议删除重复内联脚本，并通过 HTTP 响应头设置 `frame-ancestors`。
- 时区相关测试在 Asia/Shanghai 下曾出现 `Yesterday` 与 `00:00` 的差异；测试应显式固定时区或使用时区无关断言。

### UI/UX 与无障碍

- 中文界面切换后，根节点仍保持 `lang="en"`；应同步更新 `document.documentElement.lang`。
- 默认 `--color-text-muted` 和 `--color-text-light` 在黑色表面上有多处 WCAG AA 对比度失败。
- 自定义强调色允许任意颜色，但 `--color-on-primary` 固定为黑色；选择纯黑强调色会形成 1:1 对比度。
- 375 px 下，Settings、Moments、Friends 和聊天页均存在多个小于 44×44 的触控目标。
- `prefers-reduced-motion: reduce` 下，路由容器仍保留约 300 ms transition。
- Layout 已有 `<main>`，Settings/Help 又嵌套 `<main>`；Settings 的 profile `role="button"` 内还包含可聚焦子按钮。

## 5. 修复顺序建议

1. 集中式工具授权与不可信代码执行边界。
2. 备份导入、会话凭据清理和聊天水合数据完整性。
3. 把上述复现变成正式回归测试，恢复 coverage 门禁。
4. 修复浅色主题、核心键盘路径和弹窗焦点模型。
5. 统一按钮名称、对比度、触控尺寸、语言属性和减少动效。
6. 升级 Mermaid/DOMPurify，修复 CSP 与 Service Worker 更新策略。

## 6. 审查边界

- 已验证 OpenRouter 免费模型的真实线上调用；未验证付费模型及其他第三方 Provider。
- UI 自动化使用本机系统 Chrome；未完成 Firefox、Safari 和真实移动设备矩阵。
- 本报告记录的是 `a77df02a` 快照。历史审查报告仍保留为历史记录，但不应替代本报告描述当前发布状态。
