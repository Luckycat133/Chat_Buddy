import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // PGlite initializes a second WASM Postgres instance for initdb. CPU-count
    // parallelism can exhaust memory before hooks finish on shared/CI runners.
    // Bound the pool without changing test/hook deadlines or in-test concurrency.
    maxWorkers: 2,
    // Pin the cloud flag off so unit tests never require a live server;
    // cloud-path specs mock the adapter instead.
    env: {
      VITE_USE_CLOUD: 'false',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.js'],
          include: ['src/**/*.{test,spec}.{js,jsx}', 'src/**/*.{test,spec}.ts'],
          exclude: ['node_modules', 'dist', 'public', 'src/test/integration/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          // Keep the same network guard, without loading React or browser mocks.
          setupFiles: ['./src/test/networkSetup.js'],
          include: ['server/**/*.{test,spec}.ts', 'shared/**/*.{test,spec}.ts'],
          exclude: ['node_modules', 'dist', 'public'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: 'test_reports/coverage',
      include: [
        // Existing critical paths.
        'src/config/apiConfig.js',
        'src/core/chat/AIPipeline.js',
        'src/core/chat/ChatEngine.js',
        'src/core/chat/ChatNormalizer.js',
        'src/core/chat/ChatPollManager.js',
        'src/features/chat/components/MermaidRenderer.jsx',
        'src/features/chat/components/window/MessageTimeline.jsx',
        'src/features/chat/services/chatService.js',
        'src/features/chat/services/toolAuthorization.js',
        'src/utils/formatTime.js',
        'src/utils/logger.js',
        'src/utils/inputValidator.js',
        'src/utils/ragUtils.js',
        'src/utils/sanitizeUtils.js',
        // New cloud runtime.
        'shared/**/*.ts',
        'server/**/*.ts',
        'db/**/*.ts',
      ],
      exclude: [
        'src/data/**',
        'src/test/**',
        'src/main.jsx',
        'src/utils/cn.js',
        'src/**/*.test.{js,jsx}',
        'src/**/*.spec.{js,jsx}',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        '**/migrate.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@server': fileURLToPath(new URL('./server', import.meta.url)),
      '@db': fileURLToPath(new URL('./db', import.meta.url)),
    },
  },
});
