import { createLogger } from '../utils/logger';

const log = createLogger('inputValidator');

const MAX_TEXT_LENGTH = 50000;
const SCRIPT_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_PATTERN = /\bon\w+\s*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_URL_PATTERN = /javascript\s*:/gi;
const DATA_URL_PATTERN = /data\s*:/gi;

const ALLOWED_TAGS = new Set([
  'b', 'i', 'em', 'strong', 'code', 'pre', 'p', 'br',
  'ul', 'ol', 'li', 'a', 'blockquote', 'h1', 'h2', 'h3',
  'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return String(str).replace(/[&<>"']/g, c => map[c] || c);
}

function stripScripts(str) {
  return String(str)
    .replace(SCRIPT_PATTERN, '')
    .replace(EVENT_HANDLER_PATTERN, '')
    .replace(JAVASCRIPT_URL_PATTERN, 'blocked:')
    .replace(DATA_URL_PATTERN, 'blocked:');
}

export function sanitizeInput(input, options = {}) {
  if (input === null || input === undefined) return '';

  const { maxLength = MAX_TEXT_LENGTH, stripHtml = true } = options;

  if (typeof input !== 'string') {
    input = String(input);
  }

  if (input.length > maxLength) {
    log.warn('Input exceeds max length', { length: input.length, max: maxLength });
    input = input.slice(0, maxLength);
  }

  input = stripScripts(input);

  if (stripHtml) {
    input = escapeHtml(input);
  }

  return input.trim();
}

export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return EMAIL_RE.test(email.trim()) && email.length <= 254;
}

export function validateUsername(name) {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 32 && /^[\w\u4e00-\u9fff\s-]+$/.test(trimmed);
}

export function validateChatName(name) {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
}

export function sanitizeHtmlLight(html) {
  return String(html)
    .replace(SCRIPT_PATTERN, '')
    .replace(EVENT_HANDLER_PATTERN, '');
}

export function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function sanitizeQueryParam(value) {
  return sanitizeInput(value, { maxLength: 500, stripHtml: true });
}

export function rateLimitTracker({ maxCalls = 20, windowMs = 60000 } = {}) {
  const calls = [];

  return {
    check() {
      const now = Date.now();
      while (calls.length && calls[0] <= now - windowMs) {
        calls.shift();
      }
      if (calls.length >= maxCalls) {
        log.warn('Rate limit exceeded', { calls: calls.length, max: maxCalls });
        return false;
      }
      calls.push(now);
      return true;
    },
    remaining() {
      const now = Date.now();
      while (calls.length && calls[0] <= now - windowMs) {
        calls.shift();
      }
      return Math.max(0, maxCalls - calls.length);
    },
    reset() {
      calls.length = 0;
    },
  };
}
