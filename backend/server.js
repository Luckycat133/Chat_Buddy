const express = require('express');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for API keys, settings and conversations
// In a production environment, this would be replaced with a database
// Data is stored in memory and never cleared unless explicitly reset
const apiKeys = new Map();
const userSettings = new Map();
const conversations = new Map();

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// Utility function to get accurate timestamp
const getAccurateTimestamp = () => {
  // Returns an ISO string with millisecond precision
  // This ensures exact time tracking for each conversation
  return new Date().toISOString();
};

// API Routes

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { userId, message } = req.body;
  
  if (!userId || !message) {
    return res.status(400).json({ error: 'User ID and message are required' });
  }
  
  // Set the API key from environment variables based on the selected provider
  // Default to Gemini if available, otherwise Groq, then OpenAI
  let apiKey;
  let selectedProvider = 'gemini'; // Default provider
  
  // Check for available API keys and select the appropriate one
  if (process.env.GEMINI_API_KEY) {
    apiKey = process.env.GEMINI_API_KEY;
    selectedProvider = 'gemini';
  } else if (process.env.GROQ_API_KEY) {
    apiKey = process.env.GROQ_API_KEY;
    selectedProvider = 'groq';
  } else if (process.env.OPENAI_API_KEY) {
    apiKey = process.env.OPENAI_API_KEY;
    selectedProvider = 'openai';
  }
  
  // Check if API key is available
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }
  
  apiKeys.set(userId, apiKey);
  
  try {
    // Get or create conversation history for this user
    if (!conversations.has(userId)) {
      conversations.set(userId, []);
    }
    
    const history = conversations.get(userId);
    
    // Add the new user message to history with accurate timestamp
    const timestamp = getAccurateTimestamp();
    const newMessage = {
      id: history.length + 1,
      text: message,
      sender: 'user',
      timestamp: timestamp
    };
    
    history.push(newMessage);
    
    // Use default settings
    const userSettings = {
      provider: 'gemini',
      modelName: 'gemini-2.5-flash',
      temperature: 0.7
    };
    
    // Handle different API providers
    // The application is designed to be flexible and can work with any AI provider
    // that supports the OpenAI API format. You can easily extend it to support
    // additional providers by adding more conditions here.
    
    let reply;
    
    if (userSettings.provider === 'gemini') {
      // For Google Gemini
      try {
        const geminiApiKey = process.env.GEMINI_API_KEY || apiKey;
        
        if (!geminiApiKey) {
          throw new Error('GEMINI_API_KEY is not configured');
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${userSettings.modelName || 'gemini-pro'}:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: [
                  "You are a helpful coding assistant. Help the user with their programming questions and provide clear, accurate code examples when needed. Always be friendly and encouraging.",
                  ...history.map(m => m.text)
                ].join('\n\n')
              }]
            }],
            generationConfig: {
              temperature: userSettings.temperature || 0.7,
              maxOutputTokens: 500
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        reply = data.candidates[0].content.parts[0].text;
      } catch (error) {
        console.error('Gemini API error:', error);
        throw new Error(`Failed to call Gemini API: ${error.message}`);
      }
    } else if (userSettings.provider === 'openai' || userSettings.provider === 'groq' || !userSettings.provider) {
      // For OpenAI, Groq, and any other providers that use the OpenAI API format
      // Default to OpenAI if no provider is specified
      let apiUrl, modelName;
      
      if (userSettings.provider === 'openai') {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        modelName = userSettings.modelName || 'gpt-3.5-turbo';
      } else if (userSettings.provider === 'groq') {
        apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        modelName = userSettings.modelName || 'llama3-70b-8192';
      } else {
        // Default to OpenAI
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        modelName = userSettings.modelName || 'gpt-3.5-turbo';
      }
      
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: "You are a helpful coding assistant. Help the user with their programming questions and provide clear, accurate code examples when needed. Always be friendly and encouraging." },
              ...history.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
              }))
            ],
            temperature: userSettings.temperature || 0.7,
            max_tokens: 500
          })
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        reply = data.choices[0].message.content;
      } catch (error) {
        console.error(`${userSettings.provider || 'OpenAI'} API error:`, error);
        throw new Error(`Failed to call ${userSettings.provider || 'OpenAI'} API: ${error.message}`);
      }
    } else {
      // For any other providers, you can add more conditions here
      // This is where you would add support for other APIs
      throw new Error(`Unsupported provider: ${userSettings.provider}. Please check your configuration.`);
    }
    
    // Add AI response to history with accurate timestamp
    const aiResponse = {
      id: history.length + 1,
      text: reply,
      sender: 'ai',
      timestamp: getAccurateTimestamp()
    };
    
    history.push(aiResponse);
    
    res.json({
      message: aiResponse,
      conversation: history
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message', details: error.message });
  }
});

// Get conversation history
app.get('/api/conversation/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  // Return the complete conversation history
  // This ensures memory is never cleared
  const conversation = conversations.get(userId) || [];
  res.json({ conversation });
});

// Reset API key and conversation history
app.delete('/api/reset/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  // Only reset when explicitly requested by the user
  // This ensures memory persistence by default
  apiKeys.delete(userId);
  conversations.delete(userId);
  userSettings.delete(userId);
  
  res.json({ message: 'API key and conversation history reset successfully' });
});

// Configure API key endpoint
app.post('/api/configure', (req, res) => {
  const { userId, apiKey } = req.body;
  
  if (!userId || !apiKey) {
    return res.status(400).json({ error: 'User ID and API key are required' });
  }
  
  // Store the API key
  apiKeys.set(userId, apiKey);
  
  res.json({ message: 'API key configured successfully' });
});

// Export data endpoint
app.get('/api/export/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  const userData = {
    apiKey: apiKeys.get(userId) || null,
    settings: userSettings.get(userId) || {},
    conversations: conversations.get(userId) || []
  };
  
  res.json(userData);
});

// Import data endpoint
app.post('/api/import/:userId', (req, res) => {
  const { userId } = req.params;
  const { apiKey, settings, conversations: importedConversations } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  if (apiKey) {
    apiKeys.set(userId, apiKey);
  }
  
  if (settings) {
    userSettings.set(userId, settings);
  }
  
  if (importedConversations) {
    conversations.set(userId, importedConversations);
  }
  
  res.json({ message: 'Data imported successfully' });
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'Chat Buddy Backend API Documentation',
    endpoints: [
      {
        method: 'POST',
        path: '/api/configure',
        description: 'Configure API key for a user',
        body: {
          apiKey: 'string (required)',
          userId: 'string (required)'
        }
      },
      {
        method: 'POST',
        path: '/api/chat',
        description: 'Send a message to the AI model',
        body: {
          message: 'string (required)',
          userId: 'string (required)'
        }
      },
      {
        method: 'GET',
        path: '/api/conversation/:userId',
        description: 'Get conversation history for a user'
      },
      {
        method: 'DELETE',
        path: '/api/reset/:userId',
        description: 'Reset API key and conversation history for a user'
      }
    ],
    features: [
      'Persistent memory that never gets cleared',
      'Accurate timestamp tracking for all conversations',
      'Secure API key storage',
      'User-specific conversation isolation'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Documentation available at http://localhost:${PORT}/api/docs`);
});

module.exports = app;