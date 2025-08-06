const express = require('express');
const router = express.Router();

// Import helper functions
const { setUserConversation, setUserContext } = require('../utils/helpers');

// Import user data endpoint
router.post('/:userId', (req, res) => {
  const { userId } = req.params;
  const { conversation, context } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  try {
    // Validate data
    if (!Array.isArray(conversation)) {
      return res.status(400).json({ error: 'Invalid conversation data' });
    }
    
    if (!context || typeof context !== 'object') {
      return res.status(400).json({ error: 'Invalid context data' });
    }
    
    // Set user data
    setUserConversation(userId, conversation);
    setUserContext(userId, context);
    
    res.json({ message: 'Data imported successfully' });
  } catch (error) {
    console.error('Error in /api/import/:userId:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;