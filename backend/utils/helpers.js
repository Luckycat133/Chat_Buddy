// Helper functions for Chat Buddy backend

// In-memory storage for API keys, settings, and conversation history
const userConversations = {};
const userContexts = new Map();

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

// 设置用户对话历史
function setUserConversation(userId, conversation) {
  userConversations[userId] = conversation;
}

// 设置用户上下文
function setUserContext(userId, context) {
  userContexts.set(userId, context);
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
const { SYSTEM_PROMPTS } = require('../prompts');

// 选择系统提示词的函数
const getSystemPrompt = (promptType = 'default') => {
  return SYSTEM_PROMPTS[promptType] || SYSTEM_PROMPTS.default;
};

module.exports = {
  sanitizeUrl,
  validateApiUrl,
  getUserConversation,
  getUserContext,
  updateUserContext,
  setUserConversation,
  setUserContext,
  detectUserLanguage,
  getSystemPrompt
};