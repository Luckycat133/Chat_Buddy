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

// Chat endpoint
router.post('/chat', async (req, res) => {
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
    
    // Call appropriate API based on settings
    let response;
    if (settings.customApiProvider === 'gemini') {
      response = await callGeminiAPI(messages, settings);
    } else {
      response = await callOpenAICompatibleAPI(messages, settings);
    }
    
    // Add AI response to conversation
    conversation.push({ role: 'assistant', content: response.content });
    
    res.json({ message: response });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    
    // Send user-friendly error message
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;