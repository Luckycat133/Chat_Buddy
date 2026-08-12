import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

// This report intentionally observes every source module without enforcing a
// misleading global threshold. CI's hard threshold lives in vitest.config.js;
// UI behavior is gated by the Playwright acceptance suite.
const baseCoverage = { ...baseConfig.test.coverage };
delete baseCoverage.thresholds;

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    coverage: {
      ...baseCoverage,
      include: ['src/**/*.{js,jsx}'],
    },
  },
});
