# Chat Buddy 综合代码与 UI/UX 审查报告

> **审查日期**：2026-08-11
>
> **代码快照**：`remake` / `a77df02a`
>
> **审查方式**：全库只读审查、临时干净导出、定向回归复现、系统 Chrome UI/UX 审计
>
> **当前状态**：问题仍待修复；本次提交只更新文档，不包含产品代码修复

## 1. 执行结论

当前版本可以完成安装、单元测试和生产构建，但不应被描述为“无阻塞问题”或“已准备部署”。审查确认了以下主要风险：

- 工具调用缺少统一授权门，浏览器 Worker 也不是安全沙箱。
- 备份导入可改变 API 端点并复用会话密钥，“清除全部数据”不会清除该密钥。
- IndexedDB 异步水合可能覆盖刚发送的消息。
- 单元测试通过，但仓库级 coverage 门禁仍为红色。
- 浅色主题、键盘可达性、弹窗焦点、按钮名称和颜色对比度存在系统性 UI/UX 缺陷。

本报告没有发现需要立即停机处置的 P0，但安全、数据完整性和核心无障碍路径中的 P1 应在下一次发布前修复。

## 2. 当前验证基线

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

- **证据**：[sandbox.worker.js](../public/sandbox.worker.js) 使用 `new Function` 执行代码。
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

- 未调用真实付费 AI API，也未验证第三方 Provider 的线上可用性。
- UI 自动化使用本机系统 Chrome；未完成 Firefox、Safari 和真实移动设备矩阵。
- 本报告记录的是 `a77df02a` 快照。历史审查报告仍保留为历史记录，但不应替代本报告描述当前发布状态。
