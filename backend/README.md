# Vibe Coding Backend

This is the backend API for the Vibe Coding AI Chat Application.

## API Endpoints

### Configure API Key
- **URL**: `/api/configure`
- **Method**: `POST`
- **Body**: 
  ```json
  {
    "apiKey": "your-api-key",
    "userId": "unique-user-identifier"
  }
  ```
- **Response**: 
  ```json
  {
    "message": "API key configured successfully"
  }
  ```

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

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
PORT=5000
NODE_ENV=development
```

## Installation and Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

The server will start on `http://localhost:5000` (or your configured port).