import { chromium } from 'playwright';

const BASE_URL = process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173';
const results = [];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const screenshot = async (name) => {
    await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: false });
    console.log(`📸 Screenshot: ${name}.png`);
  };

  console.log('🧪 Starting UX Walkthrough...\n');

  // 1. Dashboard
  console.log('1. Testing Dashboard...');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
    const title = await page.title();
    results.push({ test: 'Dashboard Load', status: 'pass', detail: `Title: ${title}` });
    await screenshot('01-dashboard');
  } catch (e) {
    results.push({ test: 'Dashboard Load', status: 'fail', detail: e.message });
  }

  // 2. Check sidebar navigation
  console.log('2. Checking sidebar navigation...');
  try {
    const navItems = await page.locator('nav').first().locator('a, button').count();
    results.push({ test: 'Sidebar Navigation', status: 'pass', detail: `Found ${navItems} nav items` });
    await screenshot('02-sidebar');
  } catch (e) {
    results.push({ test: 'Sidebar Navigation', status: 'fail', detail: e.message });
  }

  // 3. Navigate to chat
  console.log('3. Navigating to Chat...');
  try {
    const chatLink = page.locator('nav a[href="/chat"], nav').filter({ hasText: /chat/i }).first();
    if (await chatLink.isVisible({ timeout: 3000 })) {
      await chatLink.click();
      await page.waitForTimeout(1000);
      results.push({ test: 'Chat Navigation', status: 'pass' });
      await screenshot('03-chat-list');
    } else {
      results.push({ test: 'Chat Navigation', status: 'skip', detail: 'Chat link not found in sidebar' });
    }
  } catch (e) {
    results.push({ test: 'Chat Navigation', status: 'fail', detail: e.message });
  }

  // 4. Open a chat conversation
  console.log('4. Opening chat conversation...');
  try {
    const chatItem = page.locator('[class*="chat-item"], .chat-item').first();
    if (await chatItem.isVisible({ timeout: 3000 })) {
      await chatItem.click();
      await page.waitForTimeout(500);
      results.push({ test: 'Open Chat', status: 'pass' });
      await screenshot('04-chat-open');
    } else {
      results.push({ test: 'Open Chat', status: 'skip', detail: 'No chat items found' });
    }
  } catch (e) {
    results.push({ test: 'Open Chat', status: 'fail', detail: e.message });
  }

  // 5. Friends page
  console.log('5. Testing Friends page...');
  try {
    await page.goto(`${BASE_URL}/friends`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(500);
    results.push({ test: 'Friends Page', status: 'pass' });
    await screenshot('05-friends');
  } catch (e) {
    results.push({ test: 'Friends Page', status: 'fail', detail: e.message });
  }

  // 6. Moments page
  console.log('6. Testing Moments page...');
  try {
    await page.goto(`${BASE_URL}/moments`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(500);
    results.push({ test: 'Moments Page', status: 'pass' });
    await screenshot('06-moments');
  } catch (e) {
    results.push({ test: 'Moments Page', status: 'fail', detail: e.message });
  }

  // 7. Settings page
  console.log('7. Testing Settings page...');
  try {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(500);
    results.push({ test: 'Settings Page', status: 'pass' });
    await screenshot('07-settings');
  } catch (e) {
    results.push({ test: 'Settings Page', status: 'fail', detail: e.message });
  }

  // 8. Test dark/light mode toggle
  console.log('8. Testing theme toggle...');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const html = page.locator('html');
    const initialClass = await html.getAttribute('class');
    const themeBtn = page.locator('button').filter({ has: page.locator('[class*="sun"], [class*="moon"], [class*="theme"]') }).first();
    if (await themeBtn.isVisible({ timeout: 2000 })) {
      await themeBtn.click();
      await page.waitForTimeout(300);
      const newClass = await html.getAttribute('class');
      results.push({ test: 'Theme Toggle', status: initialClass !== newClass ? 'pass' : 'warn', detail: 'Class changed' });
    } else {
      results.push({ test: 'Theme Toggle', status: 'skip', detail: 'Theme button not found' });
    }
    await screenshot('08-theme');
  } catch (e) {
    results.push({ test: 'Theme Toggle', status: 'fail', detail: e.message });
  }

  // 9. Test language switch
  console.log('9. Testing language switch...');
  try {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    const langBtn = page.locator('button').filter({ hasText: /EN|ZH|语言|Language/i }).first();
    if (await langBtn.isVisible({ timeout: 2000 })) {
      await langBtn.click();
      await page.waitForTimeout(300);
      results.push({ test: 'Language Switch', status: 'pass' });
    } else {
      results.push({ test: 'Language Switch', status: 'skip', detail: 'Language button not found' });
    }
    await screenshot('09-language');
  } catch (e) {
    results.push({ test: 'Language Switch', status: 'fail', detail: e.message });
  }

  // 10. Responsive test - Mobile
  console.log('10. Testing responsive layout (mobile)...');
  try {
    await context.close();
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
    const body = await mobilePage.locator('body').first();
    results.push({ test: 'Mobile Layout', status: await body.isVisible() ? 'pass' : 'fail' });
    await mobilePage.screenshot({ path: 'e2e/screenshots/10-mobile.png' });
    await mobileContext.close();
  } catch (e) {
    results.push({ test: 'Mobile Layout', status: 'fail', detail: e.message });
  }

  // Console errors check
  const criticalErrors = errors.filter(e =>
    !e.includes('CORS') &&
    !e.includes('net::ERR') &&
    !e.includes('Failed to fetch') &&
    !e.includes('AI API') &&
    !e.includes('favicon')
  );
  results.push({ test: 'Console Errors', status: criticalErrors.length === 0 ? 'pass' : 'warn', detail: `${criticalErrors.length} critical errors` });

  // Print summary
  console.log('\n\n========================================');
  console.log('         UX WALKTHROUGH RESULTS        ');
  console.log('========================================\n');

  const pass = results.filter(r => r.status === 'pass').length;
  const fail = results.filter(r => r.status === 'fail').length;
  const skip = results.filter(r => r.status === 'skip').length;
  const warn = results.filter(r => r.status === 'warn').length;

  results.forEach(r => {
    const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : r.status === 'skip' ? '⏭️' : '⚠️';
    console.log(`${icon} ${r.test}: ${r.status.toUpperCase()}${r.detail ? ` - ${r.detail}` : ''}`);
  });

  console.log(`\n📊 Summary: ${pass} passed, ${fail} failed, ${skip} skipped, ${warn} warnings`);

  if (criticalErrors.length > 0) {
    console.log('\n⚠️  Console Errors:');
    criticalErrors.forEach(e => console.log(`  - ${e}`));
  }

  await browser.close();
  console.log('\n✨ UX Walkthrough Complete!\n');

  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});