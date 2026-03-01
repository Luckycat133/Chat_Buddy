# CONSENSUS: T10 Social & Interaction Features (Phase 3)

## 版本 v0.2.6 — Phase 3 剩余功能

---

## 已确认的需求与实现方案

### 功能 1: 成语接龙（Idiom Chain）

- **实现决策**: 通过 AI API（`callAI`）驱动，AI 扮演裁判和对手
- **触发入口**: `GameSelectorPanel` 新增第三个游戏选项
- **新增组件路径**: `src/features/chat/components/IdiomChainGame.jsx`
- **语言限制**: 仅在 `language === 'zh'` 时显示该游戏（GameSelectorPanel 中条件渲染）
- **游戏规则**: 用户输入成语，AI验证接龙合法性并提供下一个成语；超时或失败时游戏结束
- **积分奖励**: 每成功接一轮 +5 积分（通过 `addPoints`）
- **消息上报**: 游戏结果以 `[GAME:IDIOM:成功轮数]` 格式发送聊天消息

### 功能 2: AI 问答测试（Trivia Quiz）

- **实现决策**: 聊天栏附加菜单触发，AI 根据当前聊天历史生成测验题，长久保存到 IndexedDB
- **触发入口**: `ChatComposer` 附加菜单（More Options 菜单）新增"测验"入口
- **新增组件**: `src/features/chat/components/TriviaQuizGame.jsx`
- **存储方案**: 新增 `src/features/chat/services/TriviaStore.js`（IndexedDB，`chat-buddy-trivia`）
- **数据结构**: `{ chatId, personaId, generatedAt, questions: [{q, options, answer, userAnswer, correct}], score }`
- **题目生成**: 提取最近50条非系统消息，构造 Prompt 让 AI 生成 5 道选择题（JSON 格式）
- **历史回顾**: 弹窗内置"历史测验"Tab，列出过去记录（时间、角色、得分）
- **消息上报**: 完成后以 `[TRIVIA:得分/5]` 格式发送聊天消息

### 功能 3: 好友互动时间轴（Friend Interaction Log）

- **实现决策**: 独立沉浸式弹窗（全屏模态框），绑定角色头像作为入口
- **触发入口**: `FriendDetail.jsx` 中新增"查看回忆时间轴"按钮（成就记录图标）
- **新增组件**: `src/components/InteractionTimeline.jsx`（全屏/沉浸式弹窗）
- **数据来源**: 组合 `FriendContext.interactions`、`SocialContext.checkIns`、`socialData.gifts`、`socialData.intimacy` 推导里程碑事件
- **里程碑类型**（自动推导）:
  - 🤝 初次对话（根据 `FriendContext.interactions` 中首条 `CHATTED` 记录）
  - ❤️ 亲密度升级（detected by intimacy 跨越关键节点 20/40/60/80）
  - 🎁 送出礼物（来自 `socialData.gifts` 中该角色的记录）
  - 📅 第一次签到
  - 🏆 成就解锁（来自 `socialData.achievements`）
- **存储扩展**: 在 `FriendContext` 中扩展 `recordMilestone(friendId, type, meta)` 方法（写入 `localStorage`）
- **设计风格**: 竖向滚动时间轴，顶部大头像 + 陪伴天数统计，底部显示第一次对话日期

### 功能 4: 排行榜（Leaderboards）

- **实现决策**: 仅展示用户自身各项数据的"个人荣誉版"，不引入虚拟竞争
- **触发入口**: `AchievementsPage.jsx` 底部新增"我的数据"区块 或 顶部 Tab 切换
- **新增组件**: `src/components/StatsLeaderboard.jsx`（内嵌至 AchievementsPage）
- **展示内容**:
  - 🏆 总积分
  - 🔥 最长签到连续天数（历史最大值）
  - 💬 最多对话角色（按消息数量排名 top3）
  - 🎮 游戏总场数 & 胜率
  - ❤️ 最高亲密度角色
  - 📖 成就解锁数 / 总数

---

## 技术约束

| 约束             | 说明                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| API 调用         | 使用 `callAI(messages, { temperature, maxTokens })` 统一接口                                      |
| 存储             | 成语接龙状态仅内存，Trivia 存 IndexedDB，里程碑 / 排行榜统计存 localStorage via `useLocalStorage` |
| 组件模式         | 新游戏组件延续 lazy-loaded 方式：`const XxxGame = lazy(() => import('./components/XxxGame'))`     |
| 消息格式         | 游戏结果以 `[GAME:TYPE:RESULT]` 形式发送，在 `MessageTimeline` cleanContent 中过滤                |
| 语言             | 所有新增 UI 文本添加到 `src/data/locales.js`（中英双语）                                          |
| 设计规范         | 沿用项目 CSS 变量（`--color-*`, `--radius-*`），不使用内联硬编码颜色                              |
| T09 ROADMAP 修正 | 同步将 ROADMAP.md 中 T09 更新为 `✅ Done`                                                         |

---

## 验收标准

| 功能        | 标准                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| 成语接龙    | 仅中文模式显示、AI 能接龙、游戏结果有聊天消息记录                       |
| Trivia Quiz | 附加菜单可触发、AI 生成5题、可查看历史测验、结果保存 IndexedDB          |
| 互动时间轴  | FriendDetail 按钮可打开全屏弹窗、显示里程碑时间轴、时间轴事件按时间排序 |
| 排行榜      | AchievementsPage 能展示个人数据统计、所有数值来自真实存储数据           |
| ROADMAP     | T09 状态更新为 Done，T10 更新为 Done                                    |
