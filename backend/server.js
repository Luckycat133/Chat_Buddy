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

// Make userSettings available to routes
app.set('userSettings', userSettings);

// Import helper functions
const { 
  sanitizeUrl, 
  validateApiUrl, 
  getUserConversation, 
  getUserContext, 
  updateUserContext,
  detectUserLanguage,
  getSystemPrompt
} = require('./utils/helpers');

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