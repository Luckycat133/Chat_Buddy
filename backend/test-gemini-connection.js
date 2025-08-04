require('dotenv').config();
const { default: fetch } = require('node-fetch');

async function testGeminiConnection() {
  const apiKey = process.env.CUSTOM_API_KEY;
  const apiUrl = process.env.CUSTOM_API_URL;
  
  console.log('API Key:', apiKey);
  console.log('API URL:', apiUrl);
  
  if (!apiKey || !apiUrl) {
    console.error('Missing API key or URL');
    return;
  }
  
  const fullUrl = `${apiUrl}?key=${apiKey}`;
  console.log('Full URL:', fullUrl);
  
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Hello, how are you?'
          }
        ]
      }
    ]
  };
  
  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGeminiConnection();