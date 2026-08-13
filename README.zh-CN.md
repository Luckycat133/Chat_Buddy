# Chat Buddy Remake

<div align="center">

![Version](https://img.shields.io/badge/version-0.4.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg)
![Tests](https://img.shields.io/badge/tests-471%20passing-success.svg)
![核心覆盖率](https://img.shields.io/badge/core%20lines-88.86%25-success.svg)

**AI 聊天伴侣**

一个现代化的响应式AI聊天应用，支持多种个性角色、二次元角色、群聊和双语切换。

[English](README.md) | [中文](README.zh-CN.md)

</div>

---

> **维护状态**：Web 版本目前只接收关键修复与迁移工作，新产品开发已转向
> [Chat_Buddy_iOS](https://github.com/Luckycat133/Chat_Buddy_iOS)。迁移设备或测试 iOS 导入前，
> 请先在设置页导出 JSON 备份。
>
> **API 密钥提示**：浏览器构建中的 `VITE_*_API_KEY` 会进入公开 JavaScript；公开部署应使用
> 服务端代理，或要求用户在运行时输入自己的密钥。
>
> **最新审查**：安全、数据完整性、CI 与 UI/UX 修复已于 2026-08-13 通过真实 OpenRouter Agent/角色对话验证，详见
> [综合审查报告](docs/CODE_REVIEW_REPORT_2026-08-11.md)。

---

## 目录

- [功能特性](#功能特性)
- [演示](#演示)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [技术架构](#技术架构)
- [贡献指南](#贡献指南)
- [变更日志](#变更日志)

---

## 功能特性

### 🤖 AI好友系统

- **13位独特AI角色**：5位原创角色 + 8位二次元角色
- 每个角色拥有独特的性格、说话风格和兴趣爱好
- 支持 OpenRouter、DeepSeek、OpenAI 等兼容 OpenAI 的 API

### 🎌 二次元角色

与你喜爱的动漫角色对话：

- **初音未来** - 活泼的虚拟偶像
- **雷姆** - Re:Zero中忠诚的女仆
- **远坂凛** - Fate系列的傲娇魔术师
- **漩涡鸣人** - 永不放弃的忍者
- **L** - 死亡笔记中的天才侦探
- **零二** - 神秘的Darling
- **亚丝娜** - 刀剑神域的勇敢剑士
- **五条悟** - 咒术回战中最强的男人

### 💬 群聊功能

- 创建包含多个AI的群组
- AI不仅与你互动，彼此之间也会交流
- 可为每个群组自定义AI能力

### 🌍 双语支持

- 中英文界面无缝切换
- 所有UI元素、文档和AI回复都支持双语

### 🎨 现代UI设计

- "马卡龙橙"主题，微信风格设计
- 流畅的动画和响应式布局
- 支持桌面和移动设备

### 💾 本地存储

- 聊天记录和设置保存在浏览器中
- 无需账号
- 注重隐私保护

### 🖼️ 沉浸式背景系统

- **100+ 预设背景**，12 个分类：AI 精选、热门 IP（进击的巨人、原神、女神异闻录 5…）、角色、自然、星空等
- **动态动画背景**：浮动粒子、北极光、倾盆雨、流动渐变——纯 CSS 实现，无 Canvas 开销
- **单聊自定义**：每个对话独立背景，自动回落（单聊 → 角色默认 → 全局主题）
- **视差效果**：鼠标跟踪图片背景的深度位移（可调强度）
- **视频背景**：输入 MP4/WebM 链接作为循环背景
- **时间自动切换**：白天（6:00–18:00）和夜晚使用不同背景
- **自定义上传**：Canvas 自动压缩（最大 1920×1080，JPEG 85%）
- **IndexedDB 存储**：自定义图片存入 IndexedDB，不占用 localStorage 5MB 配额
- **导出/导入**：将背景配置导出为便携式 `.json` 文件分享

### 🤖 智能 AI 功能 (v0.2.1)

- **动态在线状态**：基于角色作息的实时在线/忙碌/离线状态
- **可视化输入指示器**：带动画气泡的输入状态显示
- **主动问候**：长时间未互动或回归时 AI 主动发起对话
- **多条消息**：AI 可以像真人一样连续发送消息
- **微信风格时间显示**

### 📸 朋友圈增强 (v0.2.4)

- **AI 动态发布**：AI好友根据位置及性格发布日常生活动态
- **智能互动**：AI会智能点赞并评论你的内容，具有上下文感知能力
- **微信风格功能**：支持位置标签、隐私设置及封面照片
- **表情回应**：使用 😂❤️👍🔥😮😢 快速回应朋友圈内容

---

## 快速开始

### 前置要求

| 要求             | 版本                 |
| ---------------- | -------------------- |
| Node.js          | `^20.19.0`、`^22.13.0` 或 `>=24.0.0` |
| npm              | v7+                  |
| 兼容 API Key | 可选，用于AI智能回复 |

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/Luckycat133/Chat_Buddy.git
cd Chat_Buddy

# 2. 安装依赖
npm install

# 3. 配置环境变量
# 复制.env.example为.env并编辑
cp .env.example .env
# 编辑.env配置你的API设置

# 4. 启动开发服务器
npm run dev
```

### 原生依赖故障排查（macOS Apple Silicon）

若出现以下报错：
- `Cannot find module @rollup/rollup-darwin-arm64`
- `Cannot find native binding`（`@tailwindcss/oxide`）
- `Cannot find module ../lightningcss.darwin-arm64.node`
- `The service was stopped`（`esbuild`）

执行：

```bash
rm -rf node_modules/@rollup/rollup-darwin-arm64 \
       node_modules/lightningcss \
       node_modules/lightningcss-darwin-arm64 \
       node_modules/@tailwindcss/oxide \
       node_modules/@tailwindcss/oxide-darwin-arm64
npm install
```

然后验证：

```bash
npm run lint
npm run test
npm run build
```

### 环境变量

| 变量              | 必需 | 说明                                        |
| ----------------- | ---- | ------------------------------------------- |
| `VITE_AI_API_URL` | 是   | API基础URL（如 `https://openrouter.ai/api/v1`） |
| `VITE_AI_API_KEY` | 是   | AI回复的API密钥                             |
| `VITE_AI_MODEL`   | 是   | 模型名称（默认 `nvidia/nemotron-3-ultra-550b-a55b:free`） |

> **Provider 配置**：默认快速选项为 OpenRouter，并固定使用一个免费模型；也可手动填写其他兼容 OpenAI 的端点。设置页输入的运行时密钥只存在 `sessionStorage`；构建期 `VITE_*` 变量仍会进入前端产物，生产环境应改用服务端代理。

> **安全说明**：如果你在应用内设置面板中输入凭证，API 密钥只保存在当前浏览器会话中。保存的服务方案只保留地址和模型，不保存密钥。

---

## 使用指南

### 创建聊天

1. 点击 **"+"** 按钮或导航到"新建聊天"
2. 选择一个或多个AI好友
3. 群聊时可设置群名称
4. 点击"创建聊天"开始

### 聊天

1. 在输入框中输入消息
2. 按回车或点击发送
3. AI会根据其性格和上下文回复
4. 群聊每个用户回合只选择一位合适的 AI 回复，避免多角色并发消耗请求

### 请求预算

- 普通虚拟角色或 Agent 回复调用 1 次当前文本模型；不自动切换模型，也不做隐藏重试。
- 工具参数明确时由本地预执行；确实需要模型判断参数时，会显示“模型选择工具 → 执行 → 解释结果”的工具流程，并允许 2 次文本模型请求。
- 会话标题、长期记忆提取、朋友圈后台内容、知识竞答、成语游戏、配色和确定性数学均在本地完成，模型请求为 0；最多按需注入 8 条独立耐久事实，不再额外调用模型生成记忆摘要。
- 明确要求学者联网时使用 1 次 Tavily 检索 + 1 次文本模型综合；明确生成图片时只调用 1 次 MiniMax 图片接口，不调用文本模型。
- 朗读只在用户点击后调用，音频生成后会缓存，重复播放不再请求。
- Provider 失败会显示可见错误和手动“重试”，不会在后台继续花请求。
- 请求优化不会牺牲用户任务：当前输入完整保留，可使用最多 48 条近期消息 / 100,000 字符；输出上限按任务设为 1,600–6,144 tokens。
- `npm run prompt:bench` 会守住这些能力契约。当前专业角色提示词为了强化 Coder/Sensei 指令，估算 token 有意增加约 146（+11.5%）；节省来自移除请求 fan-out 和每轮无关段落，而不是削弱回答。
- Agent 与虚拟角色都会流式更新同一条消息。固定 Nemotron 请求使用 OpenRouter `reasoning.effort: "none"` 并排除 reasoning；这是因为真实验收发现可选扩展推理可能耗尽回复预算，正常推理能力与函数调用仍保留。
- 上游回复若达到长度上限，已生成正文仍会保留并显示明确提示；数学工具的本地完整数值和符号形式始终优先，即使上游说明不可用也不会丢失。应用不会为此隐藏重试。

### 设置

- **语言**：切换中英文
- **主题**：马卡龙橙（默认）
- **API 配置**：保存的服务方案只保留接口地址和模型，设置页输入的 API 密钥仅当前会话有效
- **帮助**：查看FAQ和使用技巧
- **关于**：查看版本和变更日志

---

## 技术架构

> 详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

### 技术栈

- 前端：React 19, Vite
- 样式：TailwindCSS
- 状态：Clean Architecture (ChatEngine + Context)
- AI：固定的 OpenRouter / OpenAI 兼容文本模型；Tavily 与 MiniMax 只用于用户明确触发的搜索和媒体操作
- 存储：LocalStorage（轻量设置）+ IndexedDB（聊天/文档主数据、媒体与背景资源）

### 项目结构

```
src/
├── core/               # 领域逻辑（纯 JS）
│   └── chat/
├── services/           # 基础设施（API, 存储）
├── features/           # 功能模块
│   ├── chat/
│   └── moments/
├── providers/          # Context 组合
├── components/         # 共享 UI
└── pages/              # 路由
```

### 数据流

```mermaid
graph LR
    A[用户] --> B[ChatComposer]
    B --> C[ChatEngine]
    C --> D[AIPipeline]
    D --> E[AI API]
    E --> D
    D --> C
    C --> F[存储]
    C --> G[UI]
```

---

## 贡献指南

欢迎贡献代码！请遵循以下规范：

### 如何贡献

1. **Fork** 本仓库
2. 创建 **功能分支**：`git checkout -b feature/amazing-feature`
3. **提交** 更改：`git commit -m 'Add amazing feature'`
4. **推送** 到分支：`git push origin feature/amazing-feature`
5. 提交 **Pull Request**

### 代码规范

- 使用ESLint进行JavaScript/JSX代码检查
- 遵循React最佳实践
- 编写有意义的提交信息
- 为新UI文本添加双语支持

### 报告问题

- 使用GitHub Issues
- 包含复现步骤
- 提供浏览器和操作系统信息

---

## 变更日志

查看 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) 了解版本历史。

**当前包版本**：v0.4.1（以 `package.json` 为准）。

### 最近更新

- 🎨 **马卡龙现代版**（CHANGELOG v0.4.0 条目）：UI/UX 全面现代化；Bento 控制面板 v2；稳定的 HSL 颜色系统；现代化图标。
- 🤖 **专业智能体** (v0.3.3): 6 个专门的任务智能体 (代码、缪斯、学者、老师、极光、像素)；工具调用采用默认拒绝与角色白名单，浏览器任意代码执行已禁用。
- 🧠 **认知记忆** (v0.3.0): 长期角色记忆；IndexedDB 存储；记忆交换工具；上下文感知的 AI。
- 📚 **RAG 系统** (v0.3.2): 知识库集成；混合搜索 (BM25 + Jaccard)；客户端文档索引。
- 📝 **草稿箱** (v0.2.7): 自动保存未发布状态；重新打开时恢复，一键丢弃。
- #️⃣ **话题标签** (v0.2.7)：动态中 `#话题` 可点击过滤朋友圈，顶部显示可关闭筛选条
- ⬇️ **分页加载** (v0.2.7)：默认展示 10 条，"加载更多"按钮逐批追加
- 🎂 **故事事件** (v0.2.7)：13 位角色生日当天自动发帖，元旦/情人节/万圣节/圣诞节节日特供
- 📤 **转发到聊天** (v0.2.7)：将朋友圈动态以格式化消息转发到任意会话
- 📋 **每日任务系统** (v0.2.6)：6 项每日任务，每天最多获得 165 积分
- 🔢 **猜数字游戏** (v0.2.6)：7 次机会猜出 1-100 的秘密数字，猜对得 30 积分
- 🎮 **游戏选择器** (v0.2.6)：在聊天中选择石头剪刀布或猜数字
- 🖼️ **沉浸式背景系统** (v0.2.5)：100+ 主题预设，动态动画，每个对话独立背景
- 💕 **亲密度系统** (v0.2.2)：5 级亲密等级，AI 语气随关系升温而变化
- 😊 **心情系统** (v0.2.2)：5 种心情影响 AI 回复风格
- 🌐 **动态在线状态** (v0.2.1)：根据角色时间表显示在线/忙碌/离线

---

## 许可证

MIT许可证 - 详见 [LICENSE](LICENSE)。

---

<div align="center">

**为动漫爱好者和AI爱好者用 ❤️ 制作**

[⬆ 返回顶部](#chat-buddy-remake)

</div>
