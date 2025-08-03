# Vibe Coding - AI Chat Application Documentation

## Overview
## 概述

Vibe Coding is a sleek and modern chat interface for interacting with AI models. The application features:
Vibe Coding 是一个简洁现代的聊天界面，用于与 AI 模型交互。应用程序的特点：

- Clean, social-media style chat interface
- 简洁、类似社交媒体风格的聊天界面
- Secure API key configuration
- 安全的 API 密钥配置
- Persistent memory that never clears
- 永不丢失的持久化内存
- Accurate conversation timestamping
- 精确的对话时间戳

## Project Structure
## 项目结构

```
.
├── frontend/          # React-based chat interface
├── frontend/          # 基于 React 的聊天界面
├── backend/           # Node.js/Express backend with API key management
├── backend/           # 带有 API 密钥管理的 Node.js/Express 后端
├── docs/              # Documentation and setup guides
├── docs/              # 文档和设置指南
└── README.md          # Main project documentation
└── README.md          # 主项目文档
```

## Getting Started
## 开始使用

### Prerequisites
### 先决条件

- Node.js (v14 or higher)
- Node.js (v14 或更高版本)
- npm (v6 or higher)
- npm (v6 或更高版本)

### Installation
### 安装

1. Clone the repository
1. 克隆仓库
2. Install frontend dependencies:
2. 安装前端依赖：
   ```
   cd frontend
   npm install
   ```
3. Install backend dependencies:
3. 安装后端依赖：
   ```
   cd ../backend
   npm install
   ```

### Running the Application
### 运行应用程序

1. Start the backend server:
1. 启动后端服务器：
   ```
   cd backend
   npm run dev
   ```
   The server will start on `http://localhost:5000`
   服务器将在 `http://localhost:5000` 上启动

2. Start the frontend development server:
2. 启动前端开发服务器：
   ```
   cd frontend
   npm start
   ```
   The frontend will start on `http://localhost:3000`
   前端将在 `http://localhost:3000` 上启动

3. Open your browser and navigate to `http://localhost:3000`
3. 打开浏览器并导航到 `http://localhost:3000`

### API Key Configuration
### API 密钥配置

1. When you first open the application, you'll be prompted to enter your API key
1. 首次打开应用程序时，系统会提示您输入 API 密钥
2. The API key is securely stored in your browser's local storage
2. API 密钥安全地存储在浏览器的本地存储中
3. You can reset your API key at any time using the "Reset API Key" button
3. 您可以随时使用"重置 API 密钥"按钮重置 API 密钥

### Backend API Endpoints
### 后端 API 端点

For detailed information about the backend API endpoints, please refer to the [Backend README](../backend/README.md).
有关后端 API 端点的详细信息，请参阅 [后端 README](../backend/README.md)。

## Features
## 功能

### Chat Interface
### 聊天界面

The chat interface features a clean, modern design inspired by popular social media platforms:
聊天界面具有受流行社交媒体平台启发的简洁现代设计：

- Message bubbles with distinct styling for user and AI messages
- 用户和 AI 消息具有不同样式的气泡
- Accurate timestamps for all messages
- 所有消息的精确时间戳
- Smooth scrolling to the latest message
- 平滑滚动到最新消息
- Responsive design that works on all device sizes
- 适用于所有设备尺寸的响应式设计

### API Key Management
### API 密钥管理

- Secure storage of API keys in browser local storage
- 在浏览器本地存储中安全存储 API 密钥
- Easy reset functionality
- 简单的重置功能
- Automatic configuration when the application starts
- 应用程序启动时自动配置

### Persistent Memory
### 持久化内存

- All conversations are stored with accurate timestamps
- 所有对话都以精确的时间戳存储
- Memory is never cleared unless explicitly reset by the user
- 除非用户明确重置，否则内存永远不会被清除
- Conversation history is maintained across sessions
- 跨会话维护对话历史记录

## Development
## 开发

### Frontend
### 前端

The frontend is built with React and styled-components:
前端使用 React 和 styled-components 构建：

- `src/App.js` - Main application component
- `src/App.js` - 主应用程序组件
- `src/components/ChatWindow.js` - Chat interface component
- `src/components/ChatWindow.js` - 聊天界面组件
- `src/components/ApiKeySetup.js` - API key configuration component
- `src/components/ApiKeySetup.js` - API 密钥配置组件

### Backend
### 后端

The backend is built with Node.js and Express:
后端使用 Node.js 和 Express 构建：

- `server.js` - Main server file with all API endpoints
- `server.js` - 包含所有 API 端点的主服务器文件
- In-memory storage for API keys and conversations (would be replaced with a database in production)
- API 密钥和对话的内存存储（在生产环境中将替换为数据库）

## Deployment
## 部署

For production deployment:
对于生产部署：

1. Build the frontend:
1. 构建前端：
   ```
   cd frontend
   npm run build
   ```
2. Update the backend server to serve the frontend build files
2. 更新后端服务器以提供前端构建文件
3. Deploy both the backend and frontend build files to your hosting platform
3. 将后端和前端构建文件部署到您的托管平台

## Contributing
## 贡献

Contributions are welcome! Please feel free to submit a Pull Request.
欢迎贡献！请随时提交 Pull Request。

## License
## 许可证

This project is licensed under the MIT License.
该项目采用 MIT 许可证。