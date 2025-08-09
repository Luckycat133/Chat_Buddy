const test = require('node:test');
const assert = require('node:assert');
const { detectUserLanguage } = require('../../backend/utils/helpers');

test('detectUserLanguage returns zh when message contains Chinese characters', () => {
  assert.strictEqual(detectUserLanguage('你好，世界'), 'zh');
});

test('detectUserLanguage returns en when message is in English', () => {
  assert.strictEqual(detectUserLanguage('Hello world'), 'en');
});
