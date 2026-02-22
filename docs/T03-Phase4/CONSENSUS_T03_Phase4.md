# T03 Phase 4 — Consensus Document

## 需求描述

完成 T03 Modern UI Design System 的 Phase 4 收尾，包括：

1. **Chat View 重新设计** — 优化 ChatHeader 和 ChatComposer 的样式结构
2. **Settings 页面优化** — 用 CSS 变量替换硬编码颜色，统一样式
3. **内联按钮样式迁移** — 将重复的内联按钮样式提取为 CSS 组件类
4. **无障碍增强** — 为交互元素添加完整 ARIA 属性

## 验收标准

### Chat View
- [x] ChatHeader 中的重复按钮样式统一为 `.chat-action-btn` CSS 类
- [x] ChatHeader 布局使用语义化 CSS 类替代大段内联 Tailwind
- [x] ChatComposer 的按钮样式使用 CSS 组件类
- [x] 视觉效果保持一致，dark mode 正常

### Settings 页面
- [x] 移除硬编码 `style={{ color: '#FF9800' }}` 等内联样式
- [x] 确保所有颜色使用 CSS 变量或设计 token
- [x] Dark mode 下所有元素正常显示

### 按钮迁移
- [x] 重复出现的按钮模式提取为 CSS 组件类
- [x] 至少覆盖: icon 按钮、action 按钮、toggle 按钮
- [x] 不破坏现有功能

### 无障碍
- [x] 所有按钮有 `aria-label`
- [x] 所有表单输入有 `aria-label` 或关联 label
- [x] 模态框有焦点管理 (已有 useFocusTrap)
- [x] `role` 属性用于自定义控件

## 技术约束

- 不引入新 npm 依赖
- 使用现有 TailwindCSS 4 + CSS 变量体系
- 保持与 Phase 1-3 设计 token 的一致性
- 所有新 CSS 类添加到 `src/index.css`
- Dark mode 必须同步支持

## 不确定性

无 — 这是纯 UI/CSS 重构任务，不涉及业务逻辑变更。
