# 共识文档 (Consensus)：T12 AI Memory & Cognitive System

## 1. 需求描述与验收标准

### 需求描述
T12 旨在为 Chat Buddy 实装“AI 记忆与认知系统”。该系统赋予虚拟角色独立且长期的个人记忆，使得角色能够积累与用户的互动事实、偏好和事件。角色之间可以有条件地交换记忆，记忆会有遗忘衰减机制，同时群聊上下文能够被角色在私聊中感知和引用。

### 验收标准 (Acceptance Criteria)
1. **长期记忆存储**：成功在 IndexedDB 中按角色存储键值对形式的记忆，并且在系统 Prompt 中正确注入相关事实。
2. **记忆提炼**：在局部上下文触发压缩（达到触发阈值）时，系统异步调用大模型提炼新的“关键事实/偏好”，存储到对应角色的记忆数据库。
3. **独立记忆与群聊感知**：角色在私聊中能够回忆起用户最近参与的群聊记录（群聊摘要动态注入），且不同角色对未被分享的信息保持独立无知。
4. **记忆交换工具 (Tool)**：实现 `[MEMORY_REQUEST]` 工具标签及其处理逻辑，角色 A 能够请求角色 B 的记忆，并得到大模型生成的回应反馈给角色 A。
5. **遗忘机制**：长期记忆包含重要度分值和时间戳，低重要度旧记忆在提炼或读取时随着时间衰减，会被标记遗忘或丢弃。
6. **记忆 UI**：在 Settings > Character 设置中提供一个界面，展示该角色的长期记忆列表，并提供“全清”或“单条忘记”功能。

## 2. 技术实现方案、约束与集成方案

### 技术实现方案
- **存储**：
  - 新增 `MemoryStore.js`，使用 IndexedDB 存储记忆。结构体包含：`id`, `characterId`, `fact`, `importance` (1-10), `timestamp`, `lastRecalledAt`, `category`。
- **记忆生命周期**：
  - **提炼 (Extraction)**：将 `compressContext` 从 `chatService.js` 提取到新的 `ContextCompressor.js` 中。除去原有的生成摘要逻辑外，增加平行异步流，调用 LLM 提取关于用户的 Key Facts，通过 `MemoryStore.saveFact` 保存。
  - **衰减 (Decay)**：每次拉取记忆或定期检查时，基于 `importance` 和距上次被回忆的时间更新记忆存活状态。
  - **注入 (Injection)**：`AIPipeline.js` 生成提示词前，检索高权重的事实加入系统设定中：“你关于这个用户的记忆...”。
- **群聊与私聊上下文融合**：
  - `ChatEngine` 或 `MemoryInjector` 获取用户最近的活跃群聊记录摘要，组装为一段简短的前提上下文注入私聊的 System Prompt 中。
- **记忆交换与 Tool**：
  - 在 AI 的 `tools` 列表中增加 `3. MEMORY REQUEST - [MEMORY_REQUEST: target=Name, topic=Content]` 指令。
  - `AIPipeline.js` 和 `MemoryExchange.js` 解析此工具调用，并在后台用目标角色的设定和私有记忆发起一次无缝 LLM 会话进行请求，然后将最终文本视作 `[TOOL_RESULT]` 返回给请求者。
- **UI 集成**：
  - 扩展 `Settings` 组件，在对应的 Character Tab 下渲染 Memory 面板，提供只读列表和清除按钮。

### 技术约束 (Constraints)
- **Token 限制与开销**：控制异步提炼调用对 Token 的消耗，确保记忆提取和注入轻量级。
- **无感存取**：记忆存储的响应应非常快，不可阻塞 `AIPipeline.js` 处理实时交互的主流程。
- **独立性**：角色的长期记忆不可越界读取他人的存储空间。

## 3. 边界限制确认
- 暂不包含基于 Vector Embedding 的向量搜索/RAG机制（留给 T14）。目前纯依赖关键词匹配和重要性权重提取记忆。
- 界面不提供“手动新增/编辑记忆”的操作，仅允许删除（忘记）。

## 4. 不确定性解决状态
所有前期的架构和交互疑问点均已根据建议进行了需求明确和规范共识。
