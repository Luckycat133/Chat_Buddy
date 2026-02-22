# 待办事项 (TODO)：T12 AI Memory & Cognitive System

## 🔴 需要人工操作/配置的事项

### 1. 无需额外配置
T12 完全使用现有的 API 配置（已在 `.env` 或 Settings > API Config 中设置）。记忆提炼会复用主 AI 接口，无需单独 API Key。

---

## 🟢 已完成（本次优化）

### ✅ 优化1: MEMORY_REQUEST 中的请求者 ID
- `AIPipeline.js` 现在将 `ai.id` 作为 `requesterId` 传递给 `executeTool`
- `toolService.js` 通过 `extras.requesterId` 接收并传递给 `requestMemory()`
- `MemoryExchange.js` 利用真实的请求者 persona 来构建更有温度的提示词

### ✅ 优化2: 记忆提炼的调用频率控制
- `ContextCompressor.js` 中新增 `_lastExtractionTime` Map
- 每个角色每小时最多提炼一次（rate key 为 `characterId`）
- 并行调用会被立即拦截（mark before await）

### ✅ 优化3: 群聊记忆提炼
- 新增 `extractGroupMemoriesAsync(messages, chatId, aiParticipants)` 函数
- `ChatEngine.sendMessage()` 在群聊消息累积到 20 条后，每 10 条触发一次（rate-limited per hour per character per group）
- Rate key 为 `{characterId}:group:{chatId}`，独立于单聊提炼

---

## ✅ 已自动处理，无需关注

- IndexedDB 数据库和 Object Store 会在首次访问时自动创建
- 记忆衰减在应用初始化时自动运行，无需手动触发
- 所有记忆提炼失败均会静默处理，不影响正常聊天

---

## ✅ 已自动处理，无需关注

- IndexedDB 数据库和 Object Store 会在首次访问时自动创建
- 记忆衰减在应用初始化时自动运行，无需手动触发
- 记忆提炼失败会静默处理，不影响正常聊天
