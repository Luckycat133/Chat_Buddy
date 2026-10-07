---
trigger: always_on
---

# 项目接续要点

先读 README.md 当前维护范围与 WEB_TO_IOS_MIGRATION.md；Web 当前以关键修复和迁移为主。产品行为任务加载 .agents/skills/chat-buddy-web-demo-development/SKILL.md 并核对当前代码。保护导出备份与 IndexedDB，VITE_* 不是密钥保管位置；迁移设计、mock、真实浏览器数据往返与 iOS 导入分别留证，按当前任务范围验证。

<!-- Static counterpart of .codex/hooks/session_start.py CONTEXT; maintain together with CLAUDE.md project context. No runtime hook required. -->
