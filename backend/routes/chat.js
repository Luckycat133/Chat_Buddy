const express = require('express');
const router = express.Router();

// Import helper functions
const {
  sanitizeUrl,
  validateApiUrl,
  getUserConversation,
  getUserContext,
  updateUserContext,
  detectUserLanguage,
  getSystemPrompt,
  addMemory
} = require('../utils/helpers');

// Import API functions
const { callOpenAICompatibleAPI, callGeminiAPI } = require('../services/api');

// Import middleware
const { securityMiddleware } = require('../middleware/security');

// Chat endpoint
  router.post('/', securityMiddleware, async (req, res) => {
    // Get userSettings from app locals
    const userSettings = req.app.get('userSettings');
    
    const { userId, message, role } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'Missing userId or message' });
  }

  try {
    // Get or initialize user conversation and context
    const roleName = role || 'default';
    let conversation = getUserConversation(userId, roleName);
    let context = getUserContext(userId);
    
    // Detect user language if not already detected
    if (!context.language) {
      context.language = detectUserLanguage(message);
      updateUserContext(userId, context);
    }
    
    // Add user message to conversation
    conversation.push({ role: 'user', content: message, timestamp: Date.now() });
    
    // Get system prompt
    const systemPrompt = getSystemPrompt(roleName, context.language);

    // Prepare messages for API call with context filtering
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recent = conversation.filter(m => m.timestamp >= oneHourAgo);
    const messages = [{ role: 'system', content: systemPrompt }];
    let lastTime = 0;
    recent.forEach(m => {
      let content = m.content;
      if (m.timestamp - lastTime > 5 * 60 * 1000) {
        const time = new Date(m.timestamp).toLocaleTimeString('en-US', { hour12: false });
        content = `[${time}] ${content}`;
        lastTime = m.timestamp;
      }
      messages.push({ role: m.role, content });
    });
    
    // Get user settings
    const settings = userSettings[userId] || {};
    
    // Use environment default if no user setting is provided
    const provider = settings.customApiProvider || process.env.CUSTOM_API_PROVIDER || 'openai';
    
    // Call appropriate API based on settings
    let response;
    if (provider === 'gemini') {
      response = await callGeminiAPI(messages, settings);
    } else {
      response = await callOpenAICompatibleAPI(messages, settings);
    }
    
    // Add AI response to conversation
    // Extract memory directive from AI response
    const regex = /<memory>([\s\S]*?)<\/memory>/i;
    let aiText = response.content;
    const match = aiText.match(regex);
    if (match) {
      const memoryText = match[1].trim();
      addMemory(userId, memoryText);
      aiText = aiText.replace(regex, '').trim();
    }

    conversation.push({ role: 'assistant', content: aiText, timestamp: Date.now() });

    res.json({ message: { content: aiText } });
  } catch (error) {
    // Enhanced error logging
    console.error('Error in /api/chat:');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Log request details for debugging
    console.error('Request details:', {
      userId: req.body.userId,
      message: req.body.message,
      promptType: req.body.promptType
    });
    
    // Send user-friendly error message
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;