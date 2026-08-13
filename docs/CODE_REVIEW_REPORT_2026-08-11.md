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
| `npm test`（请求预算修复后的当前套件） | 32 个文件、471/471 通过 |
| `TZ=UTC npm run test:coverage` | 32 个文件、471/471 通过；核心逻辑门禁通过：Statements 85.66%、Branches 76.61%、Functions 86.69%、Lines 88.86% |
| `TZ=UTC npm run test:coverage:all` | 471/471 通过；全仓观测值为 Statements 27.61%、Branches 25.00%、Functions 21.31%、Lines 28.88%，不作为单元门禁伪装成已全面覆盖 |
| `npm run lint` | 通过，0 errors、0 warnings |
| `npm run build` | 通过；已拆分高亮、Markdown、KaTeX、MathJS 与 Mermaid 懒加载产物，无 chunk 警告 |
| `npm audit --audit-level=low` / `pnpm audit --audit-level low` | 均通过，0 vulnerabilities |
| 生产预览 + 系统 Chrome | CSP、DENY、nosniff 与 Referrer-Policy 响应头生效；Service Worker 激活并接管刷新页面；0 console errors |
| `npm run test:e2e -- --project=chromium` | 21/21 通过 |
| `npx playwright test e2e/ux.spec.js --project=mobile-chrome` | 10/10 通过 |
| 远端 CI | 提交 `73283719` 的 CI 全部成功：[运行记录](https://github.com/Luckycat133/Chat_Buddy/actions/runs/31614255044) |
| 远端 CodeQL | JavaScript/TypeScript 与 Python 均成功：[运行记录](https://github.com/Luckycat133/Chat_Buddy/actions/runs/31614255014)；开放告警 0 |
| Dependabot | 开放告警 0 |

### 2026-08-13 请求预算与最终 Provider 复验

用户提供的 OpenRouter 活动截图显示一次验收期内累计 276 次调用，且分散到多个候选模型。计数中包含候选模型验证和多轮真实 UX 测试，但代码审查也确认原实现存在自动标题、LLM 记忆提取、群聊多角色 fan-out、后台朋友圈生成、递归工具、主动图片和自动重试等隐式消耗路径。本轮已改为可验证的固定预算：

| 用户动作 | 当前动态请求预算 | 真实浏览器结果 |
| --- | ---: | --- |
| 普通角色 / Agent 回复 | 1 次固定 OpenRouter 模型 | 露娜跨话题一次流式请求完整回忆 7 类事实；Coder 一次请求生成的 TypeScript Hook 在临时工程中 4/4 测试通过；无 fallback、无自动重试 |
| 需要模型判断参数的工具 | 2 次固定模型 + 1 次工具 | 首轮只发送匹配的工具 schema，工具结果可见，第二轮不再发送 schema 并负责解释结果 |
| 群聊用户消息 | 1 位角色、1 次模型 | 两位角色群聊只选择麦克斯回复，没有并发 fan-out |
| 长期记忆、标题、朋友圈后台内容 | 0 次模型 | 记忆由 IndexedDB 本地按分句提取，最多注入 8 条；清空话题后仍准确回忆姓名、搬家日期/地点、黑猫、玩具和作息；朋友圈空闲 10 秒无动态请求 |
| 参数明确的数学、知识竞答、成语、配色、学习状态 | 0 次模型 | 自然语言库存题本地得到 66；科学竞答启动和答题均无动态请求 |
| Scholar 明确联网 | 1 次 Tavily + 1 次模型 | 两个请求各一次，展示两条当前 OpenRouter 官方文档链接 |
| Pixel 明确生成图片 | 1 次 MiniMax，0 次 OpenRouter | 橘猫抱蓝色小鱼插画生成成功；会话摘要显示“[照片]”而非 base64 源码 |
| 用户点击朗读 | 首次 1 次 MiniMax TTS，重复 0 次 | 第二次播放命中缓存 |

最终默认模型固定为 [`nvidia/nemotron-3-ultra-550b-a55b:free`](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free)，不使用会随机切换的 `openrouter/free` 路由器，也不设自动备用模型。OpenRouter 的[免费模型榜单](https://openrouter.ai/collections/free-models)和[编程模型榜单](https://openrouter.ai/collections/programming)将 Ultra 列为免费长上下文/工具模型和主要编程模型；当前公开元数据为 1,000,000 context、65,536 max completion、输入/输出价格为 0，支持 tools、tool choice 和 reasoning 参数。请求显式使用 `reasoning: { effort: "none", exclude: true }`：关闭的是可选扩展思考 token，不是模型正常回答或函数调用能力。

最终选择不依赖单次 HTTP 200。Ultra 在相同配置下可一次流式请求逐项回忆全部人物事实；Coder 生成的 `useDebouncedValue<T>` 与 Vitest/RTL 用例被抽到临时 TypeScript 测试工程后 4/4 通过。Lightning 虽然较快，但真实 Coder 回答混用 Jest/Vitest API、使用不存在的 `screen.unmount()`，并错误声称 `fetch` 会对 HTTP 404 reject；Super 的事实回忆花费约 22 秒，代码回答约 35 秒，仍含浏览器项目不稳定的 `NodeJS.Timeout` 和无效 `expect(true)` 清理测试；North Mini Code 的社交回忆正确但代码测试时序错误，Laguna S 2.1 首请求返回 429。这些请求是一次性候选验收，不是产品运行时的多模型路由。

上下文现完整保留当前用户输入，并最多携带 48 条近期消息 / 100,000 字符；输出上限按任务设为 1,600–6,144 tokens。超过 56 条消息后才进行本地抽取式压缩，旧上下文摘要不会覆盖近期原文；图片 base64 等传输载荷会替换为语义标记，不挤占文本上下文。长期记忆会将分号分隔的耐久事实分别保存，按相关性最多注入 8 条，召回指令本身不会被误存为新事实。每轮系统提示按当前任务动态组装：角色身份只出现一次，时效性约束与工具规则仅在相关问题中注入；否定式要求“不要为了简短而省略”不再误触发短答。Scholar 的证据摘要优先保留最相关句子，并更新为当前官方免费路由文档路径。

`npm run prompt:bench` 已按当前 Scholar、Muse 与动态 turn 的实际所有者修复，并验证长上下文、两次工具请求上限和翻译协议没有回退。HEAD 到当前工作树的专业角色与翻译提示词合计从约 1,275 增至 1,421 estimated tokens（+146，+11.5%）；增加集中在更严格的 Coder/Sensei 可执行性要求。这里不追求压缩用户能力，节省量来自移除 fan-out、后台模型工作流、隐藏重试和不相关的逐轮提示段落。

真实长答验收先暴露了两次不可接受的中间状态：否定式“不要简短”曾被错误判为短答，令复杂 Coder 请求只有 800-token 上限；修正预算后，Nemotron 的可选扩展推理仍会把内部草稿写入 `content`/`reasoning` 并以 `length` 结束。当前显式使用 `effort: "none"` + `exclude: true`，服务层也拒绝展示 reasoning-only 内容。任务 Agent 与角色回答都会在单请求中流式更新同一条临时消息，并做 100ms/160 字符节流；最终消息原位落盘，不增加请求。

真实模型工具复测使用自然语言圆面积问题：首轮仅携带 `execute_math` schema，模型分别生成 `pi * 9.5^2`、`pi * 8.25^2` 和 `pi * 7.75^2`；本地计算为 11–21ms，UI 显示可访问的“数学计算：完成”状态与耗时；第二轮不携带工具 schema，总预算严格为 2 次。真实免费上游有一次四舍五入为 `283.53`，另一次等待较长后只回一个汉字；这些中间失败促成确定性结果保护。最终实现直接从已验证本地工具结果补全 `188.69190875623696` 和 `60.0625 * pi`，丢弃无意义的单字片段，并明示上游说明不完整；Chromium 与移动 Chrome E2E 均验证了该页面路径，且不会发第三次请求。

- https://openrouter.ai/docs/guides/routing/routers/free-router
- https://openrouter.ai/docs/guides/routing/model-variants/free

### 2026-08-13 早期 OpenRouter Provider 验收（历史记录）

> 以下为同日较早阶段的验收记录；模型可用性判断曾随缺陷暴露而变化，最终结论以上方固定 Ultra + `effort: "none"` 的复验为准，其余方括号、语言检测、图片和安全修复证据仍有效。

- 从 `crouter` 已登记的 macOS Keychain 项读取 OpenRouter key，并只比较、不输出地确认它与 Git 忽略的本机 `.env` 一致。浏览器持久配置只保存地址和模型；密钥没有写入 localStorage 或 Git。设置面板密码值可能进入 Playwright 快照/trace，因此相关临时资源已立即删除。
- 当时根据 OpenRouter [官方免费模型榜单](https://openrouter.ai/collections/free-models)和[免费变体说明](https://openrouter.ai/docs/guides/routing/model-variants/free)暂选 `nvidia/nemotron-3-ultra-550b-a55b:free`；后续暴露的空白 token / 截断问题已定位到可选扩展推理及不可靠的工具整合输出，当前通过 `effort: "none"`、reasoning 排除和本地工具结果保护修复，模型保持固定为 Ultra。
- API 直连预检返回 HTTP 200，2,633 ms，实际响应模型与请求模型一致。网页设置中的连接测试也通过，持久配置只保存 `https://openrouter.ai/api/v1` 与模型名。
- 任务 Agent“代码”真实对话发现用户代码 `xs[1]` 和模型回复 `xs[0]` 被本地控制标签清洗误删。请求/响应取证证明模型原始输出正确；修复后请求体、原始响应和最终页面三层均保留方括号，Agent 给出正确最小 diff。该轮免费容量下自动标题与对话请求的浏览器网络耗时分别为 46,819 ms 和 48,858 ms。
- 虚拟角色“露娜”真实回复耗时 21,570 ms，返回简体中文并保持温柔、星空意象和简短提问的角色设定；页面 0 console errors。
- 同时修复“中文说明 + JavaScript 标识符”被误判为英文的问题，并把 `items[1]`/`items[0]` 纳入桌面与移动 Chrome 回归。
- Nemotron 默认可启用扩展推理，原 20-token 自动标题请求曾把预算全部用于 reasoning 并返回空正文。自动模型标题现已删除，普通请求统一发送 `reasoning.effort="none"` 且 `exclude=true`；真实复测为 0 reasoning token，话题标题改由本地生成。
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

真实浏览器复测还发现通知模块会在启动时请求仓库中不存在的音频文件，开发模式下又会被生产 Service Worker 接管为 `408 Offline`。现已改为按需使用 Web Audio 生成短提示音，并限制 Service Worker 只在生产环境注册；启动控制台回归已纳入 21 项桌面验收。

推送后的 CodeQL 复核进一步暴露了历史正则清洗、头像 URL、图片 API key 持久化及工作流权限问题。当前实现已改为 DOMPurify 解析式清洗、栅格图片 URL 白名单、图片密钥仅内存保存并迁移删除旧值、配置持久化字段白名单和 CI `contents: read` 最小权限；数字猜谜也改用无模偏差的 Web Crypto 随机数，同时删除 222 个误提交的旧覆盖率生成文件。当前回归套件已扩展至 471 项单元测试。

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
