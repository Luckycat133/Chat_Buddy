# Chat Buddy Frontend

This is the frontend for the Chat Buddy AI Chat Application.

## Important Notice

The ability for users to configure their own API keys through the application interface has been removed. API keys are now configured by the developer in the backend environment variables.

This change was made to simplify the user experience and ensure consistent API access.

The application now supports any OpenAI-compatible API providers, including but not limited to:
- OpenAI (default model: gpt-3.5-turbo)
- Groq API (default model: mixtral-8x7b-32768)
- Google Gemini API (default model: gemini-2.5-flash-lite)
- Azure OpenAI
- Anthropic Claude
- And many other OpenAI-compatible APIs

The default provider is set to OpenAI.

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

   Alternatively, if you want to start both the frontend and backend at the same time, you can run this command from the root directory of the project:
   ```
   npm start
   ```

The frontend will start on `http://localhost:3000`.

## API Key Configuration

To use this application, you must configure your API keys in the backend:

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a `.env` file by copying the example:
   ```
   cp .env.example .env
   ```

3. Edit the `.env` file and replace `your_actual_api_key_here` with your actual API key from your chosen provider.

4. You can also modify the other settings in the `.env` file to use a different provider or model if desired.

5. Restart the backend server for the changes to take effect.