# CONSENSUS — T03 Phase 4 继续开发

## 用户决策记录

1. **优先级**: T03 Phase 4 最优先开发
2. **T04**: 需另行组织专题讨论验证
3. **T05**: 需完整每日时间表 (详细时间节点、事件安排、角色活动规划)
4. **T06 好感度**: 每个角色仅一个统一聊天会话 (整合私聊+群聊), 需跨会话上下文记忆
5. **Bug**: 当前无已知 bug
6. **流程**: 完成 Phase 1 全部开发 → 验收 → 启动 dev server 测试

---

## T03 Phase 4 — 需求边界

### 明确范围

1. 将现有内联 Tailwind 按钮样式迁移到 CSS 组件类 (`.btn-*`)
2. 聊天界面重新设计 — 简洁消息列表, 最小化界面元素
3. 设置页面重新设计 — 分组区块, 现代切换控件
4. Dashboard 精修 — Bento Grid 优化

### 明确排除

- 自定义强调色选择器 (后续特性)
- 键盘快捷键 (后续特性)
- 新手引导教程 (后续特性)
- 无障碍审计 (后续特性)

### 验收标准

- 所有页面使用 CSS 组件类而非内联 Tailwind 样式
- 暗色模式下所有页面样式正确
- 项目 `npm run build` 成功, 无新增 Warning
- 视觉设计符合 iOS 26 Liquid Glass + ChatGPT Fluid Minimalism 风格

### 技术约束

- 使用 `index.css` 中已有的设计系统 (btn/input/card/modal/glass)
- 保持 TailwindCSS 用于布局 (flex/grid/spacing), 但外观类使用 CSS 组件类
- 保持与现有代码风格一致
- 不引入新的外部依赖
