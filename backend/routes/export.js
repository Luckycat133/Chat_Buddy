const express = require('express');
const router = express.Router();

// Import helper functions
const { getUserConversation, getUserContext } = require('../utils/helpers');

// Export user data endpoint
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  try {
    const conversation = getUserConversation(userId);
    const context = getUserContext(userId);
    
    const exportData = {
      userId,
      conversation,
      context,
      exportDate: new Date().toISOString()
    };
    
    res.json(exportData);
  } catch (error) {
    console.error('Error in /api/export/:userId:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;