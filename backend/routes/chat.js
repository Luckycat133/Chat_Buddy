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
    
    const { userId, message, promptType, isEdited } = req.body;

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
    const userMessage = { role: 'user', content: message };
    if (isEdited) {
      userMessage.content += " (这条消息已被用户修改)";
    }
    conversation.push(userMessage);
    
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
    
    // Auto-detect provider and handle fallback
    let response;
    let actualProvider = provider;
    
    try {
      if (provider === 'gemini') {
        // Check if Gemini API key is available
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          console.warn('Gemini API key not found, falling back to OpenAI compatible API');
          actualProvider = 'openai';
        } else {
          response = await callGeminiAPI(messages, settings);
        }
      }
      
      if (actualProvider !== 'gemini' || !response) {
        // Use OpenAI compatible API as fallback
        response = await callOpenAICompatibleAPI(messages, settings);
      }
    } catch (apiError) {
      // Provide detailed error information based on provider
      let errorMessage;
      let errorDetails = {};
      
      if (apiError.status) {
        switch (apiError.status) {
          case 401:
            errorMessage = 'API密钥无效，请检查您的API密钥配置';
            errorDetails.code = 'INVALID_API_KEY';
            break;
          case 403:
            errorMessage = 'API访问被拒绝，请检查API密钥权限';
            errorDetails.code = 'ACCESS_DENIED';
            break;
          case 429:
            errorMessage = 'API请求频率过高，请稍后再试';
            errorDetails.code = 'RATE_LIMIT';
            break;
          case 500:
            errorMessage = 'API服务器内部错误，请稍后再试';
            errorDetails.code = 'SERVER_ERROR';
            break;
          default:
            errorMessage = `API请求失败 (状态码: ${apiError.status})`;
            errorDetails.code = 'API_ERROR';
        }
      } else if (apiError.code === 'ECONNREFUSED') {
        errorMessage = '无法连接到API服务器，请检查网络连接';
        errorDetails.code = 'CONNECTION_ERROR';
      } else {
        errorMessage = apiError.message || '未知API错误';
        errorDetails.code = 'UNKNOWN_ERROR';
      }
      
      errorDetails.provider = actualProvider;
      errorDetails.timestamp = new Date().toISOString();
      
      console.error('API Error Details:', errorDetails);
      
      throw new Error(errorMessage);
    }
    
    // Ensure response content is a string
    const content = String(response.content || '');
    
    // Add AI response to conversation
    conversation.push({ role: 'assistant', content: content });
    
    res.json({ message: { content: content } });
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
    
    // Send detailed error message to frontend
    let errorResponse = {
      error: error.message || 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR',
      provider: error.provider || 'unknown'
    };
    
    // Add specific error codes if available
    if (error.code) {
      errorResponse.errorCode = error.code;
    }
    
    // Determine HTTP status code based on error type
    let statusCode = 500;
    if (error.code === 'INVALID_API_KEY' || error.code === 'ACCESS_DENIED') {
      statusCode = 401;
    } else if (error.code === 'RATE_LIMIT') {
      statusCode = 429;
    } else if (error.code === 'CONNECTION_ERROR') {
      statusCode = 503;
    }
    
    res.status(statusCode).json(errorResponse);
  }
});

module.exports = router;