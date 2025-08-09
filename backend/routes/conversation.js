const express = require('express');
const router = express.Router();

// Import helper functions
const { getUserConversation } = require('../utils/helpers');

// Get conversation history endpoint
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const { role = 'assistant' } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const conversation = getUserConversation(userId, role);
    res.json({ conversation });
  } catch (error) {
    console.error('Error in /api/conversation/:userId:', error);
    res.status(500).json({
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
