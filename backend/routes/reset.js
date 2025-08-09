const express = require('express');
const router = express.Router();

// Import helper functions
const { resetUserConversation } = require('../utils/helpers');

// Reset conversation endpoint
router.delete('/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  try {
    resetUserConversation(userId);
    res.json({ message: 'Conversation reset successfully' });
  } catch (error) {
    console.error('Error in /api/reset/:userId:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;