// API service functions for Chat Buddy backend

// Load environment variables
require('dotenv').config();

const callOpenAICompatibleAPI = async (messages, settings) => {
  // Get API configuration from environment variables
  const apiUrl = process.env.CUSTOM_API_URL;
  const apiKey = process.env.CUSTOM_API_KEY;
  const apiModel = process.env.CUSTOM_API_MODEL || 'gpt-3.5-turbo';
  
  // Check if API configuration is available
  if (!apiUrl || !apiKey) {
    throw new Error('API configuration is missing. Please check your .env file.');
  }
  
  try {
    // Prepare the request body for OpenAI-compatible API
    const requestBody = {
      model: apiModel,
      messages: messages,
      temperature: 0.7
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
      throw new Error(`API request failed with status ${response.status}`);
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
  // Get API configuration from environment variables
  const apiUrl = process.env.CUSTOM_API_URL;
  const apiKey = process.env.CUSTOM_API_KEY;
  const apiModel = process.env.CUSTOM_API_MODEL || 'gemini-1.5-flash';
  
  // Check if API configuration is available
  if (!apiKey) {
    throw new Error('API configuration is missing. Please check your .env file.');
  }
  
  // Construct the full API URL with the model and API key
  const fullApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`;
  
  try {
    // Convert messages to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    
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