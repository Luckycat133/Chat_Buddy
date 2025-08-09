const express = require('express');
const router = express.Router();
const { getUserMemories, updateUserMemory, deleteUserMemory } = require('../utils/memory');

router.get('/:userId/:role', (req, res) => {
  const { userId, role } = req.params;
  try {
    const memories = getUserMemories(userId, role);
    res.json({ memories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get memories' });
  }
});

router.put('/:userId/:role/:memoryId', (req, res) => {
  const { userId, role, memoryId } = req.params;
  const { text } = req.body;
  const memory = updateUserMemory(userId, role, memoryId, text);
  if (!memory) {
    return res.status(404).json({ error: 'Memory not found' });
  }
  res.json({ memory });
});

router.delete('/:userId/:role/:memoryId', (req, res) => {
  const { userId, role, memoryId } = req.params;
  const ok = deleteUserMemory(userId, role, memoryId);
  if (!ok) {
    return res.status(404).json({ error: 'Memory not found' });
  }
  res.json({ success: true });
});

module.exports = router;
