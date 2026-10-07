# 项目 SessionStart 提示

2026-10-03：仅在 startup/resume/compact/clear 注入本项目的短接续提示。配置为 `.codex/hooks.json`，实现为 `session_start.py`；提示内容及来源指针可直接在脚本顶部审阅。

- 只用 Python 标准库；不读对话、密钥、业务数据或 Git index，不写状态、不联网、不启动模型/引擎，不自动运行测试。
- 3 秒超时，additionalContextLimit=500；输出仅为 SessionStart additionalContext，不阻断，不改权限，不增加 Stop 续跑。
- 从当前物理工作目录向上寻找本项目脚本；支持非 Git 项目、嵌套目录和含空格路径。脚本另校验自身真实路径、进程 cwd 与 payload cwd；遇到嵌套 Git、AGENTS 或独立 Codex 配置边界则安静跳过，避免父项目提示越界。
- 未知事件/source、无效或过大 JSON、缺 cwd、越界/不存在目录均输出 `{}` 并成功退出。Python 不可用也放行。
- 这是提示入口，不是模型/测试/运行时状态探测器；具体任务依有效 AGENTS 和当前用户授权进行。

本次验证为隔离临时目录中的脚本/配置调用，包括坏 payload、根目录/子目录/空格路径、非 Git、嵌套项目与软链接边界；不代表原生客户端已经加载。

Codex 会按配置哈希要求审阅和信任新增 hook；需在支持的客户端 `/hooks` 中核验。本项目不修改 trust 记录或使用绕过选项。官方协议：[Hooks](https://learn.chatgpt.com/docs/hooks)。
