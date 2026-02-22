# 变更日志

Chat Buddy 的所有重要变更都将记录在此文件中。

本文件格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
并遵循 [语义化版本](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

**版本架构：**

- `v0.1.x` — 基础层（国际化、API、UI 设计系统）
- `v0.2.x` — 基础角色扮演（角色、聊天、社交）
- `v0.3.x` — 基础智能体（记忆、智能体、RAG、专业能力）

---

## [未发布]

> 尚未分配到具体版本的计划功能。

---

## 基础角色扮演 — v0.2.x

### [0.2.7] — T11 朋友圈与动态系统（第二阶段）

#### 新增

- **草稿箱** — `PostComposer` 自动保存未完成的动态（防抖 500ms）；重新打开时恢复草稿并显示"草稿已恢复"提示条；支持"丢弃"按钮一键清除
- **话题标签** — 动态内容中的 `#话题` 标签渲染为可点击的主题色链接；点击后在朋友圈页面过滤相关动态；顶部显示可关闭的筛选标签条
- **分页加载** — 默认显示 10 条动态；底部"加载更多"按钮每次追加 10 条；切换标签筛选时自动重置分页
- **故事事件** — 每日首次加载时检测生日与节日；匹配角色自动发布主题动态；13 位角色均配置生日；支持 4 个节日（元旦、情人节、万圣节、圣诞节）；使用 `lastStoryEventDate` 防止重复触发
- **转发到聊天** — 新增 `RepostSheet` 底部弹窗，列出所有聊天列表；选择聊天后发送格式化消息 `[分享动态 · 作者]\n内容`；发送后显示勾选确认
- **角色生日字段** — 为 `personas.js` 中全部 13 位角色添加 `birthday: 'MM-DD'` 字段
- **新本地化键** — `discard_draft`、`load_more`、`repost`、`repost_success`、`select_chat_to_share`、`birthday_post_hint`、`happy_birthday`（中英双语）

#### 技术细节

- `MomentsState.jsx`：`DEFAULT_MOMENTS_DATA` 新增 `draft` 和 `lastStoryEventDate` 字段
- `MomentsActions.jsx`：新增 `saveDraft`、`clearDraft`、`generateStoryPost` action
- `MomentsContext.jsx`：新增 `useStoryEvents` hook，在 `MomentsAIOrchestrator` 中调用
- `momentsService.js`：新增 `generateBirthdayPostSystemPrompt`、`generateHolidayPostSystemPrompt`、`SEASONAL_EVENTS`、`getTodayEvents`
- `RepostSheet.jsx`：新组件，使用 `useChatService` 获取聊天列表和发送消息

---

## [0.2.7-patch] — 审计修复（2026-02-22）

> 基于 v1.0 质量审计报告的全面修复——所有 P0/P1 阻断问题已解决，P2 视觉缺陷已修补。

### 修复

- **L-002 (P0)** — `FriendDetail.jsx`：「发起聊天」按钮现已正确跳转至已有私聊或通过 `createChat()` 创建新会话；已有对话时按钮文案自动变为「查看聊天」
- **L-003 (P0)** — `ChatEngine.js`：新建会话立即通过 `this.save()` → `StorageService.set()` 持久化；`_loadChatsWithMigration()` 支持旧 key 回落，保证零数据丢失
- **T08 / B-001 (P0→P1)** — `MessageTimeline.jsx`：完整 Markdown 渲染（`react-markdown` + `remark-gfm`）；代码块语法高亮（VS Code 主题）+ 复制按钮；LaTeX（`rehype-katex`）；Mermaid 图表；表格样式
- **B-002 (P1)** — `GroupDetails.jsx`：「群公告」和「群投票」入口已通过 `!isDirectChat` 条件守卫；1v1 私聊详情页不再显示群组专属选项
- **B-003 (P1)** — `ProfileEditor.jsx`：昵称字段验证非空 trim 值；内联 `nicknameError` 状态阻止保存空白昵称
- **B-004 (P1)** — `ChatList.jsx`：搜索 `filteredChats` useMemo 正确按 `searchTerm` 过滤聊天名和最近消息预览
- **T02 (P1)** — `ApiConfigPanel.jsx`：模型名输入框新增 `<datalist>` 包含 16 个常用模型建议（GPT、Claude、Gemini、DeepSeek、Qwen、GLM、Moonshot）；新增 5 个「一键填入」厂商预设按钮（OpenAI、Anthropic、Google、DeepSeek、Ollama）自动填充 Base URL 和模型名
- **G-001 (P2)** — `index.css`：亮色模式抑制深色辉光伪元素——`html:not(.dark) .message-bubble-ai::after { opacity: 0 }` 和 `html:not(.dark) .character-glow::before { opacity: 0 }`
- **G-002 (P2)** — `index.css`：亮色模式侧边栏非激活导航图标改用 `#4a4e6a`（符合 WCAG AA），替代对比度不足的半透明 `--color-text-muted`；悬停恢复品牌主色
- **R-001 (P2)** — `index.css`：新增 `@media (min-width: 768px) and (max-width: 900px)` 断点——侧边栏从 88px 收缩至 56px，图标等比缩小，悬停 tooltip 隐藏，防止平板宽度下布局溢出
- **R-002 (P2)** — `index.css`：移动端 `.page-content` 已设置 `padding-bottom: calc(6.5rem + env(safe-area-inset-bottom))`，防止固定底部导航栏遮挡列表内容
- **T03 — OLED** — `ThemeContext.jsx`：`toggleOLEDMode()` 和 `.dark.oled` CSS 类完全可用；Settings 页 UI 控件已验证
- **T03 — 快捷键** — `Layout.jsx` + `useKeyboardShortcuts.js`：全局 `keydown` 监听已激活；`Ctrl+1~5` 导航、`Ctrl+/` 快捷键弹窗、`Esc` 返回/关闭全部正常


## 基础层 — v0.1.x

### [0.1.3] — T03 现代 UI 设计系统

> 设计语言：iOS 26 液态玻璃 + ChatGPT 流畅极简

#### 新增

- **深色模式 & OLED**
  - 全组件 `.dark` 模式 CSS 变量覆盖
  - OLED 纯黑变体（`.dark.oled`，`#000000` 背景）
  - 毛玻璃工具类：`.glass`、`.glass-strong`、`.glass-crystal`、`.glass-aurora`
  - WCAG AA 文本对比度合规
  - 增强阴影深度，强化视觉层次
- **Bento Grid 仪表盘**（`/dashboard`）
  - `BentoGrid.jsx` 和 `BentoCard` 组件，7 种尺寸预设
  - 骨架屏加载态与响应式列自适应
  - 8 类小部件：最近聊天、每日签到、AI 智能体、朋友圈预览、好友、成就、今日推荐角色、统计
  - 基于时间的动态问候语
- **布局与导航**
  - 响应式侧边栏 + 底部导航栏
  - 关于页面（版本信息）
  - 帮助与 FAQ 页面
  - Chat Buddy Logo
  - 通知设置（提示音、免打扰、浏览器推送）

#### 变更

- 组件主题化重构：Settings、Layout、ChatWindow、ChatHeader、ChatComposer 中硬编码的 `bg-white` 替换为 CSS 变量
- 优化深色模式下的滚动条、选区和输入框样式

#### 计划

- 液态玻璃设计语言全面重构（模糊层次、折射效果、动态透明度）
- 以对话为中心的极简布局（参考 ChatGPT）
- 自动检测系统 `prefers-color-scheme`
- 定时主题切换（日出/日落）
- 自定义主题色选择器（不仅限橙色）
- 主题切换过渡动画
- 仪表盘小部件可拖拽/隐藏
- 应用内通知中心
- 键盘快捷键（桌面端）
- 新手引导教程

---

### [0.1.2] — T02 核心架构与 API 兼容性

> 任何 OpenAI 格式的 API 都应即插即用。

#### 新增

- DeepSeek API 集成
- `APIClient.js` 基础 HTTP 客户端（含重试/超时）
- `aiClient.js` 单例客户端（支持 Perplexity/DeepSeek/OpenAI 兼容格式）
- `StorageService.js` 带 `chat-buddy:` 命名空间
- LocalStorage 持久化聊天记录和设置

#### 计划

- **统一配置文件**（`config.yaml` 或 `.env`），开发者可便捷配置自定义 URL、API Key 和模型名
- 完整 OpenAI Chat Completions 格式兼容（messages/tools/streaming）
- 设置中多 Provider 切换
- 数据导出/导入（JSON 备份恢复）
- IndexedDB 支持（大数据量场景）

---

### [0.1.1] — T01 国际化与本地化

> 全 UI 的双语基础设施。

#### 新增

- 英/中双语支持，无缝语言切换
- `LanguageContext.jsx` 与 `useLanguage()` Hook
- `locales.js` 含 500+ 翻译键，覆盖全部 UI
- 增强的设置页面（微信风格 UI）
- 聊天列表搜索功能
- 群组详情中的 AI 能力设置

#### 修复

- 所有 UI 组件的本地化一致性
- 设置、聊天列表和群组详情的语言切换

#### 计划

- 浏览器语言自动检测
- 翻译键完整性审计（消除遗漏）
- AI 对话语言与 UI 语言独立设置
- 多语言架构预留（日/韩/西等）

---

### [0.1.0] — 项目初始化

> 最小可用聊天应用。

#### 新增

- Chat Buddy 首次发布
- 5 个具有独特性格的 AI 角色（Luna, Max, Bella, Oliver, Sophie）
- 一对一和群聊功能
- React 19 + Vite + TailwindCSS 4 技术栈
- 马卡龙橙主色调现代 UI

---

## 基础角色扮演 — v0.2.x

### [0.2.7] — T11 朋友圈与动态系统

> AI 驱动的社交动态广场——社交体验的顶层。

#### 新增

- **朋友圈/动态**
  - 文字+图片发帖、点赞、评论
  - AI 基于性格自动发朋友圈
  - API 驱动的 AI 动态生成
- **AI 社交智能**
  - AI 上下文感知评论
  - AI 之间互相评论互动
  - AI 内容搜索（记得自己发过的朋友圈，可搜索群聊）
- **互动功能**
  - 表情回应（😂❤️👍🔥😮😢）
  - 评论回复线程
  - 回复评论功能
- **微信风格控件**
  - 位置标签（支持二次元世界）
  - 可见范围设置（公开/部分可见/不给谁看/仅自己）
- 图像生成 API 预留接口

#### 变更

- 完全重写 `MomentsContext.jsx`，添加 AI 编排能力
- 增强 `MomentCard.jsx`，添加表情回应和位置显示
- 更新 `PostComposer.jsx`，添加位置选择器和可见性设置

#### 计划

- 朋友圈转发/分享
- 话题标签 #hashtag + 话题聚合页
- 特殊剧情事件（节日/生日动态）
- 动态草稿箱
- 分页/懒加载性能优化
- AI 图片配图（待 API 接入）

---

### [0.2.6] — T10 社交与互动功能

> 社交基础设施——在朋友圈之前构建，设计保持克制。

#### 新增

- **用户资料**（头像、昵称、签名）
- **好友管理**（分组、星标、备注名、搜索）
- **好友详情面板**（快捷操作）
- **每日签到**（连续天数记录）
- **成就系统**（积分）
- **红包功能**（虚拟积分）
- **礼物系统**
- **石头剪刀布**小游戏

#### 设计原则

> 所有社交功能均为**被动可发现**（侧边栏入口、长按触发）。不强制弹窗、不红点轰炸。积分和任务系统是"锦上添花"，非强制参与。

#### 计划

- 更多小游戏（猜数字、成语接龙、AI 出题）
- **积分消费场景**（解锁主题/头像/特效）
- 好友互动日志（里程碑记录）
- **每日任务系统**（扩展签到，多种日常任务）
- 排行榜（积分/签到/成就）
- AI 角色生日/节日事件

---

### [0.2.5] — T09 沉浸式背景系统

> 为每个角色和对话营造独特氛围。

#### 新增

- **背景管理**
  - `BackgroundContext` 全局和单聊背景控制，自动回落链：单聊 → 角色默认 → 全局主题
  - `BackgroundLayer` 平滑动画切换
  - `BackgroundSettingsModal` 四个标签页：主题库、动态、上传、调节
  - 存储键迁移至 `StorageService` 命名空间（`background:global-theme`、`background:chat-backgrounds`）
- **内容库**
  - 100+ 预设背景，12 个分类（精选、梦幻、超现实、热门IP、角色、自然、星空、简约、游戏、电影、小说、艺术）
  - 6 种动态动画预设：星尘粒子、北极光、城市雨夜、渐变流动、粉紫极光、萤火虫
- **动态背景**
  - `DynamicBackground` 组件，支持 4 种动画类型：
    - `particles` — 浮动粒子场
    - `aurora` — 渐变极光动画
    - `rain` — 雨滴下落动画
    - `gradient` — 流动网格渐变
  - 新增 `rainFall` 和 `gradientFlow` CSS keyframes
- **视差效果**
  - 图片背景支持鼠标跟踪视差（强度滑块 0–100）
  - 通过 `window` 的 `mousemove` 事件平滑驱动 `transform`
- **视频背景**
  - 支持输入 MP4/WebM 视频 URL 作为背景
  - 通过 `<video autoPlay muted loop playsInline>` 渲染
- **时间自动切换**
  - 可选的白天（6:00–18:00）/ 夜晚（18:00–6:00）背景自动切换
  - 每 60 秒检查一次时间，可独立配置
- **图片上传压缩**
  - Canvas 压缩：缩放至最大 1920×1080，JPEG 质量 85%
  - 文件大小验证：超过 10MB 拒绝并显示错误提示
  - 上传期间显示压缩进度提示
- **IndexedDB 图片存储**（`ImageStorageService`）
  - 自定义图片存储于 `chat-buddy-images` IndexedDB 数据库，不再占用 localStorage
  - 配置中只存储图片 ID（UUID），数据层在渲染时将 ID 解析为 base64
  - 首次启动时一次性迁移旧 localStorage 中的 base64 数据
- **背景配置导出/导入**（`BackgroundShareService`）
  - 当前配置导出为 `.json` 文件（去除 base64 以控制文件大小）
  - 导入时验证 `_type: "chat-buddy-background"` 魔法字段
- **完整国际化**
  - 所有硬编码字符串替换为 `t()` 调用
  - 在 `locales.js` 中新增 28 个 `background.*` 翻译键（中英双语）

---

### [0.2.4] — T08 Markdown 与内容渲染

> 纯渲染层——消息内容如何展示。

#### 新增

- 集成 `react-markdown` + `remark-gfm` 支持 GFM 语法
- 集成 `react-syntax-highlighter`（VS Code 暗色主题）
- 添加 `@tailwindcss/typography` 排版插件
- 支持表格、代码块、标题、列表等

#### 修复

- `cleanMessageContent()` 正则：`\s{2,}` → `[^\S\n]{2,}` 保留换行符
- 禁用 `\s*\|\s*` 替换以保留表格分隔符
- 消息气泡溢出：`min-w-0`、`overflow-hidden`、`overflow-x-auto`

#### 计划

- 代码块一键复制按钮
- 代码高亮主题切换（亮/暗适配）
- LaTeX 数学公式渲染
- Mermaid 图表渲染
- 链接预览卡片

---

### [0.2.3] — T07 消息功能增强

> 丰富的消息交互，接近微信体验。

#### 新增

- **表情与贴纸**
  - 8 分类表情选择器（支持最近使用）
  - 贴纸选择器
- **消息操作**
  - 右键菜单（复制、引用、删除）
  - 消息引用回复
  - 消息转发
  - 消息搜索面板
- **文件系统**
  - 文件上传（TXT、JSON、MD、JS、PY 等）
- **群组功能**
  - 群公告
  - 群投票

#### 变更

- 完全重写 `ChatWindow.jsx`，集成所有新功能
- 新增 60+ 翻译键完善双语支持
- ChatContext 添加 `deleteMessage` 方法
- 弹出菜单缩放入场动画

#### 修复

- 硬编码字符串导致的语言混杂问题
- 输入指示器改用翻译键

#### 计划

- 语音消息（录制和播放）
- 图片消息（占位——无视觉 API）
- 消息收藏/书签
- 消息置顶
- 群聊已读回执（显示谁已读）
- @提及特定角色
- 草稿自动保存
- 聊天记录导出
- 匿名投票 / 多选投票

---

### [0.2.2] — T06 AI 角色与头像体系

> 角色层——性格、头像、关系演化（不含记忆）。

#### 新增

- **角色扩展**
  - 8 个二次元角色 AI（初音未来、雷姆、远坂凛、漩涡鸣人、L、零二、亚丝娜、五条悟）
  - 为所有二次元角色生成定制头像
- **头像集合**
  - 13 个角色的真实自拍风格头像
  - 13 款新高质量角色头像
  - 10+ 款用户默认头像（水彩、3D、像素、写实、极简）
  - 增强的头像选择器 UI（分类清晰）

#### 计划

- **亲密度/好感度系统**（随交互演化，影响回复风格）
- **角色状态/心情系统**（影响语气和回复意愿）
- 自定义用户头像上传与裁剪工具
- 自定义角色创建器（已规划，暂不实现）

---

### [0.2.1] — T05 AI 行为拟人化

> 系统层模拟——让 AI 像真人一样使用聊天软件。

#### 新增

- **响应模拟**
  - 基于性格的响应延迟（`responseDelay`、`readDelay`、`typingSpeed`）
  - "已读"延迟模拟
  - 输入中指示器动画
- **主动行为**
  - AI 主动消息（`[SCHEDULE:X]` 工具）
  - AI 多条消息连续发送（像真人一样）
- **对话自动命名**
  - 新对话根据首条用户消息自动生成标题
  - AI 主题提取（最多 6 词）
- **时间显示**
  - 微信风格相对时间格式
  - 消息组间时间分隔符
  - 双语时间格式

#### 变更

- 重构 `ChatContext.jsx`，采用新 AI 消息架构
- 增强 `personas.js`，添加 `responseDelay`、`readDelay`、`typingSpeed` 配置

#### 修复

- AI 工具标记（`[MULTI:]`、`[REACT:]`、`[1][2]`）现已正确清除
- 不区分大小写的 MULTI 标签解析

#### 计划

- AI 在线/离线/忙碌状态模拟
- 基于时间的主动消息（早安/晚安问候）
- AI "正在编辑"状态（修改长回复时的视觉反馈）
- 消息撤回模拟（偶尔"撤回"增加真实感）

---

### [0.2.0] — T04 角色视觉与交互设计

> 每个角色的视觉身份——参考 Character.AI / ChatGPT / Grok。

#### 新增

- **角色主题系统**
  - 8 个角色专属配色方案（雷姆冰蓝、零二珊瑚红、未来翠绿、五条悟皇家蓝、远坂凛绯红、鸣人橙、L 深灰、亚丝娜珊瑚）
  - `CharacterTheme.jsx` 动态主题管理模块
  - CSS 变量（`--character-rem-primary` 等）
- **消息动画**
  - 弹跳 `bubbleIn` 入场动画
  - 波浪式 `typingWave` 指示器
  - 新消息头像脉冲效果
  - 消息气泡悬浮抬升效果
  - 连续消息交错动画延迟
- **角色辉光效果**
  - AI 消息气泡带角色主题色环境光
  - 悬停时辉光增强
  - 深色模式辉光可见性优化（35% → 45% 不透明度）
- **iOS 26 风格优化**
  - 全局圆角：44px → 24px
  - 弱化动画幅度
  - 更微妙的悬停/点击缩放效果

#### 修复

- 角色辉光导致的消息气泡溢出（`overflow-visible`）
- `prefers-reduced-motion` 动画性能优化
- 移动端布局溢出（聊天内隐藏底部导航、内边距修复）
- 过大圆角导致的消息文字裁切

#### 计划

- 角色主题色扩展到整个聊天界面（标题栏渐变、输入框高亮）
- 动画强度滑块（无/弱/标准/强烈）
- 消息气泡样式选择器（圆角/方角/尾巴变体）
- 参考主流 AI 产品对话界面设计模式
- 自定义角色颜色（用户覆盖预设配色）

---

## 基础智能体 — v0.3.x

### [0.3.3] — T15 专业智能体能力

> 每种智能体类型的深度专业化。

#### 新增

- **Muse 沉浸式翻译**
  - 反思式工作流：直译 → 润色（双步翻译）
  - 领域检测：技术 / 文学 / 通用
  - 智能格式保护：严格保留代码块、Markdown、HTML 标签
  - 术语管理（内置术语表）
- **Sensei 2.0 认知架构**
  - 半苏格拉底式教学（追问 / 提示 / 直接教学，基于挫败感检测）
  - GraphRAG 知识图谱（25+ 节点，覆盖数学/编程/科学）
  - 先修知识自动检查
  - 符号数学引擎（`math.js`）确保计算准确
  - LRS-Lite 学习进度追踪（掌握度、困难点、测验历史）
- **RouteLLM 成本优化**
  - 智能模型路由：简单查询 → 小模型，复杂推理 → 大模型/联网模型
- **Perplexity Sonar API 集成（Scholar）**
  - 实时网络搜索，引用支撑准确性
  - 结构化引用（`[1]` 标记，含标题、摘要、日期）
  - 双层控制（系统提示词控制风格，API 参数控制搜索）
  - 领域筛选预设（学术、新闻、技术）
  - 多跳深度研究（复杂问题）
  - 事实核查（可信度评分）

#### 计划

- 翻译原文/译文对照视图
- 知识图谱扩展 + 用户自定义节点
- 学习报告导出（PDF/图表）
- 搜索结果卡片化 UI（来源、日期、可信度可视化）
- 多模型切换面板 + Token 用量统计

---

### [0.3.2] — T14 知识库与 RAG 系统

> 文档增强的 AI 回复。

#### 新增

- **RAG（检索增强生成）**
  - TF-IDF 文档索引
  - 文本分块算法
  - 客户端相似度搜索
  - `DocumentContext` 知识库管理
- **AI 文件生成**
  - `[FILE:name:content]` 解析器
  - 下载生成的文件
  - 代码预览组件

#### 计划

- 真实向量嵌入搜索（本地 embedding API）
- 知识库管理界面（查看/删除/编辑文档）
- 增量文档更新

---

### [0.3.1] — T13 AI 智能体与工具系统

> 从角色扮演到任务执行的跨越。

#### 新增

- **任务智能体系统**
  - 6 个专业智能体：Coder、Muse、Scholar、Sensei、Aurora、Pixel
  - 模块化 Agent Skills 系统（17+ 可复用技能）
  - 联系人列表筛选标签：全部 / 社交伙伴 / 任务助手
  - 智能体占位头像（赛博朋克、水彩、极简风格）
- **ReAct 工具调用架构**
  - 推理+行动循环，支持自主行为
  - `toolService` 实现：`run_code`、`search_docs`、`web_search`、`analyze_data`、`cite_sources`、`generate_image`、`color_palette`、`check_grammar`、`translate`
  - 动态系统提示词支持
- **智能体工作区**
  - 独立聊天空间（`/agents/:agentId`）
  - 每个智能体拥有独立对话历史
  - 与主聊天列表分离

#### 变更

- 更新 `chatService.js` 支持动态系统提示词
- 重构 `ChatContext.js` 处理递归工具执行
- 升级本地化文件支持所有智能体类型和技能

#### 计划

- 真实代码沙盒执行（WebAssembly/iframe）
- Agent 间协作链
- 用户自定义 Agent
- 工具执行结果可视化
- Agent 历史任务记录与复用

---

### [0.3.0] — T12 AI 记忆与认知系统

> 核心创新——角色记忆独立 + 涌现式信息交换。

#### 新增

- **上下文压缩**
  - 长对话自动摘要
  - Token 使用优化

#### 计划

- **长期记忆**（跨对话持久化关键信息）
- **角色记忆独立**（每个角色拥有独立记忆空间）
- **群聊上下文共享**（群聊内容自动成为所有参与角色的上下文；私聊也可知群聊内容）
- **记忆交换工具**（角色可主动请求其他角色共享记忆）
- **涌现式行为架构**（角色自主决定是否分享、拒绝甚至撒谎——AI 自主决策，我们只提供工具和架构）
- 记忆容量管理与遗忘机制

---

[未发布]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.3.3...HEAD
[0.3.3]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.7...v0.3.0
[0.2.7]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Luckycat133/Chat_Buddy/releases/tag/v0.1.0
