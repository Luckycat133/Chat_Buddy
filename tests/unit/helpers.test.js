const test = require('node:test');
const assert = require('node:assert');
const {
  detectUserLanguage,
  getUserConversation,
  getUserContext,
  resetUserConversation,
} = require('../../backend/utils/helpers');

test('detectUserLanguage returns zh when message contains Chinese characters', () => {
  assert.strictEqual(detectUserLanguage('你好，世界'), 'zh');
});

test('detectUserLanguage returns en when message is in English', () => {
  assert.strictEqual(detectUserLanguage('Hello world'), 'en');
});

test('resetUserConversation clears stored data for user', () => {
  const userId = 'test-user';
  // Prime conversation and context
  getUserConversation(userId).push({ sender: 'user', text: 'hi' });
  getUserContext(userId).messages.push({ role: 'user', content: 'hi' });

  resetUserConversation(userId);

  assert.deepStrictEqual(getUserConversation(userId), []);
  assert.deepStrictEqual(getUserContext(userId).messages, []);
});
