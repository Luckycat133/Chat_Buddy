# 任务对齐文档：T12 AI Memory & Cognitive System

## 1. 原始需求
根据 `ROADMAP.md`，T12的主要目标是构建一个“AI记忆与认知系统”（AI Memory & Cognitive System），使得虚拟角色（AI Characters）能够拥有长期的、独立的个人记忆。记忆不仅是数据库查询，它应表现出涌现性、不完美性以及个性化的特征。

## 2. 项目和任务特性规范
### 现有架构环境
1. **存储后端**：已经封装了 `StorageService` 处理 `localStorage`，并且 `ImageStorageService` 中实现了 `IndexedDB` 存储（封装为异步方法）。
2. **AI处理管道**：`AIPipeline.js` 处理 LLM 调用的提示词组装和上下文准备，目前的上下文处理仅包含短期对话上下文和在 `chatService.js` 中的基于文本关键词的简单压缩 `compressContext`。
3. **角色模型**：角色在 `personas.js` 和 `taskAgents.js` 中定义，具有 ID、名字、性格、语调、亲密度（T06 中增加）。

### 需求和目标
**核心功能**：
- **长期存储 (Long-term memory storage)**:
  - 为每个角色提供键值对形式的记忆（事实、偏好、事件）。
  - 使用 `IndexedDB` 存储，按角色（Character）命名空间进行隔离。
  - 将记忆作为“你关于这个用户的记忆”注入到 System Prompt 中。
- **独立的角色记忆 (Independent character memory)**:
  - 每个角色只保留自己被告知过的信息。
  - 默认不支持角色的全知视角共享。
- **群聊上下文共享 (Group chat context sharing)**:
  - 群聊记录作为所有参与者的共同上下文。
  - 角色在私聊中可以引用群聊内容：“我看到你在群里提到 X...”。
- **记忆交换工具 (Memory exchange tool)**:
  - 角色可以使用内部工具指令：`[MEMORY_REQUEST: target=Luna, topic="user's birthday"]`。
  - 目标角色 AI 决定如何回应（分享真实信息、拒绝、撒谎等）。
  - 发起请求的角色会将得到的回应整合进自身上下文。
- **遗忘机制 (Forgetting mechanism)**:
  - 老旧且不重要的记忆会随时间褪色（衰减函数）。
  - 重要（高情感权重）的记忆持久保存。
  - 每个角色有记忆容量上限。
- **记忆 UI (Memory UI)**:
  - 提供设置界面查看每个角色记住了什么（Settings > Character > Memory）。

### 预期的重构点
- 将现有的上下文压缩逻辑从 `chatService.js` 提取到 `src/core/memory/ContextCompressor.js` 中。
- 新建 `src/core/memory/MemoryStore.js` 专门负责每角色记忆的 CRUD 操作。
- 新建 `src/core/memory/MemoryExchange.js` 负责角色间的记忆请求工具和响应逻辑。

## 3. 边界确认（任务范围）
- **包含内容**：IndexedDB上的记忆持久化、记忆的提取与系统提示词注入、跨角色记忆请求机制（Tool）、记忆的自然更新（在后台或交互后异步更新角色记忆）、设置面板中增加记忆查看UI、遗忘衰减机制。
- **不包含内容**：完整的 RAG 支持或向量搜索。记忆将是一个更高层的抽象，可以是简单的键值对（Key-Value Fact 字典），或带有权重的总结条目。向量检索的知识库属于 T14 范畴。

## 4. 需求疑问与决策点清单（需与您确认）
- **决策点 1：记忆更新触发时机**：角色何时将短期对话提取为“长期记忆”？是在每次发送消息后异步由LLM提取总结，还是在上下文窗口即将满载（调用 `ContextCompressor` 时）专门执行一次提取调用？
  - *建议*：在 `ContextCompressor` 触发压缩时，由单独的 LLM 调用将压缩内容提炼为 Key-Value 记忆事实保存到数据库，这样节省 token 和 API 开销。
- **决策点 2：群聊上下文同步机制**：群聊记录如何被不同角色独立存储？或者不需要存储到长期记忆中，只要这部分记录作为“群聊上下文”能被正确归并在私聊上下文中即可？
  - *建议*：保留共同的群聊消息表，在生成某一角色的 Prompt 时，提取最近参与的群聊记录作为附加 Context 注入。
- **决策点 3：Memory UI 交互权限**：用户能否在UI界面手动编辑、删除或添加角色的特定记忆？
  - *建议*：本期仅提供“查看”(View) 以及“一键清除/忘记”功能，因为如果要支持手动CRUD，还要考虑UI的复杂性，且可能破坏AI的自然涌现感。

---
`6A工作流对齐阶段执行完成，请针对决策点清单进行确认。`
