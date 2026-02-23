import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: vi.fn(() => 'uuid-fixed'),
    },
    configurable: true,
  });
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

afterAll(() => {
  server.close();
});
