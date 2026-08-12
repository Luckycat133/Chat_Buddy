import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules', 'dist', 'public'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: 'test_reports/coverage',
      // Enforce the unit-coverage gate on regression-critical logic. Rendering,
      // routing and responsive UX are covered separately by Playwright + Axe.
      include: [
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
      ],
      exclude: [
        'src/data/**',           // 静态数据
        'src/test/**',           // 测试工具
        'src/main.jsx',          // React入口
        'src/utils/cn.js',       // 简单封装
        'src/**/*.test.{js,jsx}' // 测试文件本身
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
