# T13: AI Agent & Tool System (De-mocking) - Alignment

## 1. 原始需求
根据 ROADMAP.md 的 T13 阶段规划，当前需要完成 AI Agent & Tool System 的去 mock 化（de-mocking）与进阶功能开发。

**已完成部分**:
- 6个专业智能体 (Coder, Muse, Scholar, Sensei, Aurora, Pixel)
- Agent Skills 系统 (17+ skills)
- 基于 ReAct 的工具调用架构
- agent 工作区基础界面
- 基础 toolService (部分已接入真实API，如 Perplexity Sonar)

**待完成部分 (What's Planned)**:
1. **Real code sandbox**: WebAssembly 或是 iframe 沙盒，用于 JS/Python 执行 (目前 `run_code` 只是简单 `eval`)。
2. **Agent collaboration**: 智能体协作，即一个 Agent 能够把子任务委派给另一个 Agent。
3. **Custom agents**: 用户可自定义智能体（技能组合 + 系统提示词）。
4. **Tool result visualization**: 工具结果可视化（代码输出面板，搜索结果卡片等）。
5. **Agent task history**: Agent 任务历史记录（浏览和重用过去的 agent 会话）。

---

## 2. 需求理解与项目上下文
- **项目结构**: 目前所有 Agent 的配置在 `src/data/taskAgents.js` 内硬编码，如果要支持 **Custom agents**，必须扩展数据结构，支持把用户自定义 Agent 存入持久化存储（如 IndexedDB 或 localStorage）。
- **执行引擎**: `src/core/chat/AIPipeline.js` 实现了基础的 ReAct 执行。**Agent collaboration** 可能需要在 Pipeline 或 ToolService 中新增诸如 `delegate_task` 工具，使一个模型能调用另一个模型处理。
- **Real Code Sandbox**: 目前 `run_code` 仅把代码包裹在 `new Function` 中执行。如果是 WebAssembly，可能需要引入如 `pyodide` (Python) 和独立的 JS Worker 去做。
- **Tool Result Visualization**: 需要在 `MessageTimeline.jsx` 里针对特定格式的 `[TOOL_RESULT]` 内容进行拦截并渲染对应的 React 组件卡片。

---

## 3. 边界确认与任务范围
- **范围包含**: 完善沙盒、实现自定义 Agent 的增删改查 UI 和逻辑、添加工具结果可视化 UI、Agent 会话历史管理（可能结合 AgentWorkspace 现有逻辑）。
- **范围外**: 不改变当前应用的 UI 整体风格（保持 iOS 26 Design System），不大幅度改变除了 T13 相关组件外的其他 Chat 逻辑。

---

## 4. 关键决策点与疑问澄清 (需要用户确认)

在继续 Architects（架构设计）之前，有几个技术方案需要做出关键决策：

1. **Real code sandbox 的技术选型**：
   - 对于 JavaScript：是否只需使用 Web Worker + 限制的执行环境即可，还是需要更严格的 iframe sandbox？
   - 对于 Python（可选）：是否需要在本阶段引入 `pyodide`？如果引入会导致打包体积变大（约 10MB+），还是目前仅专注于 JS？

2. **Custom agents 的存储与 UI**：
   - 存储：建议和 `personas.js` 的内置角色类似，将其存放在独立的 IndexedDB store（如 `customAgents`），在 `AIPipeline` 执行前同内置 Agents 合并。
   - UI：在 AgentWorkspace 增加 "Create Custom Agent" 面板吗？

3. **Agent collaboration (专家委派) 的实现机制**：
   - 最简单的形式：给 Agent 添加一个 Tool `[TOOL_CALL: delegate_task {"agentId": "agent-coder", "prompt": "..."}]`。
   - ToolService 在后台调用被委派的 agent 的 LLM 生成回复，作为这个 tool 的 output 返回给主 Agent。是否认可这种模式？

4. **Tool result visualization**：
   - 当前在 `AIPipeline` 里是将 Tool 调用作为系统信息 (`[TOOL_RESULT for xxx]`) 发回给 LLM。如果要在前台可视化显示（例如用户点击执行了一次查询能看到漂亮卡片），是否在 Chat 记录中插入一条专门的消息，例如 `type: 'tool_result'`，由 `MessageTimeline` 渲染？

请确认以上决策，我们将基于此达成共识并生成 CONSENSUS 文档。
