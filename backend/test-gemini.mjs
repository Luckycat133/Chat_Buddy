import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config();

const apiKey = process.env.CUSTOM_API_KEY;
const apiUrl = process.env.CUSTOM_API_URL;

console.log('Testing Gemini API connection...');
console.log('API Key:', apiKey);
console.log('API URL:', apiUrl);

fetch(`${apiUrl}?key=${apiKey}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    contents: [{
      parts: [{ text: 'Hello, how are you?' }]
    }]
  })
})
.then(response => {
  console.log('Response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Response:', JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('Error:', error);
});