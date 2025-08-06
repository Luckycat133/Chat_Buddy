# Changelog

[English](#english) | [中文](#中文)

<div id="english">

## v0.2.2 (2025-08-05)

### New Features

- **Top Typing Indicator**: Changed loading animation to top "typing" indicator with pulsing animation effect
- **Realistic Delay Simulation**: Added 1-3 second random delay to simulate human typing rhythm
- **Intelligent API Retry System**: Implemented 3 retry attempts with exponential backoff strategy for API failures
- **Prompt Type Selection**: Added support for selecting different prompt types including "苏晓" mode, allowing users to customize AI personality and conversation style

### Technical Improvements

- **Backend Prompt Engineering**: Enhanced backend prompt templates with language-adaptive instructions
- **Frontend Logic Updates**: Modified frontend to request AI-generated personalized greetings and handle identity inquiries
- **Context Management**: Improved context management for AI interactions, optimizing information flow between frontend and backend
- **API Error Handling**: Fixed variable scope issues in retry mechanism for backend API calls
- **Prompt Optimization**: Streamlined prompt templates to eliminate descriptive action text and bracket expressions
- **Top Bar UI Optimization**: Redesigned top bar layout with unified left alignment for AI name and "对方正在输入中" indicator, implementing smooth slide-in animation effects
- **Smart Retry Logic**: Implemented intelligent retry logic for rate limits and server errors
- **Variable Scope Fixes**: Resolved ReferenceError issues in retry mechanisms

### Bug Fixes

- **Message Rendering**: Fixed issues with message rendering to properly support rich text formatting
- **Conversation Flow**: Improved conversation flow handling for special user queries during initial information gathering
- **API Call Errors**: Fixed "ReferenceError: messages is not defined" in retry mechanism
- **Provider Variable Scope**: Resolved variable scope issues in API retry logic
- **AI Response Naturalness**: Eliminated unnatural descriptive language and action descriptions in AI responses
- **Variable Scope Issues**: Fixed ReferenceError for messages and provider variables in error handling
- **Header Overlap Issue**: Fixed overlapping issue between AI name and "typing indicator" in header, now they smoothly transition between each other
- **UI Icon Optimization**: Removed triangle icon from top bar "typing indicator" for a cleaner, more elegant interface

## v0.2.1 (2025-08-04)

### Security Fixes

- **XSS Vulnerability Fix**: Fixed XSS vulnerability in message rendering by sanitizing Markdown output with DOMPurify before rendering
- **Input Sanitization**: Added DOMPurify sanitization for all AI-generated content to prevent malicious code execution
- **Server-side Request Forgery**: Fixed critical SSRF vulnerabilities in backend/server.js at lines 242 and 282
- **Missing Rate Limiting**: Added rate limiting protection to prevent abuse in backend/server.js at line 369
- **Externally-controlled Format String**: Fixed use of externally-controlled format string vulnerability in backend/server.js at line 294
- **DOM Text Reinterpreted as HTML**: Fixed medium severity DOM text reinterpreted as HTML vulnerability in frontend/components/ChatWindow.js at line 594
- **Prototype Pollution**: Fixed multiple prototype-polluting assignment vulnerabilities in backend/server.js at lines 50, 52, and 54
- **Port Conflict Resolution**: Resolved the issue where the backend server failed to start due to port being occupied.
- **API Model Name Correction**: Corrected the Gemini API model name to ensure API requests function correctly.
- **CORS Configuration Fix**: Fixed the CORS configuration to allow the frontend to access the backend API properly.

## v0.2.0 (2025-08-04)

### New Features

- **Macaron Orange Theme**: Complete UI redesign with warm macaron orange color scheme using 60-30-10 rule
- **Google Fonts Integration**: Added Inter font family for modern, clean typography with optimized weights (300/400/600/700)
- **Empty State Design**: Added welcoming empty state with animated robot icon and friendly greeting messages
- **Enhanced Hover Effects**: Smooth transition animations for all interactive elements including message bubbles and buttons
- **Improved Visual Hierarchy**: Enhanced shadows, spacing, and color contrast for better readability
- **User Message Styling**: User messages now appear on the right with vibrant macaron orange background
- **Bot Message Styling**: AI messages use clean white background with subtle borders for clear distinction

### Technical Improvements

- **Font Optimization**: Integrated @fontsource/inter package and Google Fonts CDN for consistent typography
- **Shadow System**: Implemented multi-layer box-shadow system with enhanced depth perception
- **Transition Animations**: Added 0.3s cubic-bezier transitions for smooth hover and click feedback
- **Color Palette**: Applied professional color scheme with 60% warm background, 30% orange accents, 10% gray-blue highlights
- **Responsive Typography**: Optimized font weights for different text elements (titles 700, content 400, timestamps 300)

### Bug Fixes

- **Font Loading**: Fixed font loading issues by properly importing Google Fonts CDN
- **Color Contrast**: Improved text readability with better color contrast ratios
- **Button States**: Enhanced button hover/active states for better user feedback

## v0.1.4 (2025-08-03)

### New Features

- **Structured Initial Questions**: AI now follows a specific sequence of questions (name → age → hobbies → job/studies) during initial conversation
- **Context Marking**: Added special `[CONTEXT_END]` marker to clearly indicate the end of initial information gathering
- **Enhanced Prompt Template**: Backend now provides a clear prompt template for AI to generate initial questions
- **Basic Language Recognition**: Initial implementation of AI's ability to detect and adapt to user's language preference

### Technical Improvements

- **Frontend Logic Update**: Modified `/frontend/src/components/ChatWindow.js` to request next question based on conversation stage
- **Backend Prompt Engineering**: Enhanced `/backend/server.js` to provide structured prompt templates for initial conversation
- **Process Automation**: Streamlined the initial conversation flow to automatically transition to open chat after context collection
- **Final Greeting Generation**: Updated `/frontend/src/components/ChatWindow.js` to request AI-generated personalized greeting after context collection
- **Language Detection**: Added basic language detection capabilities to the prompt template in `/backend/server.js`

### Bug Fixes

- **Port Conflict Resolution**: Fixed issue where the frontend development server failed to start due to port 3000 being occupied by a previous process
- **Process Management**: Improved server restart procedures to ensure clean shutdown of existing processes before starting new instances

## v0.1.3 (2025-08-03)

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

## v0.1.2 (2025-08-02)

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

## v0.2.2 (2025-08-05)

### 新增功能

- **顶部打字指示器**：将加载动画改为顶部"对方正在输入中"提示，包含脉冲动画效果
- **真实延迟模拟**：添加1-3秒随机延迟，模拟真人输入节奏
- **智能API重试系统**：实现3次重试机制，包含指数退避策略
- **提示词类型选择**：新增支持选择不同的提示词类型，包括"苏晓"模式，允许用户自定义AI个性和对话风格

### 技术改进

- **后端提示工程**：增强后端提示模板，包含语言自适应指令
- **前端逻辑更新**：修改前端以请求AI生成个性化问候并处理身份询问
- **上下文管理**：改进AI交互的上下文管理，优化前后端间的信息流
- **API错误处理**：修复后端API调用中重试机制的变量作用域问题
- **提示词优化**：精简提示模板，消除描述性动作文本和括号表达式
- **顶部栏UI优化**：重新设计顶部栏布局，将AI名字和"对方正在输入中"提示统一左对齐，实现平滑的滑入动画效果

### Bug Fixes

- **消息渲染**：修复消息渲染问题，正确支持富文本格式
- **对话流程**：改进初始信息收集期间特殊用户查询的对话流程处理
- **API调用错误**：修复重试机制中的"ReferenceError: messages未定义"错误
- **提供程序变量作用域**：解决API重试逻辑中的变量作用域问题
- **AI回复自然度**：消除AI回复中的不自然描述语言和动作描述
- **顶部栏重叠问题**：修复AI名字与"对方正在输入中"提示重叠的问题，现在两者会平滑切换显示
- **UI图标优化**：移除顶部栏"对方正在输入中"提示中的三角形图标，使界面更加简洁优雅

## v0.2.1 (2025-08-04)

### 安全修复

- **XSS漏洞修复**：通过在渲染前使用DOMPurify净化Markdown输出，修复了消息渲染中的XSS漏洞
- **输入净化**：为所有AI生成的内容添加DOMPurify净化，防止恶意代码执行
- **服务器端请求伪造**：修复了backend/server.js第242和282行的严重SSRF漏洞
- **缺少速率限制**：在backend/server.js第369行添加了速率限制保护以防止滥用
- **外部控制的格式字符串**：修复了backend/server.js第294行的外部控制格式字符串漏洞
- **DOM文本重新解释为HTML**：修复了frontend/components/ChatWindow.js第594行的中等严重性DOM文本重新解释为HTML漏洞
- **原型污染**：修复了backend/server.js第50、52和54行的多个原型污染分配漏洞
- **端口冲突解决**：解决了后端服务器启动时端口被占用的问题。
- **API模型名称修正**：修正了Gemini API模型名称，确保API请求正常工作。
- **CORS配置修复**：修复了CORS配置，允许前端正常访问后端API。


## v0.2.0 (2025-08-04)

### 新增功能

- **马卡龙橙色主题**：使用60-30-10配色法则的完整UI重新设计，采用温暖的马卡龙橙色配色方案
- **Google字体集成**：添加Inter字体家族，实现现代简洁的排版，优化字重(300/400/600/700)
- **空状态设计**：添加欢迎空状态，包含动画机器人图标和友好的问候消息
- **增强悬停效果**：为所有交互元素（包括消息气泡和按钮）添加平滑过渡动画
- **改进视觉层次**：增强阴影、间距和颜色对比度，提升可读性
- **用户消息样式**：用户消息现在显示在右侧，采用鲜明的马卡龙橙色背景
- **机器人消息样式**：AI消息使用干净的白色背景和微妙边框，清晰区分

### 技术改进

- **字体优化**：集成@fontsource/inter包和Google Fonts CDN，确保一致的排版
- **阴影系统**：实现多层box-shadow系统，增强深度感知
- **过渡动画**：添加0.3秒cubic-bezier过渡，实现平滑悬停和点击反馈
- **配色方案**：应用专业配色方案，60%温暖背景、30%橙色点缀、10%灰蓝色高光
- **响应式排版**：针对不同文本元素优化字重（标题700、正文400、时间戳300）

### 错误修复

- **字体加载**：通过正确导入Google Fonts CDN修复字体加载问题
- **颜色对比**：通过更好的颜色对比度比例提升文本可读性
- **按钮状态**：增强按钮悬停/激活状态，提供更好的用户反馈

## v0.1.4 (2025-08-03)

### 新增功能

- **结构化初始问题**：AI现在在初始对话中遵循特定的问题顺序（姓名→年龄→爱好→工作/学习）
- **上下文标记**：添加了特殊的`[CONTEXT_END]`标记，以明确指示初始信息收集的结束
- **增强的提示模板**：后端现在为AI生成初始问题提供清晰的提示模板
- **基础语言识别**：AI对用户语言偏好进行初步检测和适配的基础实现

### 技术改进

- **前端逻辑更新**：修改了`/frontend/src/components/ChatWindow.js`，根据对话阶段请求下一个问题
- **后端提示工程**：增强了`/backend/server.js`，为初始对话提供结构化提示模板
- **流程自动化**：简化了初始对话流程，在收集上下文后自动过渡到开放聊天
- **最终问候生成**：更新了`/frontend/src/components/ChatWindow.js`，在收集上下文后请求AI生成个性化问候
- **语言检测**：在`/backend/server.js`的提示模板中添加了基础语言检测功能

### 错误修复

- **端口冲突解决**：修复了前端开发服务器因3000端口被先前进程占用而无法启动的问题
- **进程管理**：改进了服务器重启程序，确保在启动新实例之前干净地关闭现有进程

## v0.1.3 (2025-08-03)

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

## v0.1.2 (2025-08-02)

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