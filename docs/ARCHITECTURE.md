# Architecture

本文档描述 Chat Buddy 的技术架构。

[English](#english) | [中文](#中文)

---

## English

### Overview

Chat Buddy uses a layered architecture inspired by Clean Architecture principles. The goal is to separate business logic from UI and infrastructure concerns.

### Layers

```
┌─────────────────────────────────────────────────┐
│              Presentation Layer                 │
│         (React Components, Pages)               │
├─────────────────────────────────────────────────┤
│              Application Layer                  │
│       (Hooks: useChatService, etc.)             │
├─────────────────────────────────────────────────┤
│                Domain Layer                     │
│         (ChatEngine, AIPipeline)                │
│            Pure JS, no React                    │
├─────────────────────────────────────────────────┤
│             Infrastructure Layer                │
│       (APIClient, StorageService)               │
└─────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── core/               # Domain logic (pure JS)
│   └── chat/
│       ├── ChatEngine.js
│       └── AIPipeline.js
├── services/           # Infrastructure
│   ├── api/
│   └── storage/
├── features/           # Feature modules
│   ├── chat/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── context/
│   └── moments/
├── providers/          # Context composition
├── components/         # Shared UI
├── context/            # Global contexts
└── pages/              # Route pages
```

### Key Components

**ChatEngine** - Central state machine. Manages chats, messages, and persistence. Singleton pattern.

**AIPipeline** - Handles AI reasoning. Implements the ReAct loop for tool calling. Decoupled from React.

**StorageService** - Abstracts localStorage. Provides a clean API for persistence.

**APIClient** - HTTP client with retry logic and error handling.

### Data Flow

1. User sends message via `ChatComposer`
2. `useChatService` hook calls `ChatEngine.sendMessage()`
3. `ChatEngine` persists to `StorageService` and triggers `AIPipeline`
4. `AIPipeline` calls AI API via `APIClient`
5. Response flows back through `ChatEngine` to UI

---

## 中文

### 概述

Chat Buddy 采用分层架构，参考 Clean Architecture 原则。目标是将业务逻辑与 UI 和基础设施分离。

### 分层结构

```
┌─────────────────────────────────────────────────┐
│                  展示层                          │
│           (React 组件、页面)                     │
├─────────────────────────────────────────────────┤
│                  应用层                          │
│         (Hooks: useChatService 等)              │
├─────────────────────────────────────────────────┤
│                  领域层                          │
│         (ChatEngine, AIPipeline)                │
│              纯 JS，无 React                     │
├─────────────────────────────────────────────────┤
│                基础设施层                        │
│        (APIClient, StorageService)              │
└─────────────────────────────────────────────────┘
```

### 目录结构

```
src/
├── core/               # 领域逻辑（纯 JS）
│   └── chat/
│       ├── ChatEngine.js
│       └── AIPipeline.js
├── services/           # 基础设施
│   ├── api/
│   └── storage/
├── features/           # 功能模块
│   ├── chat/
│   └── moments/
├── providers/          # Context 组合
├── components/         # 共享 UI
└── pages/              # 路由页面
```

### 核心组件

**ChatEngine** - 状态机。管理聊天、消息和持久化。单例模式。

**AIPipeline** - 处理 AI 推理。实现 ReAct 循环。与 React 解耦。

**StorageService** - 封装 localStorage，提供统一的持久化接口。

**APIClient** - HTTP 客户端，带重试逻辑。

### 数据流

1. 用户通过 `ChatComposer` 发送消息
2. `useChatService` 调用 `ChatEngine.sendMessage()`
3. `ChatEngine` 持久化数据并触发 `AIPipeline`
4. `AIPipeline` 通过 `APIClient` 调用 AI API
5. 响应通过 `ChatEngine` 返回 UI
