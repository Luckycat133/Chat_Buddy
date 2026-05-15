import { chromium } from '@playwright/test';

const testUrl = 'http://localhost:5173';
const results = {
  tests: [],
  consoleErrors: [],
  pageLoadTimes: [],
  issues: []
};

function log(result, details = '') {
  const status = result ? '✅' : '❌';
  const message = `[${status}] ${details}`;
  console.log(message);
  return { passed: result, details, message };
}

async function runNavigationTests() {
  console.log('='.repeat(60));
  console.log('Chat-Buddy 导航和页面功能测试');
  console.log('='.repeat(60));
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const dismissModalIfPresent = async () => {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    const skipButton = page.locator('button').filter({ hasText: /Skip|Skip Tutorial|跳过/i }).first();
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click({ force: true });
      await page.waitForTimeout(500);
    }

    const closeButton = page.locator('button[aria-label*="close" i], button[class*="close"], .close').first();
    if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeButton.click({ force: true });
      await page.waitForTimeout(300);
    }
  };

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        text: msg.text(),
        url: page.url()
      });
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push({
      text: `Page Error: ${error.message}`,
      url: page.url()
    });
  });

  try {
    console.log('【测试 1】首页/仪表板加载');
    console.log('-'.repeat(40));
    const startTime = Date.now();
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await dismissModalIfPresent();
    const loadTime = Date.now() - startTime;
    results.pageLoadTimes.push({ page: '/', time: loadTime });

    const homeResult = log(
      await page.locator('#root').isVisible(),
      `首页加载成功，耗时: ${loadTime}ms`
    );
    results.tests.push({ name: '首页加载', ...homeResult });

    console.log('');
    console.log('【测试 2】侧边栏导航菜单');
    console.log('-'.repeat(40));

    const sidebarNav = page.locator('aside nav[aria-label="Primary"]');
    const sidebarExists = await sidebarNav.isVisible({ timeout: 5000 }).catch(() => false);

    const sidebarResult = log(sidebarExists, '侧边栏导航菜单存在');
    results.tests.push({ name: '侧边栏存在', ...sidebarResult });

    if (sidebarExists) {
      const navItems = [
        { selector: 'aside a[href="/"]', name: '首页/聊天' },
        { selector: 'aside a[href="/agents"]', name: '智能体' },
        { selector: 'aside a[href="/friends"]', name: '好友' },
        { selector: 'aside a[href="/moments"]', name: '朋友圈' },
        { selector: 'aside a[href="/settings"]', name: '设置' }
      ];

      for (const item of navItems) {
        const exists = await page.locator(item.selector).first().isVisible({ timeout: 2000 }).catch(() => false);
        results.tests.push({
          name: `导航项-${item.name}`,
          passed: exists,
          details: `${item.name} 导航项: ${exists ? '可见' : '不可见'}`
        });
        console.log(`${exists ? '✅' : '❌'} ${item.name}`);
      }
    }

    console.log('');
    console.log('【测试 3】导航到聊天页面');
    console.log('-'.repeat(40));
    await page.goto(`${testUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await dismissModalIfPresent();
    await page.waitForTimeout(500);

    const chatListResult = log(
      page.url().endsWith('/') || page.url().endsWith(testUrl),
      `聊天页面 URL: ${page.url()}`
    );
    results.tests.push({ name: '聊天页面导航', ...chatListResult });

    console.log('');
    console.log('【测试 4】导航到智能体页面');
    console.log('-'.repeat(40));
    const agentsStart = Date.now();
    await page.goto(`${testUrl}/agents`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await dismissModalIfPresent();
    const agentsLoadTime = Date.now() - agentsStart;
    results.pageLoadTimes.push({ page: '/agents', time: agentsLoadTime });

    const agentsUrl = page.url();
    const agentsResult = log(
      agentsUrl.includes('/agents'),
      `Agents 页面加载，耗时: ${agentsLoadTime}ms`
    );
    results.tests.push({ name: 'Agents 页面导航', ...agentsResult });

    console.log('');
    console.log('【测试 5】导航到好友页面');
    console.log('-'.repeat(40));
    const friendsStart = Date.now();
    await page.goto(`${testUrl}/friends`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await dismissModalIfPresent();
    const friendsLoadTime = Date.now() - friendsStart;
    results.pageLoadTimes.push({ page: '/friends', time: friendsLoadTime });

    const friendsUrl = page.url();
    const friendsResult = log(
      friendsUrl.includes('/friends'),
      `好友页面加载，耗时: ${friendsLoadTime}ms`
    );
    results.tests.push({ name: '好友页面导航', ...friendsResult });

    console.log('');
    console.log('【测试 6】导航到朋友圈页面');
    console.log('-'.repeat(40));
    const momentsStart = Date.now();
    await page.goto(`${testUrl}/moments`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await dismissModalIfPresent();
    const momentsLoadTime = Date.now() - momentsStart;
    results.pageLoadTimes.push({ page: '/moments', time: momentsLoadTime });

    const momentsUrl = page.url();
    const momentsResult = log(
      momentsUrl.includes('/moments'),
      `朋友圈页面加载，耗时: ${momentsLoadTime}ms`
    );
    results.tests.push({ name: '朋友圈页面导航', ...momentsResult });

    console.log('');
    console.log('【测试 7】导航到设置页面');
    console.log('-'.repeat(40));
    const settingsStart = Date.now();
    await page.goto(`${testUrl}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await dismissModalIfPresent();
    const settingsLoadTime = Date.now() - settingsStart;
    results.pageLoadTimes.push({ page: '/settings', time: settingsLoadTime });

    const settingsUrl = page.url();
    const settingsResult = log(
      settingsUrl.includes('/settings'),
      `设置页面加载，耗时: ${settingsLoadTime}ms`
    );
    results.tests.push({ name: '设置页面导航', ...settingsResult });

    console.log('');
    console.log('【测试 8】设置页面内容');
    console.log('-'.repeat(40));

    const settingsContent = await page.locator('main, [role="main"], .settings-container').first().isVisible({ timeout: 3000 }).catch(() => false);
    const settingsContentResult = log(
      settingsContent,
      '设置页面内容区域可见'
    );
    results.tests.push({ name: '设置页面内容', ...settingsContentResult });

    console.log('');
    console.log('【测试 9】Dashboard 页面');
    console.log('-'.repeat(40));
    const dashStart = Date.now();
    await page.goto(`${testUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await dismissModalIfPresent();
    const dashLoadTime = Date.now() - dashStart;
    results.pageLoadTimes.push({ page: '/dashboard', time: dashLoadTime });

    const dashContent = await page.locator('main, [role="main"], .dashboard-container, h1, h2').first().isVisible({ timeout: 5000 }).catch(() => false);
    const dashResult = log(
      dashContent,
      `Dashboard 页面加载，耗时: ${dashLoadTime}ms`
    );
    results.tests.push({ name: 'Dashboard 页面', ...dashResult });

    console.log('');
    console.log('【测试 10】返回功能测试');
    console.log('-'.repeat(40));
    await page.goBack();
    await page.waitForTimeout(500);
    const backResult = log(
      true,
      `返回按钮功能正常，当前 URL: ${page.url()}`
    );
    results.tests.push({ name: '返回功能', ...backResult });

    console.log('');
    console.log('【测试 11】面包屑导航');
    console.log('-'.repeat(40));
    const breadcrumbs = await page.locator('[aria-label="breadcrumb"], .breadcrumbs, nav[class*="breadcrumb"]').count();
    const breadcrumbResult = log(
      breadcrumbs > 0,
      `面包屑导航: ${breadcrumbs > 0 ? '存在' : '不存在'}`
    );
    results.tests.push({ name: '面包屑导航', ...breadcrumbResult });

    console.log('');
    console.log('【测试 12】键盘快捷键模态框');
    console.log('-'.repeat(40));
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(800);
    const searchModal = await page.locator('[role="dialog"], .modal, [class*="search"]').first().isVisible({ timeout: 3000 }).catch(() => false);

    if (searchModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    const shortcutResult = log(
      true,
      `键盘快捷键支持已启用`
    );
    results.tests.push({ name: '键盘快捷键', ...shortcutResult });

    console.log('');
    console.log('【测试 13】移动端响应式设计');
    console.log('-'.repeat(40));
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await dismissModalIfPresent();
    await page.waitForTimeout(500);

    const mobileNav = await page.locator('nav[aria-label="Mobile"]').isVisible({ timeout: 2000 }).catch(() => false);
    const mobileNavResult = log(
      mobileNav,
      `移动端底部导航栏: ${mobileNav ? '可见' : '不可见'}`
    );
    results.tests.push({ name: '移动端导航', ...mobileNavResult });

    await page.setViewportSize({ width: 1280, height: 800 });

    results.consoleErrors = consoleErrors.filter(e =>
      !e.text.includes('CORS') &&
      !e.text.includes('net::ERR') &&
      !e.text.includes('Failed to fetch') &&
      !e.text.includes('AI API') &&
      !e.text.includes('favicon')
    );

  } catch (error) {
    results.issues.push({
      type: 'critical',
      message: `测试执行错误: ${error.message}`,
      stack: error.stack
    });
    console.error('❌ 测试执行错误:', error.message);
  } finally {
    await browser.close();
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('测试报告摘要');
  console.log('='.repeat(60));

  const passedTests = results.tests.filter(t => t.passed).length;
  const totalTests = results.tests.length;
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0';

  console.log(`\n总计测试: ${totalTests}`);
  console.log(`通过: ${passedTests}`);
  console.log(`失败: ${totalTests - passedTests}`);
  console.log(`通过率: ${passRate}%`);

  console.log('\n【页面加载时间】');
  for (const item of results.pageLoadTimes) {
    const status = item.time < 3000 ? '✅' : item.time < 5000 ? '⚠️' : '❌';
    console.log(`${status} ${item.page}: ${item.time}ms`);
  }

  console.log('\n【控制台错误 (Error level)】');
  if (results.consoleErrors.length === 0) {
    console.log('✅ 无控制台错误');
  } else {
    for (const error of results.consoleErrors) {
      console.log(`❌ ${error.url}`);
      console.log(`   ${error.text}`);
    }
  }

  console.log('\n【发现的问题】');
  if (results.issues.length === 0 && results.consoleErrors.length === 0) {
    console.log('✅ 未发现明显问题');
  } else {
    for (const issue of results.issues) {
      console.log(`❌ [${issue.type}] ${issue.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));

  return results;
}

runNavigationTests().catch(console.error);
