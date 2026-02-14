# ALIGNMENT — T05 AI Humanization (AI 行为拟人化)

## 1. Context & Objectives (背景与目标)

**目标**: 让 AI 角色表现得更像真人，通过模拟真实的社交行为（在线状态、输入中、主动问候）来增强沉浸感。

- **关联任务**: T05 AI Humanization
- **涉及模块**: `ChatEngine`, `ChatState`, `ChatHeader`, `MessageTimeline`

## 2. Current State (当前状态分析)

| Feature              | Current Implementation                                   | Issues / Gaps                                                                   |
| :------------------- | :------------------------------------------------------- | :------------------------------------------------------------------------------ |
| **Typing Indicator** | `ChatEngine` 有状态; `ChatHeader` 显示 "AI is typing..." | 仅在 Header 显示，**Message Timeline (对话流) 中无波浪气泡**，缺乏视觉连贯性。  |
| **Online Status**    | `ChatHeader` 硬编码显示绿色圆点                          | **永远在线**。没有 "离线/忙碌" 状态，也没有基于时间的上下线逻辑 (如深夜离线)。  |
| **Greetings**        | 无                                                       | 用户打开聊天时 AI 像个死板的机器，不会根据时间 (早安/晚安) 或久别重逢做出反应。 |
| **Message Delay**    | `chatService.js` 有 `calculateTypingDelay`               | 逻辑存在但可能需要微调以匹配 "Typing Bubble" 的显示时长。                       |

## 3. Requirements & Proposal (需求与方案)

### 3.1 Online Status (在线状态模拟)

**逻辑**:
为此引入 `PersonaState`：

- **Online (在线)**: 默认状态。
- **Offline (离线)**: 模拟“睡觉”或“忙碌”。
  - _策略_: 简单的时间段逻辑 (e.g. AI 设定 23:00 - 07:00 概率性离线) 或 随机上下线。
  - _表现_: Header 头像变灰或显示离线图标; 发消息可能回复较慢或“留言模式”。

### 3.2 Typing Indicator (输入状态)

**改进**:

- **UI**: 在 `MessageTimeline` 底部增加一个临时的 "Typing Bubble" (三个跳动的点)，模仿微信/Telegram 体验。
- **Logic**: 当 AI 准备回复时，先推入 Typing 状态 -> 等待 Delay -> 移除 Typing -> 推入真实消息。

### 3.3 Time-based Greetings (主动问候)

**触发时机**:

- 当用户打开一个 _已存在_ 的聊天窗口，且最后一条消息间隔超过 $N$ 小时。
- _或者_ 用户在特定时间段 (6:00-9:00) 首次打开应用。

**行为**:

- AI 自动发送一条问候语 (e.g. "早安！今天起得真早", "这么晚了还没睡？")。
- **约束**: 频率控制 (一天最多一次/每个角色)，避免烦人。

## 4. Key Decisions & Questions (关键决策点)

为了进入下一阶段，请确认以下决策：

1.  **Online Status 复杂度**:
    - A) **简单随机**: 每次加载页面随机决定 AI 是否在线 (70% 在线)。
    - B) **基于时间**: 设定 AI 的作息时间 (e.g. 老师角色白天在线，夜猫子角色晚上在线)。
    - _推荐_: **B (基于时间)** - 更真实，且不仅是随机数。

2.  **Typing Bubble 位置**:
    - 确认是否要在对话流 `MessageTimeline` 中显示气泡？
    - _推荐_: **Yes** - 这比仅在 Header 显示更直观。

3.  **主动问候 (Proactive Greetings) 策略**:
    - 是否允许 AI 在用户**没有发消息**的情况下，仅因为用户打开了窗口就主动说话？
    - _推荐_: **Yes** - 但需严格限制频率 (Cooldown: 12h+)。

---

## 5. Next Steps

- 若达成共识，将进入 **Phase 2: Architect**，设计 State 结构修改。
