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
  getSystemPrompt
} = require('../utils/helpers');

// Import API functions
const { callOpenAICompatibleAPI, callGeminiAPI } = require('../services/api');

// Import middleware
const { securityMiddleware } = require('../middleware/security');

// Chat endpoint
  router.post('/', securityMiddleware, async (req, res) => {
    // Get userSettings from app locals
    const userSettings = req.app.get('userSettings');
    
    const { userId, message, promptType } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'Missing userId or message' });
  }

  try {
    // Get or initialize user conversation and context
    let conversation = getUserConversation(userId);
    let context = getUserContext(userId);
    
    // Detect user language if not already detected
    if (!context.language) {
      context.language = detectUserLanguage(message);
      updateUserContext(userId, context);
    }
    
    // Add user message to conversation
    conversation.push({ role: 'user', content: message });
    
    // Get system prompt
    const systemPrompt = getSystemPrompt(promptType, context.language);
    
    // Prepare messages for API call
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation
    ];
    
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
    conversation.push({ role: 'assistant', content: response.content });
    
    res.json({ message: response });
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