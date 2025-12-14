# Changelog / 变更日志

All notable changes to Chat Buddy Remake will be documented in this file.
所有对Chat Buddy Remake的重要变更都将记录在此文件中。

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] / 未发布

---

## [0.2.2] - 2025-12-14

### Added / 新增
- WeChat-Style Features / 微信风格功能
  - Emoji picker with 8 categories and recent tracking / 8分类表情选择器，支持最近使用
  - Message context menu (copy, quote, delete) / 消息右键菜单（复制、引用、删除）
  - Message quoting/reply feature / 消息引用回复功能
  - File upload system (TXT, JSON, MD, JS, PY, etc.) / 文件上传系统
- RAG (Retrieval Augmented Generation) / RAG检索增强
  - Document indexing with TF-IDF / TF-IDF文档索引
  - Text chunking algorithm / 文本分块算法
  - Client-side similarity search / 客户端相似度搜索
  - DocumentContext for knowledge base / 知识库上下文
- AI File Generation Tools / AI文件生成工具
  - [FILE:name:content] parser / 文件生成解析器
  - Download generated files / 下载生成的文件
  - Code preview component / 代码预览组件

### Changed / 变更
- Completely rewritten ChatWindow.jsx with new features
  完全重写ChatWindow.jsx，集成所有新功能
- Added 60+ new translation keys for bilingual support
  新增60+翻译键以完善双语支持
- Updated ChatContext.jsx with deleteMessage function
  更新ChatContext.jsx，添加消息删除功能
- Added scale-in animation for popup menus
  添加弹出菜单缩放动画

### Fixed / 修复
- Language mixing issues with hardcoded strings
  修复硬编码字符串导致的语言混杂问题
- Typing indicator now uses translation keys
  输入指示器现使用翻译键

---

## [0.2.1] - 2025-12-13

### Added / 新增
- AI Tool-Based Messaging System / AI工具调用式消息系统
  - Personality-based response delays / 基于角色性格的响应延迟
  - "Message seen" delay simulation / "已读"延迟模拟
  - Typing indicators / 输入中指示器
  - AI proactive messaging / AI主动消息功能
    - AI can schedule follow-up messages using [SCHEDULE:X] tool
    - AI可以使用[SCHEDULE:X]工具安排后续消息
  - AI multi-message support / AI多条消息发送
    - AI can send multiple consecutive messages like real users
    - AI可以像真人一样连续发送多条消息
- WeChat-style Time Display / 微信风格时间显示
  - Relative time formatting (刚刚, X分钟前, etc.)
  - Time separators between message groups
  - Bilingual time formatting support
- Context Compression / 上下文压缩
  - Automatic summarization of long conversations
  - Token usage optimization
- Modern UI Enhancements / 现代UI增强
  - Unique Chat Buddy logo / 独特的Chat Buddy logo
  - Message entrance animations / 消息进入动画
  - Typing dots animation / 输入点动画
  - Glass effect utilities / 毛玻璃效果
  - Enhanced shadows and design tokens / 增强阴影和设计令牌
  - Realistic selfie-style avatars for all 13 personas / 所有13个角色的真实自拍风格头像

### Changed / 变更
- Refactored ChatContext.jsx with new AI messaging architecture
  重构ChatContext.jsx，采用新的AI消息架构
- Updated index.css with comprehensive animation system
  更新index.css，添加全面的动画系统
- Improved ChatWindow.jsx with time separators and typing indicators
  改进ChatWindow.jsx，添加时间分隔符和输入指示器
- Enhanced personas.js with responseDelay, readDelay, typingSpeed configs
  增强personas.js，添加响应延迟、阅读延迟、输入速度配置
- Updated About page with new logo and v0.2.1 changelog
  更新"关于"页面，显示新Logo和v0.2.1更新日志
- Updated README.md with new feature documentation
  更新README.md，添加新功能文档

### Fixed / 修复
- Message cleaning: AI tool markers ([MULTI:], [REACT:], [1][2], etc.) now properly stripped
  消息清理：AI工具标记现在被正确清除，不再显示在聊天中
- Case-insensitive MULTI tag parsing
  不区分大小写的MULTI标签解析

---

## [0.2.0] - 2025-12-07

### Added / 新增
- 8 new anime character AI personas (Hatsune Miku, Rem, Rin Tohsaka, Naruto, L, Zero Two, Asuna, Gojo Satoru)
  8个新的二次元角色AI（初音未来、雷姆、远坂凛、漩涡鸣人、L、零二、亚丝娜、五条悟）
- Custom generated avatars for all anime characters
  为所有二次元角色生成定制头像
- About page with version info and changelog summary
  关于页面，包含版本信息和变更日志摘要
- Help & FAQ page with frequently asked questions
  帮助与FAQ页面

### Changed / 变更
- Updated personas.js to include anime characters
  更新personas.js以包含二次元角色

---

## [0.1.1] - 2025-12-06

### Added / 新增
- Bilingual support (English/Chinese) with seamless language switching
  双语支持（中/英），无缝语言切换
- Enhanced Settings page with WeChat-style UI
  增强的设置页面，采用微信风格UI
- Search functionality in chat list
  聊天列表搜索功能
- AI Capabilities settings in group details
  群组详情中的AI能力设置

### Fixed / 修复
- Localization consistency across all UI components
  所有UI组件的本地化一致性
- Language switching for Settings, ChatList, and GroupDetails
  设置、聊天列表和群组详情的语言切换

---

## [0.1.0] - 2025-12-05

### Added / 新增
- Initial release of Chat Buddy Remake
  Chat Buddy Remake首次发布
- 5 AI personas with unique personalities (Luna, Max, Bella, Oliver, Sophie)
  5个具有独特性格的AI角色（露娜、麦克斯、贝拉、奥利弗、苏菲）
- One-on-one and group chat functionality
  一对一和群聊功能
- DeepSeek API integration for AI responses
  集成DeepSeek API进行AI回复
- Local storage for chat history and settings
  本地存储聊天记录和设置
- Macaroon Orange theme with modern UI
  马卡龙橙主题的现代UI
- React + Vite + TailwindCSS tech stack
  React + Vite + TailwindCSS技术栈

---

[Unreleased]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Luckycat133/Chat_Buddy/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Luckycat133/Chat_Buddy/releases/tag/v0.1.0
