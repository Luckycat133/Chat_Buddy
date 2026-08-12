import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const localChromiumLaunch = !process.env.CI && existsSync(macChromePath)
  ? { launchOptions: { executablePath: macChromePath } }
  : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run sequentially to avoid port conflicts with single preview server
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...localChromiumLaunch },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'safari',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], ...localChromiumLaunch },
    },
  ],
  webServer: process.env.CI
    ? {
        command: 'npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: false,
        timeout: 120 * 1000,
      }
    : {
        command: 'npm run dev -- --host 127.0.0.1',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },
});
