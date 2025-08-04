# Changelog

[English](#english) | [中文](#中文)

<div id="english">

## v0.2.1 (2025-08-04)

### Bug Fixes

- **Fixed Empty Response Display**: Resolved critical issue where AI responses appeared empty in the chat interface due to incorrect field mapping in frontend API response parsing
- **API Response Compatibility**: Fixed frontend parsing to correctly handle the API response structure (`message.content` instead of `message.text`)

### Technical Details

- **Frontend Fix**: Updated `/frontend/src/components/ChatWindow.js` line 327 to use correct response field name
- **Impact**: All AI responses now display correctly in the chat interface
- **Root Cause**: Frontend was expecting `data.message.text` but backend returns `data.message.content`

## v0.2.0 (2025-08-04)

### New Features

- **AI Personalization**: Added AI assistant with randomly generated name that engages users with personalized questions at the start of conversations
- **Enhanced API Error Handling**: Implemented comprehensive error handling for network connectivity issues, API rate limits, and invalid responses
- **Server Health Monitoring**: Added automatic server health checks and status reporting
- **Connection Diagnostics**: Built-in diagnostics tools to troubleshoot API connectivity issues
- **Improved Logging System**: Enhanced logging with detailed error messages and debugging information
- **Network Configuration Validation**: Added validation for custom API endpoints and network configurations

### Technical Improvements

- **Robust Error Recovery**: Implemented retry mechanisms for failed API calls with exponential backoff
- **Timeout Management**: Added configurable timeouts for API requests to prevent hanging connections
- **Connection Pooling**: Optimized HTTP connection handling for better performance
- **Environment Validation**: Added startup validation for required environment variables and configurations
- **Security Enhancements**: Improved API key handling and secure storage mechanisms

### Bug Fixes

- Fixed network connectivity issues that prevented server startup
- Resolved API endpoint connection failures
- Fixed environment variable validation issues
- Corrected error handling for malformed API responses
- Fixed server port binding conflicts

### Development Tools

- **Diagnostic Scripts**: Added command-line tools for testing API connectivity
- **Health Check Endpoint**: New `/api/health` endpoint for monitoring server status
- **Debug Mode**: Added detailed debug logging for development environments
- **Configuration Testing**: Built-in configuration validation tools

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

## v0.2.1 (2025-08-04)

### 错误修复

- **修复空回复显示问题**：解决了由于前端API响应解析错误导致的AI回复在聊天界面中显示为空的严重问题
- **API响应兼容性**：修复了前端解析以正确处理API响应结构（使用`message.content`而非`message.text`）

### 技术细节

- **前端修复**：更新 `/frontend/src/components/ChatWindow.js` 第327行，使用正确的响应字段名
- **影响**：所有AI回复现在都能在聊天界面中正确显示
- **根本原因**：前端期望 `data.message.text` 但后端返回 `data.message.content`

## v0.2.0 (2025-08-04)

### 新增功能

- **AI个性化**：添加了具有随机生成名称的AI助手，在对话开始时通过个性化问题与用户互动
- **增强的API错误处理**：实现了针对网络连接问题、API速率限制和无效响应的全面错误处理
- **服务器健康监控**：添加了自动服务器健康检查和状态报告功能
- **连接诊断**：内置诊断工具，用于排查API连接问题
- **改进的日志系统**：增强的日志记录，包含详细的错误消息和调试信息
- **网络配置验证**：添加了自定义API端点和网络配置的验证功能

### 技术改进

- **健壮的错误恢复**：实现了失败API调用的重试机制，支持指数退避
- **超时管理**：为API请求添加了可配置的超时设置，防止连接挂起
- **连接池优化**：优化了HTTP连接处理，提升性能
- **环境验证**：添加了启动时对必需环境变量和配置的验证
- **安全增强**：改进了API密钥处理和安全存储机制

### 错误修复

- 修复了阻止服务器启动的网络连接问题
- 解决了API端点连接失败的问题
- 修复了环境变量验证问题
- 修正了畸形API响应的错误处理
- 修复了服务器端口绑定冲突

### 开发工具

- **诊断脚本**：添加了用于测试API连接的命令行工具
- **健康检查端点**：新增 `/api/health` 端点用于监控服务器状态
- **调试模式**：为开发环境添加了详细的调试日志
- **配置测试**：内置配置验证工具

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