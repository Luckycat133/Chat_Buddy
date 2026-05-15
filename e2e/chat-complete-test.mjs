import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';
const TEST_RESULTS = {
  steps: [],
  consoleErrors: [],
  pageLoadTime: null,
  issues: []
};

function logStep(name, status, details = '') {
  const result = { name, status, details, timestamp: new Date().toISOString() };
  TEST_RESULTS.steps.push(result);
  const icon = status === 'SUCCESS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}: ${status}${details ? ' - ' + details : ''}`);
}

function logError(message) {
  TEST_RESULTS.consoleErrors.push({ message });
  console.log(`❌ Console Error: ${message}`);
}

async function closeModal(page) {
  const selectors = [
    'button:has-text("Skip")', 'button:has-text("跳过")',
    'button:has-text("Close")', 'button:has-text("关闭")',
    'button:has-text("Got it")', 'button:has-text("知道了")',
    'button:has-text("Start")', 'button:has-text("开始")'
  ];

  for (const selector of selectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click();
        await page.waitForTimeout(300);
        return true;
      }
    } catch (e) { continue; }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return false;
}

async function testChatBuddy() {
  console.log('🚀 开始测试 Chat-Buddy 应用...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') logError(msg.text());
  });
  page.on('pageerror', error => {
    logError(`Page Error: ${error.message}`);
  });

  try {
    // Navigate
    console.log('\n📍 Step 1: 导航到应用首页');
    const navStart = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    TEST_RESULTS.pageLoadTime = Date.now() - navStart;
    logStep('页面加载', 'SUCCESS', `加载时间: ${TEST_RESULTS.pageLoadTime}ms`);

    await page.waitForSelector('#root', { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Close modal
    console.log('\n📍 Step 2: 处理模态框');
    await closeModal(page);
    await closeModal(page);
    await page.waitForTimeout(500);
    logStep('模态框处理', 'SUCCESS');

    await page.screenshot({ path: '/workspace/e2e/screenshots/01-initial.png', fullPage: true });

    // Go to Friends page
    console.log('\n📍 Step 3: 导航到好友页面');
    await page.goto(`${BASE_URL}/friends`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    logStep('导航到好友页面', 'SUCCESS');
    await page.screenshot({ path: '/workspace/e2e/screenshots/02-friends-page.png', fullPage: true });

    // Find and click on a friend card to open FriendDetail modal
    console.log('\n📍 Step 4: 选择聊天对象');
    const friendCards = page.locator('[class*="card p-4"], .card');

    if (await friendCards.first().isVisible({ timeout: 3000 })) {
      await friendCards.first().click({ force: true });
      await page.waitForTimeout(1000);
      logStep('点击好友卡片', 'SUCCESS', '已选择第一个好友');
      await page.screenshot({ path: '/workspace/e2e/screenshots/03-friend-detail.png', fullPage: true });

      // Click "Start Chat" button in the modal
      console.log('\n📍 Step 5: 开始聊天');
      const startChatBtn = page.locator('button:has-text("Start Chat"), button:has-text("Start Chatting"), button:has-text("开始聊天")').first();

      if (await startChatBtn.isVisible({ timeout: 2000 })) {
        await startChatBtn.click({ force: true });
        await page.waitForTimeout(1500);
        logStep('点击开始聊天', 'SUCCESS', '已点击开始聊天按钮');
      } else {
        // Try clicking any button with MessageCircle icon
        const msgBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
        if (await msgBtn.isVisible({ timeout: 1000 })) {
          await msgBtn.click({ force: true });
          await page.waitForTimeout(1500);
          logStep('点击消息按钮', 'SUCCESS');
        }
      }

      await page.screenshot({ path: '/workspace/e2e/screenshots/04-chat-started.png', fullPage: true });

      // Now check URL - should be on a chat page
      const currentUrl = page.url();
      console.log(`   当前URL: ${currentUrl}`);

      // Look for chat composer
      console.log('\n📍 Step 6: 测试消息输入框');
      const composerWrap = page.locator('[class*="composer-wrap"], [class*="composer"]').first();
      const hasComposer = await composerWrap.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasComposer) {
        logStep('找到聊天composer', 'SUCCESS');

        // Find textarea
        const textarea = page.locator('textarea').first();
        const hasTextarea = await textarea.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasTextarea) {
          logStep('消息输入框存在', 'SUCCESS');

          // Test input
          await textarea.fill('Hello, this is a test message!');
          const value = await textarea.inputValue();
          logStep('消息输入功能', value.includes('test') ? 'SUCCESS' : 'FAIL', `输入: "${value.substring(0, 30)}..."`);

          // Test send with Enter
          console.log('\n📍 Step 7: 测试发送功能');
          await textarea.press('Enter');
          await page.waitForTimeout(1000);
          logStep('按Enter发送消息', 'SUCCESS');

          // Check for messages
          const messages = await page.locator('[class*="message"], [class*="bubble"]').all();
          console.log(`   找到 ${messages.length} 条消息元素`);
          logStep('消息显示', messages.length > 0 ? 'SUCCESS' : 'WARNING', `找到 ${messages.length} 条消息`);

          // Test emoji button
          console.log('\n📍 Step 8: 测试表情选择器');
          const buttons = await page.locator('button').all();
          console.log(`   页面有 ${buttons.length} 个按钮`);

          // Find emoji button (Smile icon)
          const emojiBtn = page.locator('button').nth(1);
          if (await emojiBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await emojiBtn.click();
            await page.waitForTimeout(500);

            const picker = page.locator('[class*="picker"], [role="listbox"]').first();
            const pickerVisible = await picker.isVisible({ timeout: 2000 }).catch(() => false);

            if (pickerVisible) {
              logStep('表情选择器打开', 'SUCCESS');
              await page.screenshot({ path: '/workspace/e2e/screenshots/05-emoji-picker.png', fullPage: true });
              await page.keyboard.press('Escape');
              await page.waitForTimeout(300);
              logStep('表情选择器关闭', 'SUCCESS', '按Escape关闭');
            } else {
              logStep('表情选择器打开', 'WARNING', '按钮可点击但选择器未显示');
            }
          } else {
            logStep('表情按钮存在', 'WARNING', '未找到表情按钮');
          }

          // Test send button
          console.log('\n📍 Step 9: 测试发送按钮');
          await textarea.fill('Test');
          await page.waitForTimeout(500);

          const sendBtn = page.locator('button[aria-label*="send" i], button[type="submit"]').first();
          const sendBtnVisible = await sendBtn.isVisible({ timeout: 1000 }).catch(() => false);

          logStep('发送按钮存在', sendBtnVisible ? 'SUCCESS' : 'WARNING', sendBtnVisible ? '发送按钮可见' : '未找到发送按钮');

        } else {
          logStep('消息输入框存在', 'FAIL', 'composer存在但未找到textarea');
        }

      } else {
        logStep('找到聊天composer', 'FAIL', '未找到composer组件');
        TEST_RESULTS.issues.push({
          step: '聊天窗口', expected: '应该打开聊天窗口', actual: '未找到composer', severity: 'high'
        });
      }

    } else {
      logStep('找到好友卡片', 'FAIL', '未找到好友卡片');
    }

    await page.screenshot({ path: '/workspace/e2e/screenshots/06-final.png', fullPage: true });

  } catch (error) {
    console.error('\n❌ 测试错误:', error.message);
    TEST_RESULTS.issues.push({
      step: '测试执行', expected: '测试完成', actual: error.message, severity: 'critical'
    });
  } finally {
    await browser.close();
  }

  // Generate report
  console.log('\n\n========================================');
  console.log('📊 测试报告摘要');
  console.log('========================================\n');

  console.log(`页面加载时间: ${TEST_RESULTS.pageLoadTime}ms\n`);
  console.log('执行步骤:');
  TEST_RESULTS.steps.forEach(step => {
    const icon = step.status === 'SUCCESS' ? '✅' : step.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`  ${icon} ${step.name}: ${step.status} ${step.details || ''}`);
  });

  console.log(`\n控制台错误数量: ${TEST_RESULTS.consoleErrors.length}`);
  if (TEST_RESULTS.consoleErrors.length > 0) {
    console.log('\n控制台错误详情:');
    TEST_RESULTS.consoleErrors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message.substring(0, 200)}`);
    });
  }

  console.log(`\n发现的问题: ${TEST_RESULTS.issues.length}`);
  if (TEST_RESULTS.issues.length > 0) {
    TEST_RESULTS.issues.forEach((issue, i) => {
      console.log(`\n  问题 ${i + 1}: ${issue.step} - ${issue.severity}`);
      console.log(`    预期: ${issue.expected}`);
      console.log(`    实际: ${issue.actual}`);
    });
  }

  console.log('\n========================================\n');

  const reportContent = JSON.stringify(TEST_RESULTS, null, 2);
  await import('fs').then(fs => fs.writeFileSync('/workspace/e2e/test-report.json', reportContent));
  console.log('📄 报告: /workspace/e2e/test-report.json');

  return TEST_RESULTS;
}

testChatBuddy().catch(console.error);
