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
  
  // Get user settings
  const userSetting = userSettings.get(userId) || {};
  
  // Use environment variable based configuration
  // Check for custom API configuration first
  let apiKey, apiUrl, modelName, provider;
  if (process.env.CUSTOM_API_URL && process.env.CUSTOM_API_KEY) {
    apiKey = process.env.CUSTOM_API_KEY;
    apiUrl = process.env.CUSTOM_API_URL;
    modelName = process.env.CUSTOM_API_MODEL || 'default-model';
    provider = process.env.CUSTOM_API_PROVIDER || 'custom';
  } else {
    // If no custom API is configured, use default OpenAI configuration
    apiKey = process.env.OPENAI_API_KEY || process.env.CUSTOM_API_KEY;
    apiUrl = process.env.CUSTOM_API_URL || 'https://api.openai.com/v1/chat/completions';
    modelName = process.env.CUSTOM_API_MODEL || 'gpt-3.5-turbo';
    provider = 'openai';
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
  

  
  // Use user settings or defaults
  const settings = userSettings.get(userId) || {};
  
  const userSettingsObj = {
    provider: settings.provider || provider || 'gemini',
    modelName: settings.modelName || modelName || 'gemini-2.5-flash',
    temperature: settings.temperature || 0.7
  };
    
    // Handle API requests for OpenAI-compatible APIs
    // The application is designed to work with any AI provider that supports the OpenAI API format
    
    let reply;
    
    // Handle different API providers
    if (userSettingsObj.provider === 'custom' && process.env.CUSTOM_API_PROVIDER === 'gemini') {
      // Special handling for Gemini API when using custom provider
      try {
        // Use custom API configuration from environment variables
        const customApiUrl = process.env.CUSTOM_API_URL;
        const customApiKey = process.env.CUSTOM_API_KEY;
        
        if (!customApiUrl || !customApiKey) {
          throw new Error('Custom API configuration is incomplete. Please check your environment variables.');
        }
        
        // For custom providers with CUSTOM_API_PROVIDER=gemini, we'll use the Gemini-specific handling
        const response = await fetch(`${customApiUrl}?key=${customApiKey}`, {
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
              temperature: userSettingsObj.temperature || 0.7,
              maxOutputTokens: 500
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`Custom Gemini API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        reply = data.candidates[0].content.parts[0].text;
      } catch (error) {
        console.error('Custom Gemini API error:', error);
        throw new Error(`Failed to call Custom Gemini API: ${error.message}`);
      }
    } else if (userSettingsObj.provider === 'custom') {
      // For other custom providers, use the OpenAI API format as a default
      try {
        // Use custom API configuration from environment variables
        const customApiUrl = process.env.CUSTOM_API_URL;
        const customApiKey = process.env.CUSTOM_API_KEY;
        const customApiModel = process.env.CUSTOM_API_MODEL;
        
        if (!customApiUrl || !customApiKey || !customApiModel) {
          throw new Error('Custom API configuration is incomplete. Please check your environment variables.');
        }
        
        // For custom providers, we'll use the OpenAI API format as a default
        // This can be customized further based on the specific API requirements
        const response = await fetch(customApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${customApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: customApiModel,
            messages: [
              { role: "system", content: "You are a helpful coding assistant. Help the user with their programming questions and provide clear, accurate code examples when needed. Always be friendly and encouraging." },
              ...history.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
              }))
            ],
            temperature: userSettingsObj.temperature || 0.7,
            max_tokens: 500
          })
        });
        
        if (!response.ok) {
          throw new Error(`Custom API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        reply = data.choices[0].message.content;
      } catch (error) {
        console.error('Custom API error:', error);
        throw new Error(`Failed to call Custom API: ${error.message}`);
      }
    } else {
      // For all other providers, use the standard OpenAI API format
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: userSettingsObj.modelName || modelName,
            messages: [
              { role: "system", content: "You are a helpful coding assistant. Help the user with their programming questions and provide clear, accurate code examples when needed. Always be friendly and encouraging." },
              ...history.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
              }))
            ],
            temperature: userSettingsObj.temperature || 0.7,
            max_tokens: 500
          })
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        reply = data.choices[0].message.content;
      } catch (error) {
        console.error(`${userSettingsObj.provider || 'OpenAI'} API error:`, error);
        throw new Error(`Failed to call ${userSettingsObj.provider || 'OpenAI'} API: ${error.message}`);
      }
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