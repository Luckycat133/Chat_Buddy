# CONSENSUS — T05 AI Humanization

## 已确认决策

| #   | 决策                    | 选定方案                                                                                        |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | **Online Status**       | **B — 基于时间/作息**。复用 `persona.schedule` (sleep/busy) 判断在线状态。                      |
| 2   | **Typing Bubble**       | **Yes**。在 `MessageTimeline` 对话流底部显示跳动气泡。                                          |
| 3   | **Proactive Greetings** | **Yes**。支持两种触发： ① 用户打开旧聊天(间隔 > N 小时)；② **长时间无消息时 AI 主动回流邀请**。 |

## 主动问候策略 (用户补充)

- **不要求每个角色都发**。应有节奏、符合心理学地轮流发送。
- **长时间无消息时**：系统选择 **一个** 角色主动发送回流消息，而非全部角色同时轰炸。
- **轮换策略**：基于权重/亲和度轮换，避免重复；最近互动最少的角色优先。
- **Cooldown**：同一角色至少 12h 间隔；全局至少 4h 间隔。

## 验收标准

1. ChatHeader 头像旁显示动态在线/离线/忙碌状态（基于 persona.schedule）。
2. MessageTimeline 底部在 AI 回复前显示 Typing Bubble。
3. 用户打开久未互动的聊天时，AI 发送一条时间相关的问候语。
4. 长时间无任何消息时，系统以轮换策略选择一个角色主动发送回流消息。
5. 问候不烦人：频率受 Cooldown 严格控制。

## 技术约束

- 复用 `persona.schedule` 字段，不引入新的 persona 配置字段。
- 所有新状态为 **ephemeral**（不持久化到 localStorage），Greeting cooldown 除外。
- 与现有 `ChatEngine` / `AIPipeline` 架构一致。
