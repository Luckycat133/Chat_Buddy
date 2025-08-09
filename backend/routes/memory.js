const express = require('express');
const router = express.Router();
const { listMemories, updateMemory, deleteMemory } = require('../utils/helpers');
const { securityMiddleware } = require('../middleware/security');

router.get('/:userId', securityMiddleware, (req, res) => {
  const memories = listMemories(req.params.userId);
  res.json({ memories });
});

router.put('/:userId/:index', securityMiddleware, (req, res) => {
  const { userId, index } = req.params;
  const { text } = req.body;
  updateMemory(userId, parseInt(index, 10), text || '');
  res.json({ success: true });
});

router.delete('/:userId/:index', securityMiddleware, (req, res) => {
  const { userId, index } = req.params;
  deleteMemory(userId, parseInt(index, 10));
  res.json({ success: true });
});

module.exports = router;
