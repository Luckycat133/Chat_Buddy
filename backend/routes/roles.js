const express = require('express');
const router = express.Router();
const { listRoles } = require('../utils/helpers');

router.get('/', (req, res) => {
  try {
    const roles = listRoles();
    res.json({ roles });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load roles' });
  }
});

module.exports = router;
