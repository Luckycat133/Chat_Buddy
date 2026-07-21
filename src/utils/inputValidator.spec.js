import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  validateEmail,
  validateUsername,
  isValidUrl,
  sanitizeQueryParam,
  rateLimitTracker,
} from './inputValidator';

describe('sanitizeInput', () => {
  it('removes script tags', () => {
    const input = 'Hello<script>alert("xss")</script>World';
    expect(sanitizeInput(input)).not.toContain('<script>');
  });

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('truncates long input', () => {
    const long = 'a'.repeat(60000);
    const result = sanitizeInput(long, { maxLength: 100 });
    expect(result.length).toBe(100);
  });

  it('returns empty string for null/undefined', () => {
    expect(sanitizeInput(null)).toBe('');
    expect(sanitizeInput(undefined)).toBe('');
  });

  it('escapes HTML when stripHtml is true', () => {
    expect(sanitizeInput('<b>bold</b>', { stripHtml: true })).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('strips javascript: URLs', () => {
    expect(sanitizeInput('javascript:alert(1)')).not.toContain('javascript:');
  });

  it('handles non-string input', () => {
    expect(sanitizeInput(12345)).toBe('12345');
  });
});

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user+tag@domain.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('')).toBe(false);
    expect(validateEmail(null)).toBe(false);
  });
});

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('jack')).toBe(true);
    expect(validateUsername('Jack Sparrow')).toBe(true);
    expect(validateUsername('用户')).toBe(true);
  });

  it('rejects invalid usernames', () => {
    expect(validateUsername('a')).toBe(false);
    expect(validateUsername('')).toBe(false);
    expect(validateUsername('<script>')).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('accepts valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('sanitizeQueryParam', () => {
  it('sanitizes query params', () => {
    expect(sanitizeQueryParam('hello')).toBe('hello');
    expect(sanitizeQueryParam('<script>xss</script>')).not.toContain('<script>');
  });
});

describe('rateLimitTracker', () => {
  it('allows calls within limit', () => {
    const tracker = rateLimitTracker({ maxCalls: 5, windowMs: 60000 });
    for (let i = 0; i < 5; i++) {
      expect(tracker.check()).toBe(true);
    }
  });

  it('blocks calls exceeding limit', () => {
    const tracker = rateLimitTracker({ maxCalls: 3, windowMs: 60000 });
    tracker.check();
    tracker.check();
    tracker.check();
    expect(tracker.check()).toBe(false);
  });

  it('reports remaining calls', () => {
    const tracker = rateLimitTracker({ maxCalls: 10, windowMs: 60000 });
    tracker.check();
    tracker.check();
    expect(tracker.remaining()).toBe(8);
  });

  it('resets', () => {
    const tracker = rateLimitTracker({ maxCalls: 5, windowMs: 60000 });
    tracker.check();
    tracker.check();
    tracker.reset();
    expect(tracker.remaining()).toBe(5);
  });
});
