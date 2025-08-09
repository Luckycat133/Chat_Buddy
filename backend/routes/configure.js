const express = require('express');
const router = express.Router();

// Import middleware
const { securityMiddleware } = require('../middleware/security');
// Import helper functions
const { validateApiUrl, sanitizeUrl } = require('../utils/helpers');

// Configure API settings endpoint
router.post('/', securityMiddleware, (req, res) => {
  const { userId, settings } = req.body;
  
  if (!userId || !settings) {
    return res.status(400).json({ error: 'Missing userId or settings' });
  }
  
  try {
    // Validate custom API URL if provided
    if (settings.customApiUrl) {
      if (!validateApiUrl(settings.customApiUrl)) {
        return res.status(400).json({ 
          error: 'Invalid custom API URL. Must be a valid HTTPS URL.',
          errorCode: 'INVALID_URL'
        });
      }
      
      // Sanitize the URL
      settings.customApiUrl = sanitizeUrl(settings.customApiUrl);
    }
    
    // Validate custom API key if provided (basic validation only)
    if (settings.customApiKey) {
      // Remove any whitespace
      settings.customApiKey = settings.customApiKey.trim();
      
      // Check if API key is empty after trimming
      if (settings.customApiKey.length === 0) {
        return res.status(400).json({ 
          error: 'Custom API key cannot be empty.',
          errorCode: 'INVALID_API_KEY'
        });
      }
      
      // Basic length check (most API keys are longer than 10 characters)
      if (settings.customApiKey.length < 10) {
        return res.status(400).json({ 
          error: 'Custom API key seems too short.',
          errorCode: 'INVALID_API_KEY'
        });
      }
    }
    
    // Store settings
    const userSettings = req.app.get('userSettings');
    userSettings[userId] = settings;
    
    res.json({ message: 'Settings configured successfully' });
  } catch (error) {
    console.error('Error in /api/configure:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;