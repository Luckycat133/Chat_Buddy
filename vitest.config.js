import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['/src/test/setupTests.js'],
    include: ['src/**/*.spec.{js,jsx}'],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/core/chat/ChatEngine.js',
        'src/core/chat/AIPipeline.js',
        'src/features/chat/services/chatService.js',
        'src/features/chat/components/window/MessageTimeline.jsx',
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
