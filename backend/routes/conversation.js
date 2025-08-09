const express = require('express');
const router = express.Router();

// Import helper functions
const { getUserConversation, setUserConversation } = require('../utils/helpers');

// Get conversation history endpoint
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  try {
    const conversation = getUserConversation(userId);
    res.json({ conversation });
  } catch (error) {
    console.error('Error in /api/conversation/:userId:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

// Delete a message endpoint
router.delete('/:userId/message/:messageId', (req, res) => {
  const { userId, messageId } = req.params;
  
  if (!userId || !messageId) {
    return res.status(400).json({ error: 'Missing userId or messageId' });
  }
  
  try {
    const conversation = getUserConversation(userId);
    
    // Find the message index
    const messageIndex = conversation.findIndex(msg => msg.id == messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Remove the message
    conversation.splice(messageIndex, 1);

    // Persist the updated conversation
    setUserConversation(userId, conversation);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/conversation/:userId/message/:messageId:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

// Edit a message endpoint
router.put('/:userId/message/:messageId', (req, res) => {
  const { userId, messageId } = req.params;
  const { newText } = req.body;
  
  if (!userId || !messageId || !newText) {
    return res.status(400).json({ error: 'Missing userId, messageId, or newText' });
  }
  
  try {
    const conversation = getUserConversation(userId);
    
    // Find the message index
    const messageIndex = conversation.findIndex(msg => msg.id == messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Update the message text
    conversation[messageIndex].text = newText;
    conversation[messageIndex].edited = true; // Mark as edited

    // Persist the updated conversation
    setUserConversation(userId, conversation);

    res.json({ message: 'Message updated successfully', updatedMessage: conversation[messageIndex] });
  } catch (error) {
    console.error('Error in PUT /api/conversation/:userId/message/:messageId:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;