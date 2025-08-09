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

// Import memory utils
const { addUserMemory } = require('../utils/memory');

// Import API functions
const { callOpenAICompatibleAPI, callGeminiAPI } = require('../services/api');

// Import middleware
const { securityMiddleware } = require('../middleware/security');

const ONE_HOUR = 60 * 60 * 1000;

// Chat endpoint
router.post('/', securityMiddleware, async (req, res) => {
  const userSettings = req.app.get('userSettings');
  const { userId, message, role = 'assistant' } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'Missing userId or message' });
  }

  try {
    let conversation = getUserConversation(userId, role);
    let context = getUserContext(userId);

    if (!context.language) {
      context.language = detectUserLanguage(message);
      updateUserContext(userId, context);
    }

    const now = new Date();
    conversation.push({ role: 'user', content: message, timestamp: now.toISOString() });

    const systemPrompt = getSystemPrompt(role, context.language);

    const recentMessages = conversation.filter(m => now - new Date(m.timestamp) <= ONE_HOUR);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    const settings = userSettings[userId] || {};
    const provider = settings.customApiProvider || process.env.CUSTOM_API_PROVIDER || 'openai';

    let response;
    if (provider === 'gemini') {
      response = await callGeminiAPI(messages, settings);
    } else {
      response = await callOpenAICompatibleAPI(messages, settings);
    }

    let content = response.content;
    const memoryRegex = /{{remember}}([\s\S]*?){{\/remember}}/i;
    const match = content.match(memoryRegex);
    if (match) {
      const memoryText = match[1].trim();
      addUserMemory(userId, role, memoryText);
      content = content.replace(memoryRegex, '').trim();
    }

    conversation.push({ role: 'assistant', content, timestamp: new Date().toISOString() });

    res.json({ message: { ...response, content } });
  } catch (error) {
    console.error('Error in /api/chat:');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    console.error('Request details:', {
      userId: req.body.userId,
      message: req.body.message,
      role: req.body.role
    });

    res.status(500).json({
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
