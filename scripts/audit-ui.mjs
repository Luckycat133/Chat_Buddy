import { chromium } from 'playwright';

(async () => {
  console.log('Starting UI Audit via Playwright...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Mobile Responsiveness (Home)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scripts/mobile_home.png' });
  console.log('Saved mobile_home.png');

  // 2. Mobile Responsiveness (Chat Detail)
  await page.goto('http://localhost:5173/chat/b0f501c9-8a23-4fee-a3f3-f5dad9ed770e');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scripts/mobile_chat.png' });
  console.log('Saved mobile_chat.png');

  // 3. Desktop Dark Mode (Settings)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/settings');
  await page.waitForTimeout(1000);
  // Try to find the dark mode toggle and click it
  // We'll just take a screenshot of settings for now
  await page.screenshot({ path: 'scripts/desktop_settings.png' });
  console.log('Saved desktop_settings.png');

  await browser.close();
  console.log('Audit screenshots complete.');
})();
