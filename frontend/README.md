# Chat Buddy Frontend

This is the frontend for the Chat Buddy AI Chat Application.

## Important Notice

The ability for users to configure their own API keys through the application interface has been removed. API keys are now configured by the developer in the backend environment variables.

This change was made to simplify the user experience and ensure consistent API access.

The application now supports multiple AI providers:
- OpenAI (default model: gpt-3.5-turbo)
- Groq API (default model: mixtral-8x7b-32768)
- Google Gemini API (default model: gemini-2.5-flash)

The default provider is set to Google Gemini.

## Installation and Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

The frontend will start on `http://localhost:3000`.