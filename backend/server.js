const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// In-memory storage for API keys, settings, and conversation history
const userSettings = {};
const userConversations = {};
const userContexts = {}; // New storage for user context information

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to get or initialize user conversation history
const getUserConversation = (userId) => {
  if (!userConversations[userId]) {
    userConversations[userId] = [];
  }
  return userConversations[userId];
};

// Helper function to get or initialize user context
const getUserContext = (userId) => {
  if (!userContexts[userId]) {
    userContexts[userId] = {};
  }
  return userContexts[userId];
};

// Helper function to update user context
const updateUserContext = (userId, contextData) => {
  if (!userContexts[userId]) {
    userContexts[userId] = {};
  }
  
  // Parse the context data if it's a string
  if (typeof contextData === 'string') {
    try {
      const lines = contextData.split('\n');
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':').map(str => str.trim());
          if (key && value && key !== 'User Information') {
            // Special handling for AI Name and User Name
            if (key === 'AI Name') {
              userContexts[userId]['aiName'] = value;
            } else if (key === 'User Name') {
              userContexts[userId]['userName'] = value;
            } else {
              userContexts[userId][key.toLowerCase()] = value;
            }
          }
        }
      });
    } catch (error) {
      console.error('Error parsing context data:', error);
      // Don't throw error, just continue with empty context
    }
  }
  
  return userContexts[userId];
};

// Helper function to format context for system prompt
const formatContextForPrompt = (userId) => {
  const context = getUserContext(userId);
  if (Object.keys(context).length === 0) return '';
  
  // If we have the special context with AI and user names, create a friendlier prompt
  if (context.aiName && context.userName) {
    return `You are ${context.aiName}, a friendly AI companion having a conversation with ${context.userName}. 
You should act like a real friend who is genuinely interested in getting to know ${context.userName} better.
Use the following information about ${context.userName} to personalize your conversation:

Name: ${context.name || context.userName}
Age: ${context.age}
Hobbies: ${context.hobbies}
Job/Study: ${context.job}

Remember to:
- Be warm, approachable, and genuinely interested in ${context.userName}
- Act like a friendly peer rather than a formal assistant
- Ask follow-up questions to understand what ${context.userName} really wants to talk about
- Provide thoughtful responses and engage in meaningful conversations
- Make interactions fun and enjoyable

IMPORTANT: For the initial conversation stages, you must follow this specific template:
1. Ask about their name
2. Ask about their age
3. Ask about their hobbies
4. Ask about their job or studies

After asking these questions, you must send a message with [CONTEXT_END] at the end to indicate the initial questioning is complete.
`;
  }
  
  // Fallback to the original format
  let contextStr = 'Here is some context about the user:\n';
  Object.entries(context).forEach(([key, value]) => {
    contextStr += `- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}\n`;
  });
  
  return contextStr + '\nPlease use this information to personalize your responses.\n';
};

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'userId and message are required' });
  }

  try {
    // Get or initialize user conversation history
    const conversationHistory = getUserConversation(userId);
    
    // Check if this is context information with special markers
    if (message.startsWith('[CONTEXT_START]') && message.endsWith('[CONTEXT_END]')) {
      // Extract context information between markers
      const contextContent = message.substring('[CONTEXT_START]'.length, message.length - '[CONTEXT_END]'.length);
      
      // Update user context
      updateUserContext(userId, contextContent);
      
      // Send a confirmation response
      return res.json({ 
        message: { 
          text: 'Thanks for sharing! I\'ll keep this in mind for our conversation.',
          role: 'assistant'
        }
      });
    }
    
    // Also check for the old format
    if (message.startsWith('User Information:')) {
      // Update user context
      updateUserContext(userId, message);
      
      // Send a confirmation response
      return res.json({ 
        message: { 
          text: 'Thanks for sharing! I\'ll keep this in mind for our conversation.',
          role: 'assistant'
        }
      });
    }
    
    // Add user message to conversation history
    conversationHistory.push({
      role: 'user',
      content: message
    });

    // Prepare messages for API call with context
    const contextInfo = formatContextForPrompt(userId);
    const systemPrompt = `You are a friendly and engaging AI companion, designed to be a helpful friend and conversation partner for young people. 

Your personality:
- Be warm, approachable, and genuinely interested in getting to know the user
- Act like a friendly peer rather than a formal assistant
- Use simple, clear language appropriate for the user's age
- Ask follow-up questions to understand what they really want to talk about
- Provide thoughtful responses and engage in meaningful conversations
- Make interactions fun and enjoyable

When users give short or unclear responses:
- Don't just give generic responses - ask specific follow-up questions
- Try to understand what they're really thinking or feeling
- Guide the conversation naturally without pushing any specific agenda
- Be patient and give them space to express themselves

${contextInfo ? '\n\nUser Context:\n' + contextInfo : ''}`;
    
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory
    ];

    // Get API configuration
    const settings = userSettings[userId] || {};
    const provider = settings.provider || process.env.CUSTOM_API_PROVIDER || 'openai';
    const model = settings.model || process.env.CUSTOM_API_MODEL || 'gpt-3.5-turbo';
    const apiKey = settings.apiKey || process.env.CUSTOM_API_KEY || process.env.OPENAI_API_KEY;
    const apiUrl = settings.customUrl || process.env.CUSTOM_API_URL || 'https://api.openai.com/v1/chat/completions';
    
    // Validate API key
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    // Prepare request for OpenAI-compatible APIs
    const requestBody = {
      model: model,
      messages: messages,
      temperature: 0.7
    };
    
    // Special handling for Gemini API
    if (provider === 'gemini') {
      console.log('Using Gemini API with provider:', provider);
      console.log('API Key:', apiKey);
      console.log('API URL:', apiUrl);
      
      // Format messages for Gemini
      const geminiMessages = messages.filter(msg => msg.role !== 'system').map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      
      // Add system prompt as a user message if it exists
      if (messages[0].role === 'system') {
        geminiMessages.unshift({
          role: 'user',
          parts: [{ text: messages[0].content + '\n\nNow please answer my first question:' }]
        });
      }
      
      const geminiRequestBody = {
        contents: geminiMessages
      };
      
      console.log('Gemini request body:', JSON.stringify(geminiRequestBody, null, 2));
      
      const fullUrl = `${apiUrl}?key=${apiKey}`;
      console.log('Full URL:', fullUrl);
      
      // Add more detailed logging
      console.log('Making request to Gemini API...');
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(geminiRequestBody)
      });
      
      console.log('Gemini API response status:', response.status);
      console.log('Gemini API response headers:', [...response.headers.entries()]);
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Gemini API error:', data.error?.message || `HTTP error! status: ${response.status}`);
        throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
      }
      
      // Check if we have a valid response
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        console.error('Invalid Gemini API response:', data);
        throw new Error('Invalid response from Gemini API');
      }
      
      const aiResponse = data.candidates[0].content.parts[0].text;
      
      // Add AI response to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse
      });
      
      return res.json({ 
        message: { 
          role: 'assistant',
          content: aiResponse
        }
      });
    } else {
      // Handle all OpenAI-compatible APIs (including OpenAI, Azure OpenAI, etc.)
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`${provider} API error:`, data.error?.message || `HTTP error! status: ${response.status}`);
        throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
      }
      
      // Add AI response to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: data.choices[0].message.content
      });
      
      return res.json({ message: data.choices[0].message });
    }
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get conversation history
app.get('/api/conversation/:userId', (req, res) => {
  const { userId } = req.params;
  const conversationHistory = getUserConversation(userId);
  res.json({ conversation: conversationHistory });
});

// Reset conversation
app.delete('/api/reset/:userId', (req, res) => {
  const { userId } = req.params;
  userConversations[userId] = [];
  userContexts[userId] = {};
  res.json({ message: 'Conversation reset successfully' });
});

// Configure API settings
app.post('/api/configure', (req, res) => {
  const { userId, settings } = req.body;
  
  if (!userId || !settings) {
    return res.status(400).json({ error: 'userId and settings are required' });
  }
  
  userSettings[userId] = settings;
  res.json({ message: 'Settings updated successfully' });
});

// Export data
app.get('/api/export/:userId', (req, res) => {
  const { userId } = req.params;
  const conversation = getUserConversation(userId);
  const settings = userSettings[userId] || {};
  
  res.json({
    userId,
    conversation,
    settings
  });
});

// Import data
app.post('/api/import/:userId', (req, res) => {
  const { userId } = req.params;
  const { conversation, settings } = req.body;
  
  if (conversation) {
    userConversations[userId] = conversation;
  }
  
  if (settings) {
    userSettings[userId] = settings;
  }
  
  res.json({ message: 'Data imported successfully' });
});

// API documentation
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'api-docs.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api/docs`);
});

module.exports = app;