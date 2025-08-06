// Security middleware for input validation and sanitization

const validator = require('validator');

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
  
  // Sanitize and validate custom API URL if present
  if (req.body.settings && req.body.settings.customApiUrl) {
    try {
      // Use validator to check if it's a valid URL
      if (!validator.isURL(req.body.settings.customApiUrl, { 
        protocols: ['https'], 
        require_protocol: true,
        require_tld: true
      })) {
        return res.status(400).json({ error: 'Invalid custom API URL format' });
      }
      
      // Sanitize the URL
      req.body.settings.customApiUrl = validator.escape(req.body.settings.customApiUrl);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid custom API URL' });
    }
  }
  
  next();
};

module.exports = {
  securityMiddleware
};