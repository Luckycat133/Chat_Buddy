# T13: AI Agent & Tool System - Consensus

## 1. 明确的需求描述和验收标准
- **Real Code Sandbox**: 支持多语言（确切涵盖 JS 与 Python 等基于 WebAssembly 的运行库），采用干净的隔离环境（Web Worker + Pyodide等）执行代码。
- **Custom Agents**: 用户可定制 Agent（名字、头像、系统提示语、关联技能），数据持久化至 IndexedDB。对应创建角色的 UI（Agent Editor）需要具备高复用性，为未来全量角色创建功能共享底层基础逻辑和组件。
- **Agent Collaboration**: 提供轻量级的 `delegate_task` 工具机制，使智能体能够在后台委派子任务给其它专注型智能体（例如大管家委派给 Coder 写代码），将其文本输出作为工具运行结果返回给发起方自身。
- **Tool Result Visualization**: 聊天信息流和工作台上必须有美观的工具运行过程状态组件（卡片式），支持悬浮或折叠形态的实时状态追踪展示（Loading、Success、Error），还需支持详情无缝排版展开，以此保证良好的信息层级并控制视觉展示不过度暴露。

## 2. 技术实现方案与架构对齐
- **Sandbox 执行环境**: 分离出单独的 `sandbox.worker.js`，通过通信将代码发送给 Web Worker 执行。Python 代码将在首次调度时于 Worker 内置拉取加载的 Pyodide 环境中运行。
- **数据存储**: 利用现有的 IndexedDB 或独立的 storage hook，建立 `customAgents` 命名空间。随后应用启动或者加载相关页面时，将用户数据与预定义的 `taskAgents.js` 数据合并后输送给前端。
- **React UI 和 消息结构扩充**: 将执行过程中各种 Tool State（如“正在搜索互联网”、“正在运行代码”）以结构化状态推送到前台流。由于原本使用 `MessageTimeline.jsx`，为它引入新的处理逻辑：当检测到包含 Tool 信息的片段或者单独结构的数据时，绘制专属的 Tool 卡片（并支持点按展开）。

## 3. 任务边界限制
- 重点仅在：代码沙盒构建、可复用角色编辑模块、委派机制加入和可视化卡片的响应四个部分。
- 我们不对 T12 以及之前已经固定的架构进行破拆反改，维持 `AIPipeline.js` 中 `[TOOL_CALL]` 正则识别范式的核心设计。
- 确保所有的修改不破坏针对第三方 OpenAI 等接口封装格式的要求传递。

## 4. 消除所有不确定性
- 所有决策已与用户的选择对齐（Sandbox Worker + 轻量委派 + 高复用 UI + 交互卡片）。
