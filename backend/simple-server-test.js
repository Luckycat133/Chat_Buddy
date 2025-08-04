const express = require('express');
const app = express();
const PORT = 5001;

app.use(express.json());

app.post('/api/chat', (req, res) => {
  console.log('Received request:', req.body);
  res.json({ message: { role: 'assistant', content: 'Hello from test server!' } });
});

app.listen(PORT, () => {
  console.log(`Test server is running on port ${PORT}`);
});