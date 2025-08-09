# Changelog

[English](#english) | [中文](#中文)

<div id="english">

## [v0.2.4](#v024) (2025-08-06)

### New Features

- **Message Deletion**: Added ability to delete individual messages from conversation history with visual confirmation and smooth animations
- **Message Editing**: Users can revise previously sent messages, automatically prompting a fresh AI response
- **Enhanced Error Handling**: Improved frontend error handling for network connectivity issues with user-friendly error messages
- **Server Health Monitoring**: Added automatic server restart capabilities and connection status monitoring
- **Message Bubble Styling**: Implemented enhanced message bubble design with distinct styling for user (orange) and AI (light gray) messages, including proper padding, rounded corners, and directional tails
- **Enhanced Timestamp Display**: Improved timestamp display logic to show more contextual time information (Just now, X min ago, day of week for recent messages, and date for older messages)

### Bug Fixes

- **Variable Reference Fix**: Resolved undefined variable reference errors in ChatWindow.js affecting message sending functionality
- **Connection Stability**: Fixed intermittent connection failures between frontend and backend servers
- **Process Management**: Improved server restart procedures to prevent port conflicts and ensure clean process termination
- **Message Container Structure**: Fixed message container structure by replacing StyledMessageContentWrapperWithProps with MessageContent component for proper styling application

### Technical Improvements

- **Code Quality**: Enhanced variable scope management and error handling in frontend components
- **Development Experience**: Streamlined development server startup process with better error reporting
- **System Reliability**: Implemented robust connection retry mechanisms for improved stability
- **UI Architecture**: Refactored message rendering structure to use "bento box" and "sandwich" design pattern with proper component isolation and styling

## [v0.2.3](#v023) (2025-08-06)

### Bug Fixes

- **CORS Configuration**: Extended CORS origin configuration to support both localhost:3001 and 192.168.0.98:3001 for flexible access

### Security Enhancements

- **API Key Management**: Implemented robust API key caching mechanism with automatic fallback to environment variables, ensuring secure and efficient key handling
- **Security Middleware Integration**: Enhanced backend security with improved middleware implementation, preventing unauthorized access to API endpoints
- **Input Sanitization**: Strengthened input validation and sanitization processes to prevent injection attacks and ensure data integrity
- **Error Handling**: Improved error responses to avoid exposing sensitive system information to clients

### Technical Improvements

- **Connection Reliability**: Enhanced error handling and retry mechanisms for network requests
- **Development Experience**: Improved server restart procedures with clean process management
- **Cross-Origin Support**: Added comprehensive CORS configuration for local development and testing
- **Code Structure**: Refactored backend routing system for modular management, improving code maintainability
- **Error Handling**: Enhanced error logging in backend routes with detailed error information and request context
- **UI/UX**: Improved error display in the frontend with visual indicators and clearer error messages
- **API Documentation**: Added health check endpoint (/api/health) and API documentation endpoint (/api/docs) for easier development and debugging
- **API Provider Selection**: Implemented intelligent API provider selection with environment variable fallback mechanism, ensuring seamless integration when user settings are not provided
- **Configuration Management**: Enhanced default configuration handling for API providers, improving system robustness and user experience
- **Authentication Flow**: Optimized API authentication flow with proper error handling and fallback strategies

## [v0.2.2](#v022) (2025-08-05)

### New Features

- **Top Typing Indicator**: Changed loading animation to top "typing" indicator with pulsing animation effect
- **Realistic Delay Simulation**: Added 1-3 second random delay to simulate human typing rhythm
- **Dr. Evelyn Lin**: Introduced dual-personality AI character (professional psychiatrist & personal friend modes) with dynamic conversation styles

### Technical Improvements

- **Enhanced AI System**: Improved backend prompt templates with language-adaptive instructions and streamlined responses
- **UI/UX Refinements**: Redesigned top bar layout with unified left alignment and smooth slide-in animations
- **System Reliability**: Implemented intelligent retry logic with exponential backoff for API failures and rate limits
- **Character Simplification**: Removed character selection interface, focusing on single optimized experience with Dr. Evelyn Lin

### Bug Fixes

- **Message Rendering**: Fixed rich text formatting support and improved conversation flow handling
- **UI Polish**: Resolved header overlap issues and removed redundant icons for cleaner interface
- **System Stability**: Fixed variable scope issues in retry mechanisms and API error handling

## [v0.2.1](#v021) (2025-08-04)

### Security Fixes

- **XSS Protection**: Fixed XSS vulnerability by sanitizing all AI-generated content with DOMPurify
- **SSRF Prevention**: Resolved server-side request forgery vulnerabilities in backend API
- **Rate Limiting**: Added comprehensive rate limiting protection against abuse
- **Input Validation**: Fixed format string and prototype pollution vulnerabilities
- **CORS & Port Configuration**: Enhanced CORS configuration and resolved port binding conflicts

## [v0.2.0](#v020) (2025-08-04)

### New Features

- **Macaron Orange Theme**: Complete UI redesign with warm macaron orange color scheme (60-30-10 rule)
- **Modern Typography**: Integrated Inter font family with optimized weights for clean, professional appearance
- **Enhanced User Experience**: Added welcoming empty state, smooth animations, and improved visual hierarchy
- **Message Design**: Redesigned message bubbles with distinct styling for users (orange) and AI (clean white)

### Technical Improvements

- **Design System**: Implemented comprehensive design system with multi-layer shadows, transitions, and color palette
- **Font Optimization**: Integrated Google Fonts CDN with @fontsource/inter for consistent typography across platforms
- **Responsive Design**: Enhanced responsive typography and improved color contrast for accessibility

### Bug Fixes

- **Performance**: Resolved font loading issues and enhanced button interaction states

## [v0.1.4](#v014) (2025-08-03)

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

## [v0.1.3](#v013) (2025-08-03)

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

## [v0.1.2](#v012) (2025-08-02)

### Enhancements

- Simplified API configuration by removing provider-specific environment variables
- Unified API configuration to use custom API endpoint with OpenAI-compatible format
- Updated documentation to reflect the new API configuration approach

## [v0.1.1](#v011) (2025-08-03)

### New Features

- Renamed the project to "Chat Buddy"
- Integrated Google Gemini API as a built-in AI service provider
- Improved API key security by moving hardcoded keys to environment variables
- Consolidated documentation into a single comprehensive README.md file

## [v0.1.0](#v010) (2025-08-02)

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

## [v0.2.4](#v024) (2025-08-06)

### 新增功能

- **消息删除**：新增从对话历史中删除单个消息的功能，包含视觉确认和平滑动画效果
- **消息编辑**：允许用户修改已发送的消息，并自动重新请求AI响应
- **增强错误处理**：改进前端的网络连接错误处理，提供用户友好的错误消息
- **服务器健康监控**：添加自动服务器重启功能和连接状态监控
- **消息气泡样式**：实现增强的消息气泡设计，用户消息（橙色）和AI消息（浅灰色）具有不同的样式，包括适当的内边距、圆角和方向性尾巴
- **增强时间戳显示**：改进时间戳显示逻辑，显示更具上下文的时间信息（刚刚、X分钟前、最近消息显示星期几，较早消息显示日期）

### 错误修复

- **变量引用修复**：修复ChatWindow.js中影响消息发送功能的未定义变量引用错误
- **连接稳定性**：修复前端和后端服务器之间的间歇性连接失败问题
- **进程管理**：改进服务器重启流程，防止端口冲突并确保干净进程终止
- **消息容器结构**：通过将StyledMessageContentWrapperWithProps替换为MessageContent组件来修复消息容器结构，以正确应用样式

### 技术改进

- **代码质量**：增强前端组件中的变量作用域管理和错误处理
- **开发体验**：简化开发服务器启动流程，提供更好的错误报告
- **系统可靠性**：实现强大的连接重试机制以提高稳定性
- **界面架构**：重构消息渲染结构，使用"饭盒"和"三明治"设计模式，实现适当的组件隔离和样式

## [v0.2.3](#v023) (2025-08-06)

### 错误修复

- **跨域配置**：扩展CORS源配置，支持localhost:3001和192.168.0.98:3001的灵活访问

### 安全性增强

- **API密钥管理**：实现强大的API密钥缓存机制，并自动回退到环境变量，确保安全高效的密钥处理
- **安全中间件集成**：通过改进中间件实现，增强后端安全性，防止对API端点的未授权访问
- **输入净化**：加强输入验证和净化过程，防止注入攻击并确保数据完整性
- **错误处理**：改进错误响应，避免向客户端暴露敏感的系统信息

### 技术改进

- **连接可靠性**：增强网络请求的错误处理和重试机制
- **开发体验**：改进服务器重启流程，实现干净进程管理
- **跨域支持**：为本地开发和测试添加全面的CORS配置
- **代码结构**：重构后端路由系统，实现模块化管理，提升代码可维护性
- **错误处理**：增强后端路由中的错误日志记录，包含详细的错误信息和请求上下文
- **界面优化**：改进前端错误显示，添加视觉指示器和更清晰的错误消息
- **API文档**：新增健康检查端点(/api/health)和API文档端点(/api/docs)，便于开发调试
- **API提供商选择**：实现智能API提供商选择，包含环境变量回退机制，确保用户未提供设置时的无缝集成
- **配置管理**：增强API提供商的默认配置处理，提高系统健壮性和用户体验
- **认证流程**：优化API认证流程，添加适当的错误处理和回退策略

## [v0.2.2](#v022) (2025-08-05)

### 新增功能

- **顶部打字指示器**：将加载动画改为顶部"对方正在输入中"提示，包含脉冲动画效果
- **真实延迟模拟**：添加1-3秒随机延迟，模拟真人输入节奏
- **Dr. Evelyn Lin**：引入双重人格AI角色（专业心理咨询师&私人好友模式），支持动态对话风格

### 技术改进

- **增强AI系统**：优化后端提示模板，支持语言自适应和回复精简
- **界面优化**：重新设计顶部栏布局，统一左对齐并添加平滑动画效果
- **系统可靠性**：实现智能重试逻辑，支持指数退避处理API故障和速率限制
- **角色简化**：移除角色选择界面，专注单一优化体验，默认使用Dr. Evelyn Lin

### 错误修复

- **消息渲染**：修复富文本格式支持并改善对话流程处理
- **界面优化**：解决顶部栏重叠问题，移除冗余图标使界面更简洁
- **系统稳定性**：修复重试机制和API错误处理中的变量作用域问题

## [v0.2.1](#v021) (2025-08-04)

### 安全修复

- **XSS防护**：使用DOMPurify净化所有AI生成内容，修复XSS漏洞
- **SSRF防护**：修复后端API的服务器端请求伪造漏洞
- **速率限制**：添加全面的速率限制保护，防止系统滥用
- **输入验证**：修复格式字符串和原型污染漏洞
- **CORS与端口配置**：增强CORS配置并解决端口绑定冲突

## [v0.2.0](#v020) (2025-08-04)

### 新增功能

- **马卡龙橙色主题**：使用60-30-10配色法则的完整UI重新设计
- **现代字体**：集成Inter字体家族，实现简洁专业的视觉风格
- **用户体验升级**：添加欢迎空状态、平滑动画和改进的视觉层次
- **消息设计**：重新设计消息气泡，用户橙色突出，AI简洁白底

### 技术改进

- **设计系统**：实现包含多层阴影、过渡动画和配色方案的完整设计体系
- **字体优化**：集成Google Fonts CDN和@fontsource/inter确保跨平台一致性
- **响应式设计**：增强响应式排版并提升颜色对比度以优化无障碍访问

### 错误修复

- **性能优化**：解决字体加载问题并增强按钮交互状态

## [v0.1.4](#v014) (2025-08-03)

### 新增功能

- **智能对话初始化**：AI通过结构化问题收集用户信息（姓名、年龄、爱好、职业），自动标记上下文收集完成
- **多语言支持**：基础语言检测适配用户偏好

### 技术改进

- **流程优化**：前后端协同实现自动化对话引导，收集完成后无缝切换开放聊天
- **系统稳定性**：改进进程管理和端口冲突处理

### 错误修复

- **开发体验**：解决端口占用问题，优化服务器重启流程

## [v0.1.3](#v013) (2025-08-03)

### 新增功能

- **AI个性化**：智能AI助手通过个性化问题主动了解用户
- **系统监控**：集成健康检查、诊断工具和增强日志系统
- **连接管理**：自动网络诊断和配置验证

### 技术改进

- **可靠性增强**：实现指数退避重试、超时管理和连接池优化
- **安全防护**：改进API密钥管理和环境验证机制

### 错误修复

- **系统稳定性**：修复网络连接、端口绑定和API响应处理问题

### 开发工具

- **调试支持**：新增健康检查端点、诊断脚本和配置验证工具

## [v0.1.2](#v012) (2025-08-02)

### 功能优化

- **配置简化**：统一为OpenAI兼容格式，移除特定提供商依赖
- **文档更新**：同步更新配置说明文档

## [v0.1.1](#v011) (2025-08-03)

### 新增功能

- **品牌升级**：项目更名为"Chat Buddy"
- **服务扩展**：集成Google Gemini API作为内置提供商
- **安全增强**：迁移至环境变量存储，提升API密钥安全性
- **文档整合**：统一README文档，提升用户体验

## [v0.1.0](#v010) (2025-08-02)

### 新增功能

- **核心聊天**：社交网络风格界面，支持OpenAI、Anthropic及自定义API
- **用户管理**：安全API密钥存储、个性化设置、数据导入导出
- **智能体验**：持久化对话、实时时间戳、响应式设计、平滑滚动
- **开发者支持**：完整API文档和端点体系

### 技术架构

- **前后端分离**：React + styled-components前端，Node.js + Express后端
- **多提供商支持**：统一接口兼容OpenAI、Anthropic及自定义服务
- **数据安全**：用户隔离、内存存储（可扩展至数据库）、安全密钥管理

</div>