import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const apiKey = process.env.CUSTOM_API_KEY;
const apiUrl = process.env.CUSTOM_API_URL;

console.log('API Key:', apiKey);
console.log('API URL:', apiUrl);

const testGeminiAPI = async () => {
  try {
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
    
    console.log('Sending request to:', `${apiUrl}?key=${apiKey}`);
    
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testGeminiAPI();