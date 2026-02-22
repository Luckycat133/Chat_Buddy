# T03 Phase 4 — Alignment Document

## 原始需求

完成 T03 Modern UI Design System 的 Phase 4 收尾工作。

## 需求边界

### 在范围内 ✅

1. **Chat View 重新设计** — 清洁的消息列表、最小化的 chrome 元素
2. **Settings 页面重新设计** — 分组区域、现代化切换开关
3. **内联按钮样式迁移** — 将分散的 `bg-[var(--color-primary)] px-X py-X` 统一到 `.btn` 组件类
4. **完善无障碍** — ARIA 属性审计、键盘导航完善

### 不在范围内 ❌

- T09/T10/T11 的新功能开发
- 新增页面或全新组件
- 修改核心业务逻辑 (ChatEngine/AIPipeline)
- PR 合并/分支管理

## 项目上下文分析

### 技术栈
- React 19 + Vite 7 + TailwindCSS 4
- CSS-first 设计系统 (index.css 2577行)
- Design tokens 已建立 (Phase 1-3 完成)
- 组件类库已有: `.btn`, `.btn-primary/secondary/ghost/danger`, `.input-modern`, `.card`, `.modal-overlay` 等

### 现有设计语言
- iOS 26 Liquid Glass + ChatGPT Fluid Minimalism
- Glass 效果 4 级 (glass/glass-strong/glass-crystal/glass-aurora)
- 深色模式 + OLED 纯黑变体
- 角色主题色系统 (8 角色配色)

### Settings.jsx 现状
- 381 行，已经有相当好的结构化设计
- 使用了 CSS 组件类 (control-card, setting-item, settings-group 等)
- 已有 ControlCard 和 SettingItem 子组件
- 还有少量硬编码 `style={{ color: '#FF9800' }}`

### ChatWindow.jsx 现状
- 359 行，结构清晰
- ChatHeader: 大量内联 Tailwind 样式 (187行)
- ChatComposer: 大量内联 Tailwind 样式 (421行)
- MessageTimeline: 消息渲染组件
- 已有 glass-crystal, shadow-floating 等效果

### 内联按钮样式
- ChatHeader 中 4 个动作按钮使用重复的内联样式
- ChatComposer 中多处内联 button 样式
- 其他组件中零散的按钮样式

## Phase 4 已完成项 ✅

| 功能 | 状态 |
|------|------|
| Dashboard redesign (Bento Grid + 拖拽) | ✅ Done |
| Custom accent color picker | ✅ Done |
| Keyboard shortcuts | ✅ Done |
| Onboarding tutorial | ✅ Done |
| Accessibility foundations (useFocusTrap, keyboard nav, ARIA) | ✅ Done |

## Phase 4 未完成项 ❌

| 功能 | 优先级 | 复杂度 |
|------|--------|--------|
| Chat view redesign (clean message list, minimal chrome) | P1 | High |
| Settings page redesign (grouped sections, modern toggles) | P1 | Medium |
| Migrate inline button styles to component classes | P1 | Low |
| Full accessibility audit (screen reader, comprehensive ARIA) | P2 | Medium |
