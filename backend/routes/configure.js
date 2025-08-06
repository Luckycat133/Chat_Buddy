const express = require('express');
const router = express.Router();

// Configure API settings endpoint
router.post('/', (req, res) => {
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
    
    // Store settings
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