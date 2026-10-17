import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import './networkSetup.js';

// 扩展expect匹配器
expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};

  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

globalThis.localStorage = localStorageMock;

// JSDOM does not implement layout/scroll APIs used by the message timeline.
Object.defineProperty(globalThis.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  writable: true,
  value: vi.fn()
});

// Mock环境变量
vi.stubEnv('VITE_AI_API_URL', 'https://api.test.com');
vi.stubEnv('VITE_AI_API_KEY', 'test-key-123');
vi.stubEnv('VITE_AI_MODEL', 'test-model');
