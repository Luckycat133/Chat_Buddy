const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// General rate limiting middleware
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply general rate limiting to all requests
app.use(generalRateLimit);

// In-memory storage for API keys, settings, and conversation history
const userSettings = {};
const userConversations = {};
const userContexts = new Map();

// Import modular routes
const chatRouter = require('./routes/chat');
const conversationRouter = require('./routes/conversation');
const resetRouter = require('./routes/reset');
const configureRouter = require('./routes/configure');
const exportRouter = require('./routes/export');
const importRouter = require('./routes/import');

// Middleware
app.use(cors({ origin: ['http://localhost:3001', 'http://192.168.0.98:3001'] }));
app.use(express.json());

// Function to sanitize and validate URLs
const sanitizeUrl = (url) => {
  try {
    const urlObj = new URL(url);
    // Remove any potentially dangerous characters from pathname
    urlObj.pathname = urlObj.pathname.replace(/[^\w\-\/\.]/g, '');
    // Prevent path traversal
    if (urlObj.pathname.includes('..')) {
      throw new Error('Invalid URL: Path traversal detected');
    }
    return urlObj.toString();
  } catch (error) {
    throw new Error('Invalid URL: Malformed URL');
  }
};

// Function to validate API URLs against allowed domains
const validateApiUrl = (url) => {
  const allowedDomains = [
    'api.openai.com',
    'generativelanguage.googleapis.com',
    'api.anthropic.com',
    'openrouter.ai',
    'api.groq.com'
  ];
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Strict protocol check - only allow HTTPS
    if (urlObj.protocol !== 'https:') {
      throw new Error('Invalid API URL: Only HTTPS protocol is allowed');
    }
    
    // Check if the hostname is in our allowed list
    const isAllowed = allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
    
    if (!isAllowed) {
      throw new Error('Invalid API URL: Domain not allowed');
    }
    
    // Block all IP addresses including localhost and 127.0.0.1
    const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipPattern.test(hostname) || hostname === 'localhost') {
      throw new Error('Invalid API URL: IP addresses and localhost not allowed');
    }
    
    // Block private/internal network ranges
    const privateIpRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^0\./,
      /^169\.254\./
    ];
    
    // Also check the resolved IP if possible (note: this is a basic check)
    // In production, consider using DNS resolution and IP checking
    
  } catch (error) {
    if (error.message.startsWith('Invalid API URL:')) {
      throw error;
    }
    throw new Error('Invalid API URL: Malformed URL');
  }
};

// Helper function to get or initialize user conversation history
const getUserConversation = (userId) => {
  if (!userConversations[userId]) {
    userConversations[userId] = [];
  }
  return userConversations[userId];
};

// 获取用户上下文
function getUserContext(userId) {
  if (!userContexts.has(userId)) {
    userContexts.set(userId, {
      messages: [],
      aiIdentityObj: null,
      identityStage: 'init' // init -> ready_for_free
    });
  }
  return userContexts.get(userId);
}

// 更新用户上下文
function updateUserContext(userId, updates) {
  const context = getUserContext(userId);
  Object.assign(context, updates);
  return context;
}

// Function to detect user's language preference
function detectUserLanguage(message) {
  // Simple heuristic to detect Chinese characters
  const chineseRegex = /[\u4e00-\u9fff]/;
  if (chineseRegex.test(message)) {
    return 'zh';
  }
  return 'zh';
}

// 引入系统提示词配置
const { SYSTEM_PROMPTS } = require('./prompts');

// 选择系统提示词的函数
const getSystemPrompt = (promptType = 'default') => {
  return SYSTEM_PROMPTS[promptType] || SYSTEM_PROMPTS.default;
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'API Documentation',
    endpoints: {
      'POST /api/chat': 'Send a message to the AI',
      'GET /api/conversation/:userId': 'Get conversation history for a user',
      'POST /api/reset/:userId': 'Reset conversation history for a user',
      'POST /api/configure': 'Configure API settings',
      'GET /api/export/:userId': 'Export user data',
      'POST /api/import/:userId': 'Import user data',
      'GET /api/health': 'Health check endpoint'
    },
    userIdFormat: 'Alphanumeric characters, hyphens, and underscores only',
    rateLimiting: '1000 requests per IP per 15 minutes'
  });
});

// API routes
app.use('/api/chat', chatRouter);
app.use('/api/conversation', conversationRouter);
app.use('/api/reset', resetRouter);
app.use('/api/configure', configureRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);



// Start server
app.listen(PORT, () => {
  console.log('Server is running on port ' + PORT);
  console.log('API Documentation: http://localhost:' + PORT + '/api/docs');
});

module.exports = app;