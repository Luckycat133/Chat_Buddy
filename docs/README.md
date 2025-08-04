# Chat Buddy - AI Chat Application

[English](#english) | [中文](#中文)

<div id="english">

## Project Structure

```
.
├── frontend/          # React-based chat interface
├── backend/           # Node.js/Express backend with API key management
├── docs/              # Documentation and setup guides
└── README.md          # Main project documentation
```

## Important Notice

API keys are configured by the developer in the backend environment variables. Users cannot configure their own API keys through the application interface.

This ensures a simplified user experience and consistent API access.

## Supported AI Providers

The application now supports multiple AI providers:
- OpenAI (default model: gpt-3.5-turbo)
- Groq API (default model: mixtral-8x7b-32768)
- Google Gemini API (default model: gemini-2.5-flash)

The default provider is set to Google Gemini, but you can use any provider for which you have an API key.

## Getting Started

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

## API Configuration

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

## Features

### Chat Interface

The chat interface features a clean, modern design inspired by popular social media platforms:

- Message bubbles with distinct styling for user and AI messages
- Accurate timestamps for all messages
- Smooth scrolling to the latest message
- Responsive design that works on all device sizes

### API Key Management

- Secure storage of API keys in environment variables
- Support for multiple AI providers
- Easy configuration through `.env` file

### Persistent Memory

- All conversations are stored with accurate timestamps
- Memory is never cleared unless explicitly reset by the user
- Conversation history is maintained across sessions

## Backend API Endpoints

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

## Development

### Frontend

The frontend is built with React and styled-components:

- `src/App.js` - Main application component
- `src/components/ChatWindow.js` - Chat interface component

### Backend

The backend is built with Node.js and Express:

- `server.js` - Main server file with all API endpoints
- In-memory storage for API keys and conversations (would be replaced with a database in production)

## Deployment

For production deployment:

1. Build the frontend:
   ```
   cd frontend
   npm run build
   ```
2. Update the backend server to serve the frontend build files
3. Deploy both the backend and frontend build files to your hosting platform

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

</div>

<div id="中文">

## 项目结构

```
.
├── frontend/          # 基于React的聊天界面
├── backend/           # 基于Node.js/Express的后端，包含API密钥管理
├── docs/              # 文档和设置指南
└── README.md          # 主项目文档
```

## 重要通知

用户通过应用程序界面配置自己的API密钥的功能已被移除。现在API密钥由开发人员在后端环境变量中配置。

此更改是为了简化用户体验并确保一致的API访问。

## 支持的AI提供商

该应用程序现在支持所有兼容OpenAI API格式的AI提供商。

默认使用自定义API配置，您需要设置相应的环境变量。

## 开始使用

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

## API配置

该应用程序支持通过环境变量配置API访问：

API密钥可以由开发人员在后端环境变量中配置。要使用任何支持OpenAI API格式的AI提供商，请设置以下环境变量：
- `CUSTOM_API_URL` - 您的自定义API端点URL
- `CUSTOM_API_KEY` - 您的自定义端点API密钥
- `CUSTOM_API_MODEL` - 要与自定义API一起使用的模型名称（可选）
   - 自定义API URL
   - 自定义API密钥
   - 自定义模型名称
   
   此配置在本地存储，可以随时更改。

## 功能特性

### 聊天界面

聊天界面具有受流行社交媒体平台启发的简洁现代设计：

- 具有独特样式的用户和AI消息气泡
- 所有消息的准确时间戳
- 平滑滚动到最新消息
- 适用于所有设备尺寸的响应式设计

### API密钥管理

- 在环境变量中安全存储API密钥
- 支持多个AI提供商
- 通过`.env`文件轻松配置

### 持久化内存

- 所有对话都存储有准确的时间戳
- 除非用户明确重置，否则内存永远不会被清除
- 对话历史在会话之间保持

## 后端API端点

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

## 开发

### 前端

前端使用React和styled-components构建：

- `src/App.js` - 主应用程序组件
- `src/components/ChatWindow.js` - 聊天界面组件

### 后端

后端使用Node.js和Express构建：

- `server.js` - 包含所有API端点的主服务器文件
- 用于API密钥和对话的内存存储（在生产环境中应替换为数据库）

## 部署

生产环境部署：

1. 构建前端：
   ```
   cd frontend
   npm run build
   ```
2. 更新后端服务器以提供前端构建文件
3. 将后端和前端构建文件部署到您的托管平台

## 贡献

欢迎贡献！请随时提交Pull Request。

## 许可证

该项目采用MIT许可证。

</div>