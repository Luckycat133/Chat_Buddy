const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('server documentation uses DELETE for reset endpoint', () => {
  const serverPath = path.join(__dirname, '../../backend/server.js');
  const content = fs.readFileSync(serverPath, 'utf8');
  assert.ok(
    content.includes("'DELETE /api/reset/:userId': 'Reset conversation history for a user'"),
    'API docs should mention DELETE /api/reset/:userId'
  );
});

