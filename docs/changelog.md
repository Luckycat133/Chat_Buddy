# Changelog

[English](#english) | [中文](#中文)

<div id="english">

## v0.1.2 (2025-08-04)

### Enhancements

- Simplified API configuration by removing provider-specific environment variables
- Unified API configuration to use custom API endpoint with OpenAI-compatible format
- Updated documentation to reflect the new API configuration approach

## v0.1.1 (2025-08-03)

### New Features

- Renamed the project to "Chat Buddy"
- Integrated Google Gemini API as a built-in AI service provider
- Improved API key security by moving hardcoded keys to environment variables
- Consolidated documentation into a single comprehensive README.md file

## v0.1.0 (2025-08-02)

### New Features

- Implemented a basic chat interface with social media style message bubbles
- Support for interacting with AI models, including OpenAI, Anthropic, and custom API providers
- Secure storage and management of API keys
- Added settings interface allowing users to configure different AI service providers
- Implemented persistent memory functionality to ensure conversation history is not cleared
- Added accurate timestamp functionality to record precise times for all conversation messages
- Implemented responsive design to adapt to various device sizes
- Added loading indicators to provide visual feedback while AI processes messages
- Implemented smooth scrolling to the latest message
- Added API documentation endpoints for developers to understand and use the API

### Technical Features

- Frontend built with React and styled-components
- Backend built with Node.js and Express
- Support for multiple AI service providers (OpenAI, Anthropic, custom)
- Implemented user-specific conversation isolation
- Uses in-memory storage (should be replaced with a database in production)
- Supports importing/exporting user data
- Implemented secure API key storage mechanism

### API Endpoints

- `POST /api/configure` - Configure user API keys
- `POST /api/chat` - Send messages to AI model
- `GET /api/conversation/:userId` - Get user conversation history
- `DELETE /api/reset/:userId` - Reset API keys and conversation history
- `PUT /api/settings/:userId` - Save user settings
- `GET /api/settings/:userId` - Get user settings
- `GET /api/export/:userId` - Export user data
- `POST /api/import/:userId` - Import user data
- `GET /api/docs` - Get API documentation

</div>

<div id="中文">

## v0.1.2 (2025-08-04)

### 功能优化

- 通过移除特定提供商的环境变量简化了API配置
- 统一API配置为使用OpenAI兼容格式的自定义API端点
- 更新文档以反映新的API配置方式

## v0.1.1 (2025-08-03)

### 新增功能

- 将项目更名为"Chat Buddy"
- 集成Google Gemini API作为内置AI服务提供商
- 通过将硬编码的密钥移至环境变量来提高API密钥安全性
- 将文档整合到一个全面的README.md文件中

## v0.1.0 (2025-08-02)

### 新增功能

- 实现了基本的聊天界面，具有社交网络风格的消息气泡设计
- 支持与AI模型进行交互，包括OpenAI、Anthropic和自定义API提供商
- 实现了API密钥的安全存储和管理
- 添加了设置界面，允许用户配置不同的AI服务提供商
- 实现了持久化内存功能，确保对话历史不会被清除
- 添加了准确的时间戳功能，记录所有对话消息的精确时间
- 实现了响应式设计，适配各种设备尺寸
- 添加了加载指示器，在AI处理消息时提供视觉反馈
- 实现了平滑滚动到最新消息的功能
- 添加了API文档端点，便于开发者了解和使用API

### 技术特性

- 前端使用React和styled-components构建
- 后端使用Node.js和Express构建
- 支持多种AI服务提供商（OpenAI、Anthropic、自定义）
- 实现了用户特定的对话隔离
- 使用内存存储（在生产环境中应替换为数据库）
- 支持导入/导出用户数据
- 实现了安全的API密钥存储机制

### API端点

- `POST /api/configure` - 配置用户API密钥
- `POST /api/chat` - 发送消息到AI模型
- `GET /api/conversation/:userId` - 获取用户对话历史
- `DELETE /api/reset/:userId` - 重置API密钥和对话历史
- `PUT /api/settings/:userId` - 保存用户设置
- `GET /api/settings/:userId` - 获取用户设置
- `GET /api/export/:userId` - 导出用户数据
- `POST /api/import/:userId` - 导入用户数据
- `GET /api/docs` - 获取API文档

</div>