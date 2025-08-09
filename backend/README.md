# 📁 Backend for Chat Buddy

This directory contains the backend server for the Chat Buddy AI chat application. It's built with Node.js and Express, providing API endpoints for chat functionality, conversation management, and user configuration.

## 🏗️ Project Structure

```
backend/
├── server.js          # Main server file
├── .env.example       # Example environment variables
├── package.json       # Backend dependencies
├── prompts.js         # System prompts configuration
├── middleware/
│   └── security.js    # Security middleware
├── routes/            # API route handlers
│   ├── chat.js
│   ├── configure.js
│   ├── conversation.js
│   ├── export.js
│   ├── import.js
│   └── reset.js
├── services/
│   └── api.js         # API service integrations
└── utils/
    └── helpers.js     # Helper functions
```

## 🚀 Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file based on `.env.example` and configure your API keys and settings.

3. Start the server:
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## 🌐 API Endpoints

- `POST /api/chat` - Send a message to the AI
- `GET /api/conversation/:userId` - Get conversation history for a user
- `DELETE /api/reset/:userId` - Reset conversation history for a user
- `POST /api/configure` - Configure API settings
- `GET /api/export/:userId` - Export user data
- `POST /api/import/:userId` - Import user data
- `GET /api/health` - Health check endpoint
- `GET /api/docs` - API documentation

## 🔧 Environment Variables

The backend requires several environment variables to be set. See `.env.example` for all possible configuration options.

Key variables include:
- `PORT` - Server port (default: 5001)
- `CUSTOM_API_URL` - API endpoint URL
- `CUSTOM_API_KEY` - API key for authentication
- `CUSTOM_API_MODEL` - Model to use for chat completions
- `CUSTOM_API_PROVIDER` - API provider (openai, gemini, etc.)

## 🔒 Security

The backend implements several security measures:
- Rate limiting (1000 requests per IP per 15 minutes)
- Input validation and sanitization
- API URL validation against allowed domains
- XSS prevention

## 🤖 System Prompts

The backend supports multiple system prompts for different conversation modes:
- **default** - Friendly AI assistant
- **professional** - Professional AI assistant
- **creative** - Creative AI assistant
- **educational** - Educational AI assistant
- **suxiao** - Virtual friend with心理咨询 background

To use a specific prompt, set the `promptType` parameter in the frontend API call.

## 📡 Supported API Providers

The backend can integrate with multiple AI API providers:
- OpenAI
- Google Gemini
- Anthropic Claude
- OpenRouter
- Groq

To add support for additional providers, modify the provider handling code in `backend/server.js` and add the necessary API keys to your `.env` file.