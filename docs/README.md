# Chat Buddy - AI Chat Application

> **由 Qwen3-Coder 辅助开发**

[English](#english) | [中文](#中文)

<div id="english">

## 📁 Project Structure

```
.
├── frontend/          # React-based chat interface
├── backend/           # Node.js/Express backend with API key management
├── docs/              # Documentation and setup guides
└── README.md          # Main project documentation
```

## ⚠️ Important Notice

API keys are configured by the developer in the backend environment variables. Users cannot configure their own API keys through the application interface.

This ensures a simplified user experience and consistent API access.

## 🤖 Supported AI Providers

The application now supports multiple AI providers:
- OpenAI (default model: gpt-3.5-turbo)
- Groq API (default model: mixtral-8x7b-32768)
- Google Gemini API (default model: gemini-2.5-flash-lite)

The default provider is set to Google Gemini, but you can use any provider for which you have an API key.

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository
2. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```
3. Install backend dependencies:
   ```
   cd ../backend
   npm install
   ```

### Running the Application

1. Configure the API key in the backend:
   - Create a `.env` file in the `backend` directory
   - For custom API providers, add your API configuration:
     - `CUSTOM_API_URL` - The URL of your custom API endpoint
     - `CUSTOM_API_KEY` - The API key for your custom endpoint
     - `CUSTOM_API_MODEL` - The model name to use with your custom API (optional)
   
2. Start the backend server:
   ```
   cd backend
   npm run dev
   ```
   The server will start on `http://localhost:5001`

3. Start the frontend development server:
   ```
   cd frontend
   npm start
   ```
   The frontend will start on `http://localhost:3000`

4. Open your browser and navigate to `http://localhost:3000`

## ⚙️ API Configuration

API keys are configured by the developer in the backend environment variables. Users cannot configure their own API keys through the application interface.

To use any AI provider that supports the OpenAI API format, set these environment variables:
- `CUSTOM_API_URL` - The URL of your custom API endpoint
- `CUSTOM_API_KEY` - The API key for your custom endpoint
- `CUSTOM_API_MODEL` - The model name to use with your custom API (optional)

### Custom API Configuration

You can also configure a custom API endpoint by setting these environment variables:
- `CUSTOM_API_URL` - The URL of your custom API endpoint
- `CUSTOM_API_KEY` - The API key for your custom endpoint
- `CUSTOM_API_MODEL` - The model name to use with your custom API (optional)
- `CUSTOM_API_PROVIDER` - The provider name for your custom API (optional)

## 🌟 Features

### Chat Interface

The chat interface features a beautifully designed macaron orange theme with professional typography and smooth animations:

- **Macaron Orange Theme**: Warm and inviting color scheme using the 60-30-10 rule (60% warm background, 30% orange accents, 10% gray-blue highlights)
- **Modern Typography**: Integrated Inter font family from Google Fonts with optimized weights for different text elements
- **Enhanced Message Design**: 
  - User messages appear on the right with vibrant macaron orange background and white text
  - AI messages use clean white backgrounds with subtle borders for clear visual distinction
- **Empty State Design**: Welcoming empty state with animated robot icon and friendly greeting messages
- **Smooth Interactions**: 0.3s cubic-bezier transitions for all hover effects and button interactions
- **Enhanced Shadows**: Multi-layer box-shadow system for improved depth perception
- **Accurate timestamps**: Precise time display with optimized font weights
- **Responsive design**: Perfectly adapted for all device sizes
- **Smooth scrolling**: Automatic scrolling to the latest message

### API Key Management

- Secure storage of API keys in environment variables
- Support for multiple AI providers
- Easy configuration through `.env` file

### Persistent Memory

- All conversations are stored with accurate timestamps
- Memory is never cleared unless explicitly reset by the user
- Conversation history is maintained across sessions

### AI Personalization

- AI assistant with randomly generated name for a more personalized experience
- Engaging opening questions following a specific sequence (name → age → hobbies → job/studies) to get to know the user at the start of conversations
- Context-aware responses based on user information collected during initial interaction
- Clear context transition marker (`[CONTEXT_END]`) to indicate the end of initial information gathering
- AI-generated final greeting message after completing initial information collection
- Language adaptation to match the user's communication style for more natural conversations

## 📡 Backend API Endpoints

### Send Chat Message
- **URL**: `/api/chat`
- **Method**: `POST`
- **Body**: 
  ```json
  {
    "message": "Hello, AI!",
    "userId": "unique-user-identifier"
  }
  ```
- **Response**: 
  ```json
  {
    "message": {
      "id": 2,
      "text": "Response from AI",
      "sender": "ai",
      "timestamp": "2023-01-01T00:00:00.000Z"
    },
    "conversation": [
      // Array of all messages in the conversation
    ]
  }
  ```

### Get Conversation History
- **URL**: `/api/conversation/:userId`
- **Method**: `GET`
- **Response**: 
  ```json
  {
    "conversation": [
      // Array of all messages in the conversation
    ]
  }
  ```

### Reset API Key and Conversation
- **URL**: `/api/reset/:userId`
- **Method**: `DELETE`
- **Response**: 
  ```json
  {
    "message": "API key and conversation history reset successfully"
  }
  ```

#### Health Check
- **URL**: `/api/health`
- **Method**: `GET`
- **Response**: 
  ```json
  {
    "status": "healthy",
    "timestamp": "2023-01-01T00:00:00.000Z",
    "apiConnection": "connected",
    "uptime": 12345
  }
  ```

## 🧑‍💻 Development

### Frontend

The frontend is built with React and styled-components:

- `src/App.js` - Main application component
- `src/components/ChatWindow.js` - Chat interface component

### Backend

The backend is built with Node.js and Express:

- `server.js` - Main server file with all API endpoints
- In-memory storage for API keys and conversations (would be replaced with a database in production)

### Diagnostic Tools

The application includes built-in diagnostic tools for development and troubleshooting:

- **API Connectivity Test**: `node test-gemini-connection.js` in the backend directory
- **Health Check Endpoint**: Access `/api/health` to verify server status
- **Debug Logging**: Set `DEBUG=true` environment variable for detailed logs
- **Network Diagnostics**: Built-in tools to test network connectivity and API endpoints
- **Port Conflict Resolution**: Fixed issues with frontend development server port conflicts

### Environment Variables

Required environment variables:
- `CUSTOM_API_URL` - Your custom API endpoint URL
- `CUSTOM_API_KEY` - Your API key for the custom endpoint
- `CUSTOM_API_MODEL` - The model name to use (optional)
- `PORT` - Server port (default: 5001)
- `DEBUG` - Enable debug logging (optional)

## ☁️ Deployment

For production deployment:

1. Build the frontend:
   ```
   cd frontend
   npm run build
   ```
2. Update the backend server to serve the frontend build files
3. Deploy both the backend and frontend build files to your hosting platform

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

</div>

<div id="中文">

## 📁 项目结构

```
.
├── frontend/          # 基于React的聊天界面
├── backend/           # 基于Node.js/Express的后端，包含API密钥管理
├── docs/              # 文档和设置指南
└── README.md          # 主项目文档
```

## ⚠️ 重要通知

用户通过应用程序界面配置自己的API密钥的功能已被移除。现在API密钥由开发人员在后端环境变量中配置。

此更改是为了简化用户体验并确保一致的API访问。

## 🤖 支持的AI提供商

该应用程序现在支持所有兼容OpenAI API格式的AI提供商。

默认使用自定义API配置，您需要设置相应的环境变量。

## 🚀 开始使用

### 先决条件

- Node.js（v14或更高版本）
- npm（v6或更高版本）

### 安装

1. 克隆仓库
2. 安装前端依赖：
   ```
   cd frontend
   npm install
   ```
3. 安装后端依赖：
   ```
   cd ../backend
   npm install
   ```

### 运行应用程序

1. 在后端配置API密钥：
   - 在`backend`目录中创建一个`.env`文件
   - 对于自定义API提供商，添加您的API配置：
     - `CUSTOM_API_URL` - 您的自定义API端点URL
     - `CUSTOM_API_KEY` - 您的自定义端点API密钥
     - `CUSTOM_API_MODEL` - 要与自定义API一起使用的模型名称（可选）
   
2. 启动后端服务器：
   ```
   cd backend
   npm run dev
   ```
   服务器将在`http://localhost:5001`启动

3. 启动前端开发服务器：
   ```
   cd frontend
   npm start
   ```
   前端将在`http://localhost:3000`启动

4. 打开浏览器并导航到`http://localhost:3000`

## ⚙️ API配置

该应用程序支持通过环境变量配置API访问：

API密钥可以由开发人员在后端环境变量中配置。要使用任何支持OpenAI API格式的AI提供商，请设置以下环境变量：
- `CUSTOM_API_URL` - 您的自定义API端点URL
- `CUSTOM_API_KEY` - 您的自定义端点API密钥
- `CUSTOM_API_MODEL` - 要与自定义API一起使用的模型名称（可选）
   - 自定义API URL
   - 自定义API密钥
   - 自定义模型名称
   
   此配置在本地存储，可以随时更改。

## 🌟 功能特性

### 聊天界面

聊天界面采用精美的马卡龙橙色主题设计，具有专业排版和平滑动画：

- **马卡龙橙色主题**：使用60-30-10配色法则的温暖邀请配色方案（60%温暖背景、30%橙色点缀、10%灰蓝色高光）
- **现代排版**：集成Google Fonts的Inter字体家族，为不同文本元素优化字重
- **增强消息设计**：
  - 用户消息显示在右侧，采用充满活力的马卡龙橙色背景和白色文字
  - AI消息使用干净的白色背景和微妙边框，视觉区分清晰
- **空状态设计**：带有动画机器人图标和友好问候消息的欢迎空状态
- **平滑交互**：所有悬停效果和按钮交互的0.3秒cubic-bezier过渡
- **增强阴影**：多层box-shadow系统，提升深度感知
- **准确时间戳**：精确时间显示，优化字重
- **响应式设计**：完美适配所有设备尺寸
- **平滑滚动**：自动滚动到最新消息

### API密钥管理

- 在环境变量中安全存储API密钥
- 支持多个AI提供商
- 通过`.env`文件轻松配置

### 持久化内存

- 所有对话都存储有准确的时间戳
- 除非用户明确重置，否则内存永远不会被清除
- 对话历史在会话之间保持

### AI个性化

- 随机生成名称的AI助手，提供更个性化的体验
- 按特定顺序（姓名→年龄→爱好→工作/学习）提问，以在对话开始时了解用户
- 基于初始交互期间收集的用户信息提供上下文感知的响应
- 清晰的上下文转换标记（`[CONTEXT_END]`），指示初始信息收集的结束
- 在完成初始信息收集后由AI生成的最终问候消息
- 语言适配以匹配用户的交流风格，实现更自然的对话

### 多系统提示词支持

应用程序现在支持多种系统提示词，允许用户根据不同的场景选择不同的AI行为模式：

- **默认模式**：友好的AI助手，用中文进行自然对话
- **专业模式**：专业的AI助手，用准确、专业的语言回答问题
- **创意模式**：富有创造力的AI助手，用创新和有趣的方式交流
- **教育模式**：教育型AI助手，用教学的方式帮助用户理解问题
- **苏晓模式**：温暖、有同理心且专业的心理咨询师朋友，提供情感支持和心理学见解

用户可以通过前端界面的下拉菜单选择所需的提示词类型。

## 📡 后端API端点

### 发送聊天消息
- **URL**: `/api/chat`
- **方法**: `POST`
- **请求体**: 
  ```json
  {
    "message": "Hello, AI!",
    "userId": "unique-user-identifier"
  }
  ```
- **响应**: 
  ```json
  {
    "message": {
      "id": 2,
      "text": "Response from AI",
      "sender": "ai",
      "timestamp": "2023-01-01T00:00:00.000Z"
    },
    "conversation": [
      // 对话中所有消息的数组
    ]
  }
  ```

### 获取对话历史
- **URL**: `/api/conversation/:userId`
- **方法**: `GET`
- **响应**: 
  ```json
  {
    "conversation": [
      // 对话中所有消息的数组
    ]
  }
  ```

### 重置API密钥和对话
- **URL**: `/api/reset/:userId`
- **方法**: `DELETE`
- **响应**: 
  ```json
  {
    "message": "API密钥和对话历史重置成功"
  }
  ```

#### 健康检查
- **URL**: `/api/health`
- **方法**: `GET`
- **响应**: 
  ```json
  {
    "status": "healthy",
    "timestamp": "2023-01-01T00:00:00.000Z",
    "apiConnection": "connected",
    "uptime": 12345
  }
  ```

## 🧑‍💻 开发

### 前端

前端使用React和styled-components构建：

- `src/App.js` - 主应用程序组件
- `src/components/ChatWindow.js` - 聊天界面组件

### 后端

后端使用Node.js和Express构建：

- `server.js` - 包含所有API端点的主服务器文件
- 用于API密钥和对话的内存存储（在生产环境中应替换为数据库）

### 诊断工具

该应用程序包含内置的诊断工具，用于开发和故障排除：

- **API连接测试**：在后端目录中运行 `node test-custom-api-connection.js`
- **健康检查端点**：访问 `/api/health` 验证服务器状态
- **调试日志**：设置 `DEBUG=true` 环境变量获取详细日志
- **端口冲突解决**：解决了前端开发服务器端口冲突问题

### 环境变量

必需的环境变量：
- `CUSTOM_API_URL` - 您的自定义API端点URL
- `CUSTOM_API_KEY` - 您的自定义端点API密钥
- `CUSTOM_API_MODEL` - 要使用的模型名称（可选）
- `PORT` - 服务器端口（默认：5001）
- `DEBUG` - 启用调试日志（可选）

多系统提示词配置：
- `SYSTEM_PROMPT_DEFAULT` - 默认模式的系统提示词
- `SYSTEM_PROMPT_PROFESSIONAL` - 专业模式的系统提示词
- `SYSTEM_PROMPT_CREATIVE` - 创意模式的系统提示词
- `SYSTEM_PROMPT_EDUCATIONAL` - 教育模式的系统提示词
- `SYSTEM_PROMPT_SUXIAO` - 苏晓模式的系统提示词

用户可以通过前端界面选择提示词类型，也可以在环境变量中设置默认值。

## ☁️ 部署

生产环境部署：

1. 构建前端：
   ```
   cd frontend
   npm run build
   ```
2. 更新后端服务器以提供前端构建文件
3. 将后端和前端构建文件部署到您的托管平台

## 🤝 贡献

欢迎贡献！请随时提交Pull Request。

## 📄 许可证

该项目采用MIT许可证。

</div>