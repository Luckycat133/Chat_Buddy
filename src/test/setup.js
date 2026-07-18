import { expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { server } from './msw/server';

// 扩展expect匹配器
expect.extend(matchers);

// Keep all network behavior deterministic and reset per-test handlers.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

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
  value: vi.fn()
});

// Mock环境变量
vi.stubEnv('VITE_AI_API_URL', 'https://api.test.com');
vi.stubEnv('VITE_AI_API_KEY', 'test-key-123');
vi.stubEnv('VITE_AI_MODEL', 'test-model');
