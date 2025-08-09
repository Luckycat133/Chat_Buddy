const express = require('express');
const router = express.Router();
const { getRoleList } = require('../utils/helpers');

router.get('/', (req, res) => {
  res.json({ roles: getRoleList() });
});

module.exports = router;
