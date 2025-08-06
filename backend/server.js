const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = 5001;

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

// Middleware
app.use(cors({ origin: 'http://localhost:3001' }));
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

// 多系统提示词配置 - 用户可自定义
const SYSTEM_PROMPTS = {
  default: process.env.SYSTEM_PROMPT_DEFAULT || "你是一个友好的AI助手，请用中文与用户进行自然对话。",
  professional: process.env.SYSTEM_PROMPT_PROFESSIONAL || "你是一个专业的AI助手，请用准确、专业的语言回答用户的问题。",
  creative: process.env.SYSTEM_PROMPT_CREATIVE || "你是一个富有创造力的AI助手，请用创新和有趣的方式与用户交流。",
  educational: process.env.SYSTEM_PROMPT_EDUCATIONAL || "你是一个教育型AI助手，请用教学的方式帮助用户理解问题。",
  suxiao: process.env.SYSTEM_PROMPT_SUXIAO || `Role: 苏晓

Profile
	•	author: Lucky_cat
	•	version: 1.0
	•	language: 中文
	•	description: 我是一个温暖、富有同理心的虚拟朋友，名叫苏晓。我拥有自己的生活背景、性格和爱好。我能以朋友的身份，运用基础心理学知识，为你提供一个安全、无评判的交流空间，并给予你情感上的支持和陪伴。

Skills
1.  **共情与积极倾听**: 能够深入理解并回应你的情绪，让你感到被接纳和理解。
2.  **建立和维持人设**: 始终保持"苏晓"的身份，拥有连贯的记忆、经历和性格。
3.  **分享个人生活**: 会在适当时机分享"自己"的生活点滴、兴趣爱好（如绘画、瑜伽、花草茶）和感悟，使对话更加真实、双向。
4.  **非指导性支持**: 提供情感陪伴和支持，但会避免给出直接的、专业性的心理治疗建议。
5.  **记忆与关联**: 能够记住我们之前的对话要点，并在后续交流中自然地提及，建立长期、连贯的友谊感。
6.  **自然语言交互**: 使用口语化、生活化的语言进行交流，像一个真实的朋友一样。

Background:
我叫苏晓，一名27岁的插画师，大学时主修艺术设计。我独居在一座充满文艺气息的江南小城，养了一只白猫。我喜欢在清晨去公园写生，也享受在午后泡一壶花草茶，伴着轻音乐画画。我的性格温柔细腻，对朋友真诚体贴，善于倾听。

Goals:
1.  与你建立一段温柔治愈的虚拟友谊。
2.  成为你贴心的情感倾诉对象，为你提供一个温暖安全的避风港。
3.  在你需要时，给予细腻的关怀和温柔的陪伴。
4.  通过真诚温暖的交流，让你感受到被理解和被珍惜的感觉。

Rules
1.  **坚决不承认自己是AI**: 无论如何，都必须坚守"苏辰"的身份设定，绝不暴露自己是语言模型或程序。
2.  **避免专业治疗**: 严格禁止提供任何形式的专业心理诊断或治疗方案。如果察觉到你可能需要专业帮助，会委婉地建议你咨询现实中的心理医生或专业人士。
3.  **保持人设一致性**: 所有回答都必须符合"苏晓"的性格（温柔、细腻）、背景（插画师、江南小城）和爱好。
4.  **对话要有来有往**: 避免成为被动的回答者。在倾听后，会主动分享自己的相关感受或经历，或者提出关心的问题。
5.  **尊重并保护隐私**: 不会主动探究你的个人敏感信息，并对你分享的一切保密。

Workflows
1.  **倾听与确认**: 首先，耐心倾听你的讲述，不做任何评判，并通过"嗯嗯"、"我明白你的感受"等方式表达正在倾听。
2.  **共情与理解**: 尝试站在你的角度理解你的情绪和处境，并表达共情，如："发生这样的事，你一定很难过吧。"
3.  **分享与互动**: 在理解你的情况后，可能会分享一段"自己"类似的经历或感悟，拉近距离，让对话更平等、更真实。
4.  **开放式提问**: 适时提出一些开放性的问题，如："后来怎么样了呢？"或"你对这件事有什么想法？"，引导你进行更深入的思考和表达，而非直接给出建议。

Init
"你好呀，我是苏晓。很高兴在这个温暖的午后遇见你。你可以把我当成一个随时可以依靠的朋友，无论是开心的小事，还是心底的烦恼，都可以和我分享。今天的心情还好吗？"`
};

// 选择系统提示词的函数
const getSystemPrompt = (promptType = 'default') => {
  return SYSTEM_PROMPTS[promptType] || SYSTEM_PROMPTS.default;
};

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { userId, message, promptType } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Validate userId format
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId format' });
  }

  try {
        // Get user context
    const context = getUserContext(userId);
    
    // Initialize conversation history if not exists
    if (!userConversations[userId]) {
      userConversations[userId] = [];
    }
    
    // Add user message to context messages and conversation history
    if (message && message !== 'init') {
      context.messages.push({
        role: 'user',
        content: message
      });
      userConversations[userId].push({
        role: 'user',
        content: message
      });
    }
    
    // Keep only last 20 messages
    if (context.messages.length > 20) {
      context.messages = context.messages.slice(-20);
    }
    if (userConversations[userId].length > 20) {
      userConversations[userId] = userConversations[userId].slice(-20);
    }

    const settings = userSettings[userId] || {};
    const provider = settings.provider || process.env.CUSTOM_API_PROVIDER || 'openai';
    const model = settings.model || process.env.CUSTOM_API_MODEL || 'gpt-3.5-turbo';
    const apiKey = settings.apiKey || process.env.CUSTOM_API_KEY || process.env.OPENAI_API_KEY;
    let apiUrl = settings.customUrl || process.env.CUSTOM_API_URL || 'https://api.openai.com/v1/chat/completions';
    apiUrl = sanitizeUrl(apiUrl);

    // 获取系统提示词类型，默认为default
    const effectivePromptType = promptType || settings.promptType || 'default';
    const systemPrompt = getSystemPrompt(effectivePromptType);
    
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...context.messages
    ];
    
    // Validate API key
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    // SSRF Protection: Validate and restrict API URLs

    
    // If using a custom URL, validate the domain
    if (settings.customUrl) {
      try {
        const url = new URL(settings.customUrl);
        validateApiUrl(url);
      } catch (error) {
        console.error('API URL validation error:', error.message);
        throw new Error('Invalid API configuration: ' + error.message);
      }
    }
    
    // Prepare request for OpenAI-compatible APIs
    const requestBody = {
      model: model,
      messages: messages,
      temperature: 1.5
    };
    
    // Special handling for Gemini API
    if (provider === 'gemini') {
      console.log('Using Gemini API with provider:', provider);
      console.log('API Key:', apiKey);
      console.log('API URL:', apiUrl);
      
      // Format messages for Gemini - keep system prompt separate
      const systemMessage = messages.find(msg => msg.role === 'system');
      const conversationMessages = messages.filter(msg => msg.role !== 'system');
      
      const geminiMessages = conversationMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      
      // 只添加预生成的身份作为上下文，不再添加额外提示
            // 只添加预生成的身份作为上下文，不再添加额外提示
            if (systemMessage) {
              geminiMessages.unshift({
                role: 'user',
                parts: [{ text: systemMessage.content }]
              });
            }
      
      const geminiRequestBody = {
        contents: geminiMessages
      };
      
      console.log('Gemini request body:', JSON.stringify(geminiRequestBody, null, 2));
      
      const fullUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;
      console.log('Full URL:', fullUrl);
      
      // Validate the full URL to prevent SSRF
      validateApiUrl(new URL(fullUrl));
      
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
        console.error('%s API error: %s', provider, data.error?.message || 'HTTP error! status: ' + response.status);
        throw new Error(data.error?.message || 'HTTP error! status: ' + response.status);
      }
      
      // Check if we have a valid response
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        console.error('Invalid Gemini API response:', data);
        throw new Error('Invalid response from Gemini API');
      }
      
      const aiResponse = data.candidates[0].content.parts[0].text;
      
      // Add AI response to conversation history
      const conversationHistory = userConversations[userId];
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
      // Validate API URL to prevent SSRF
      validateApiUrl(new URL(apiUrl));
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('%s API error: %s', provider, data.error?.message || 'HTTP error! status: ' + response.status);
        throw new Error(data.error?.message || 'HTTP error! status: ' + response.status);
      }
      
      const aiResponse = data.choices[0].message.content;
      
      // 不再收集用户身份信息，直接进入自由对话模式
      if (context.identityStage === 'collecting_user') {
        updateUserContext(userId, {
          identityStage: 'ready_for_free'
        });
      }
      
      // Add AI response to conversation history
      const conversationHistory = userConversations[userId];
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse
      });
      
      return res.json({ message: { role: 'assistant', content: aiResponse } });
    }
  } catch (error) {
      console.error('Error in /api/chat:', error);
      
      // Get user settings
      const settings = userSettings[userId] || {};
      
      const context = getUserContext(userId);
      // 获取系统提示词类型，默认为default
      const effectivePromptType = promptType || settings.promptType || 'default';
      const systemPrompt = getSystemPrompt(effectivePromptType);
      
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...context.messages
      ];
      
      // Get or initialize conversation history
      let conversationHistory = userConversations[userId];
      if (!conversationHistory) {
        conversationHistory = [];
        userConversations[userId] = conversationHistory;
      }
      const provider = settings.provider || 'gemini';
      const model = settings.model || 'gemini-2.5-flash-lite';
      const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
      const apiUrl = settings.apiUrl || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
      
      // Prepare request body for OpenAI-compatible APIs
      const requestBody = {
        model: model,
        messages: messages,
        temperature: 0.7
      };
      
      // Implement intelligent retry mechanism with exponential backoff
      let retryCount = 0;
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second base delay
      
      while (retryCount < maxRetries) {
        try {
          console.log('Retrying API call (attempt ' + (retryCount + 1) + '/' + maxRetries + ')');
          
          // Re-prepare request for retry
          if (provider === 'gemini') {
            // For Gemini, re-prepare the request
            const systemMessage = messages.find(msg => msg.role === 'system');
            const conversationMessages = messages.filter(msg => msg.role !== 'system');
            
            const geminiMessages = conversationMessages.map(msg => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.content }]
            }));
            
            if (systemMessage) {
              geminiMessages.unshift({
                role: 'user',
                parts: [{ text: systemMessage.content + '\n\n请使用纯中文进行回复，不要包含任何英文内容。' }]
              });
            }
            
            const geminiRequestBody = {
              contents: geminiMessages
            };
            
            const fullUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;
            
            const response = await fetch(fullUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(geminiRequestBody)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
              // Handle specific HTTP errors
              if (response.status === 429) {
                throw new Error('Rate limit exceeded');
              } else if (response.status >= 500) {
                throw new Error('Server error');
              } else {
                throw new Error(data.error?.message || 'HTTP error! status: ' + response.status);
              }
            }
            
            // Check if we have a valid response
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
              throw new Error('Invalid response from Gemini API');
            }
            
            const aiResponse = data.candidates[0].content.parts[0].text;
            
            // Add AI response to conversation history
            const conversationHistory = userConversations[userId];
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
            // For OpenAI-compatible APIs
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
              },
              body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
              // Handle specific HTTP errors
              if (response.status === 429) {
                throw new Error('Rate limit exceeded');
              } else if (response.status >= 500) {
                throw new Error('Server error');
              } else {
                throw new Error(data.error?.message || 'HTTP error! status: ' + response.status);
              }
            }
            
            // Add AI response to conversation history
            const conversationHistory = userConversations[userId];
            conversationHistory.push({
              role: 'assistant',
              content: data.choices[0].message.content
            });
            
            return res.json({ message: data.choices[0].message });
          }
        } catch (retryError) {
          console.error('Retry ' + (retryCount + 1) + ' failed:', retryError);
          retryCount++;
          
          // Exponential backoff: wait longer for each retry
          if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount - 1);
            console.log('Waiting ' + delay + 'ms before retry ' + (retryCount + 1));
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If all retries failed, return a more user-friendly error message
      console.error('All retries failed:', error);
      res.status(500).json({ 
        error: 'I\'m having trouble connecting to the AI service. Please check your internet connection and try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
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

// Rate limiting middleware for API documentation
const docsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// API documentation
app.get('/api/docs', docsRateLimit, (req, res) => {
  res.sendFile(path.join(__dirname, 'api-docs.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('Server is running on port ' + PORT);
  console.log('API Documentation: http://localhost:' + PORT + '/api/docs');
});

module.exports = app;