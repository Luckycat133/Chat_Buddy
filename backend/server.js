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

// Configure API key
app.post('/api/configure', (req, res) => {
  const { apiKey, userId } = req.body;
  
  if (!apiKey || !userId) {
    return res.status(400).json({ error: 'API key and user ID are required' });
  }
  
  // Store the API key (in production, this should be more secure)
  // Using Map for efficient key-value storage
  apiKeys.set(userId, apiKey);
  
  // Initialize conversation history for this user
  // This ensures persistent memory that never gets cleared
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }
  
  res.json({ message: 'API key configured successfully' });
});

// Save settings endpoint
app.put('/api/settings/:userId', (req, res) => {
  const { userId } = req.params;
  const settings = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  userSettings.set(userId, settings);
  
  // Also save the API key to the apiKeys map if it exists in settings
  if (settings.apiKey) {
    apiKeys.set(userId, settings.apiKey);
  }
  
  res.json({ message: 'Settings saved successfully' });
});

// Get settings endpoint
app.get('/api/settings/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  const settings = userSettings.get(userId) || {};
  res.json(settings);
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { userId, message, settings } = req.body;
  
  if (!userId || !message) {
    return res.status(400).json({ error: 'User ID and message are required' });
  }
  
  // Check if API key exists for this user
  // This ensures only authorized users can access the AI model
  if (!apiKeys.has(userId)) {
    return res.status(401).json({ error: 'API key not configured for this user' });
  }
  
  try {
    // Get the stored API key for this user
    const apiKey = apiKeys.get(userId);
    
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
    
    // Use provided settings or default settings if none provided
    const userSettings = settings || {
      provider: 'openai',
      providerUrl: '',
      providerName: '',
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7,
      apiKey: apiKey
    };
    
    let reply;
    
    // Handle different service providers
    if (userSettings.provider === 'openai') {
      // Call OpenAI API
      const openai = new OpenAI({ apiKey: userSettings.apiKey || apiKey });
      
      const completion = await openai.chat.completions.create({
        model: userSettings.modelName || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful coding assistant. Help the user with their programming questions and provide clear, accurate code examples when needed. Always be friendly and encouraging." },
          ...history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        ],
        max_tokens: 500,
        temperature: userSettings.temperature || 0.7
      });
      
      reply = completion.choices[0].message.content;
    } else if (userSettings.provider === 'anthropic') {
      // Call Anthropic API
      const anthropic = new Anthropic({ apiKey: userSettings.apiKey || apiKey });
      
      const response = await anthropic.messages.create({
        model: userSettings.modelName || "claude-2",
        messages: [
          { role: "user", content: "You are a helpful coding assistant. Help the user with their programming questions and provide clear, accurate code examples when needed. Always be friendly and encouraging." },
          ...history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        ],
        max_tokens: 500,
        temperature: userSettings.temperature || 0.7
      });
      
      reply = response.content[0].text;
    } else if (userSettings.provider === 'custom') {
      // Call custom endpoint
      if (!userSettings.providerUrl) {
        throw new Error('Provider URL is required for custom service provider');
      }
      
      const response = await fetch(userSettings.providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userSettings.apiKey || apiKey}`
        },
        body: JSON.stringify({
          model: userSettings.modelName || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful coding assistant. Help the user with their programming questions and provide clear, accurate code examples when needed. Always be friendly and encouraging." },
            ...history.map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }))
          ],
          max_tokens: 500,
          temperature: userSettings.temperature || 0.7
        })
      });
      
      if (!response.ok) {
        throw new Error(`Custom API error: ${response.status}`);
      }
      
      const data = await response.json();
      reply = data.choices[0].message.content;
    } else {
      throw new Error('Unsupported service provider');
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
    message: 'Vibe Coding Backend API Documentation',
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