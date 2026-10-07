#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Read-only SessionStart context; malformed or out-of-scope input fails open."""
import json
import sys
from pathlib import Path

CONTEXT = '先读 README.md 当前维护范围与 WEB_TO_IOS_MIGRATION.md；Web 当前以关键修复和迁移为主。产品行为任务加载 .agents/skills/chat-buddy-web-demo-development/SKILL.md 并核对当前代码。保护导出备份与 IndexedDB，VITE_* 不是密钥保管位置；迁移设计、mock、真实浏览器数据往返与 iOS 导入分别留证，按当前任务范围验证。'
ROOT = Path(__file__).resolve().parents[2]

def in_project(raw):
    if not isinstance(raw, str) or not raw or not Path(raw).is_absolute():
        return False
    current = Path(raw).resolve(strict=True)
    if not current.is_dir() or (current != ROOT and ROOT not in current.parents):
        return False
    # A nested repository or separately instructed project owns its context.
    while current != ROOT:
        if any((current / marker).exists() for marker in
               ('.git', 'AGENTS.md', 'AGENTS.override.md', '.codex/config.toml', '.codex/hooks.json')):
            return False
        current = current.parent
    return True

def main():
    result = {}
    try:
        raw = sys.stdin.buffer.read(65537)
        if len(raw) <= 65536:
            data = json.loads(raw)
            if (isinstance(data, dict) and data.get('hook_event_name') == 'SessionStart'
                    and data.get('source') in ('startup', 'resume', 'compact', 'clear')
                    and in_project(data.get('cwd')) and in_project(str(Path.cwd()))):
                result = {'hookSpecificOutput': {'hookEventName': 'SessionStart',
                                                'additionalContext': CONTEXT}}
    except (ValueError, TypeError, OSError, RuntimeError):
        pass
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
