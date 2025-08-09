const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
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

// Security middleware for input validation and sanitization
const securityMiddleware = (req, res, next) => {
  // Sanitize and validate userId
  if (req.body.userId) {
    // Remove any potentially dangerous characters
    req.body.userId = req.body.userId.replace(/[^a-zA-Z0-9-_]/g, '');
    
    // Check if userId is empty after sanitization
    if (req.body.userId.length === 0) {
      return res.status(400).json({ error: 'Invalid userId format' });
    }
    
    // Limit userId length
    if (req.body.userId.length > 100) {
      return res.status(400).json({ error: 'userId too long' });
    }
  }
  
  // Sanitize and validate message content
  if (req.body.message) {
    // Trim whitespace
    req.body.message = req.body.message.trim();
    
    // Check if message is empty
    if (req.body.message.length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    // Limit message length
    if (req.body.message.length > 10000) {
      return res.status(400).json({ error: 'Message too long (max 10000 characters)' });
    }
    
    // Basic XSS prevention - remove script tags
    req.body.message = req.body.message.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Sanitize HTML
    req.body.message = req.body.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  
  next();
};

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
const rolesRouter = require('./routes/roles');
const memoryRouter = require('./routes/memory');

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
      'GET /api/roles': 'List available AI roles',
      'GET /api/memory/:userId/:role': 'Get saved memories for a user and role',
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
app.use('/api/roles', rolesRouter);
app.use('/api/memory', memoryRouter);
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