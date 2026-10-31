import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './msw/server.js';

// Shared by browser and Node tests: never send unmocked network requests.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
