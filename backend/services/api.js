// API service functions for Chat Buddy backend

// Load environment variables
require('dotenv').config();

// Simple in-memory cache for API keys (in production, use Redis or similar)
const apiKeyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Function to get API key from cache or environment
const getApiKey = (provider) => {
  const cacheKey = `api_key_${provider}`;
  const cached = apiKeyCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }
  
  // Get from environment variables
  let apiKey;
  switch (provider) {
    case 'openai':
      apiKey = process.env.OPENAI_API_KEY || process.env.CUSTOM_API_KEY;
      break;
    case 'gemini':
      apiKey = process.env.GEMINI_API_KEY || process.env.CUSTOM_API_KEY;
      break;
    default:
      apiKey = process.env.CUSTOM_API_KEY;
  }
  
  // Cache the key
  if (apiKey) {
    apiKeyCache.set(cacheKey, {
      value: apiKey,
      timestamp: Date.now()
    });
  }
  
  return apiKey;
};

// Function to clear API key cache
const clearApiKeyCache = (provider) => {
  const cacheKey = `api_key_${provider}`;
  apiKeyCache.delete(cacheKey);
};

const callOpenAICompatibleAPI = async (messages, settings) => {
  // Get API configuration from environment variables or settings
  const apiUrl = settings.customApiUrl || process.env.CUSTOM_API_URL;
  const apiKey = settings.customApiKey || getApiKey('openai');
  const apiModel = settings.customApiModel || process.env.CUSTOM_API_MODEL || 'gpt-3.5-turbo';
  
  // Check if API configuration is available
  if (!apiUrl || !apiKey) {
    throw new Error('API configuration is missing. Please check your .env file or user settings.');
  }
  
  try {
    // Prepare the request body for OpenAI-compatible API
    // Ensure messages are properly formatted
    const validMessages = messages.filter(msg => msg.content && msg.content.trim() !== '');
    if (validMessages.length === 0) {
      throw new Error('No valid messages to send to API');
    }
    
    const requestBody = {
      model: apiModel,
      messages: validMessages,
      temperature: 0.7,
      max_tokens: 2000  // Add reasonable limit to prevent issues
    };
    
    // Make the API call
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      // Clear cache if we get an auth error
      if (response.status === 401 || response.status === 403) {
        clearApiKeyCache('openai');
      }
      
      // Try to get error details from response
      let errorMessage = `API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }
    
    const data = await response.json();
    
    // Return the response content
    return {
      content: data.choices[0].message.content
    };
  } catch (error) {
    console.error('Error calling OpenAI-compatible API:', error);
    throw error;
  }
};

const callGeminiAPI = async (messages, settings) => {
  // Get API configuration from environment variables or settings
  const apiKey = settings.customApiKey || getApiKey('gemini');
  const apiModel = settings.customApiModel || process.env.CUSTOM_API_MODEL || 'gemini-1.5-flash';
  
  // Check if API configuration is available
  if (!apiKey) {
    throw new Error('API configuration is missing. Please check your .env file or user settings.');
  }
  
  // Construct the full API URL with the model and API key
  const fullApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`;
  
  try {
    // Convert messages to Gemini format
    // Gemini API doesn't support system messages, so we merge system prompt with first user message
    let contents = [];
    let systemPrompt = '';
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        let content = msg.content;
        
        // If this is the first user message and we have system prompt, prepend it
        if (role === 'user' && systemPrompt && contents.length === 0) {
          content = systemPrompt + "\n\n" + content;
        }
        
        contents.push({
          role: role,
          parts: [{ text: content }]
        });
      }
    };
    
    // If only system message exists, create a user message with it
    if (contents.length === 0 && systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
    }
    
    // Prepare the request body for Gemini API
    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: 0.7
      }
    };
    
    // Make the API call
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      // Clear cache if we get an auth error
      if (response.status === 401 || response.status === 403) {
        clearApiKeyCache('gemini');
      }
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Return the response content
    return {
      content: data.candidates[0].content.parts[0].text
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
};

module.exports = {
  callOpenAICompatibleAPI,
  callGeminiAPI
};