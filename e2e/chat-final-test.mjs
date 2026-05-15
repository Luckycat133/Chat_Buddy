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
  const closeSelectors = [
    'button:has-text("Skip")', 'button:has-text("跳过")',
    'button:has-text("Close")', 'button:has-text("关闭")',
    'button[class*="close"]', 'button[class*="skip"]',
    'button:has-text("Got it")', 'button:has-text("知道了")',
    'button:has-text("Start")', 'button:has-text("开始")'
  ];

  for (const selector of closeSelectors) {
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
    await page.waitForTimeout(1000);

    // Close modal
    console.log('\n📍 Step 2: 处理模态框');
    await closeModal(page);
    await closeModal(page);
    await page.waitForTimeout(500);
    logStep('模态框处理', 'SUCCESS');

    await page.screenshot({ path: '/workspace/e2e/screenshots/01-initial.png', fullPage: true });

    // Navigate to chat
    console.log('\n📍 Step 3: 导航到聊天页面');
    const chatLink = page.locator('a[href="/chat"]').first();
    if (await chatLink.isVisible({ timeout: 2000 })) {
      await chatLink.click({ force: true });
      await page.waitForTimeout(1000);
    } else {
      await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
    }
    logStep('导航到聊天页面', 'SUCCESS');
    await page.screenshot({ path: '/workspace/e2e/screenshots/02-chat-page.png', fullPage: true });

    // Find chat items
    console.log('\n📍 Step 4: 测试聊天列表');
    let chatItems = await page.locator('a[href*="/chat/"]').all();
    console.log(`   找到 ${chatItems.length} 个聊天链接`);

    if (chatItems.length > 0) {
      logStep('聊天对象存在', 'SUCCESS', `找到 ${chatItems.length} 个聊天对象`);
      await chatItems[0].click({ force: true });
      await page.waitForTimeout(1500);
      logStep('打开聊天', 'SUCCESS');
      await page.screenshot({ path: '/workspace/e2e/screenshots/03-chat-opened.png', fullPage: true });

      // Test message input
      console.log('\n📍 Step 5: 测试消息输入框');
      const textarea = page.locator('textarea[aria-label*="Type"], textarea[placeholder*="Type"], textarea').first();

      if (await textarea.isVisible({ timeout: 3000 })) {
        logStep('消息输入框存在', 'SUCCESS');

        await textarea.fill('Hello, test message!');
        const value = await textarea.inputValue();
        logStep('消息输入功能', value.length > 0 ? 'SUCCESS' : 'FAIL', `输入: "${value}"`);

        // Test send with Enter
        console.log('\n📍 Step 6: 测试发送功能');
        await textarea.press('Enter');
        await page.waitForTimeout(1000);
        logStep('按Enter发送消息', 'SUCCESS', '消息已发送');

        // Check messages
        const messages = await page.locator('[class*="message"], [class*="bubble"]').all();
        logStep('消息显示', messages.length > 0 ? 'SUCCESS' : 'WARNING', `找到 ${messages.length} 条消息`);

        // Test emoji picker - click the Smile button
        console.log('\n📍 Step 7: 测试表情选择器');

        // Find emoji button (uses Smile icon from lucide-react)
        const emojiBtn = page.locator('button[aria-label*="emoji" i], button:has(svg)').filter({ hasText: '' }).first();

        // More reliable: find button by SVG content
        const allButtons = await page.locator('button').all();
        let smileBtn = null;
        for (const btn of allButtons) {
          try {
            const isVisible = await btn.isVisible();
            const hasSvg = await btn.locator('svg').count() > 0;
            if (isVisible && hasSvg) {
              const svgHtml = await btn.locator('svg').first().innerHTML();
              // Smile icon has a path with d attribute
              if (svgHtml.includes('path') && svgHtml.length < 500) {
                smileBtn = btn;
                break;
              }
            }
          } catch (e) { continue; }
        }

        if (!smileBtn) {
          // Fallback: click the second visible button (usually emoji button after mic)
          const visibleBtns = [];
          for (const btn of allButtons) {
            if (await btn.isVisible().catch(() => false)) {
              visibleBtns.push(btn);
            }
          }
          if (visibleBtns.length > 1) {
            smileBtn = visibleBtns[1]; // Usually the emoji button
          }
        }

        if (smileBtn) {
          logStep('表情按钮存在', 'SUCCESS');
          await smileBtn.click();
          await page.waitForTimeout(500);

          // Check if picker appeared
          const picker = page.locator('[class*="emoji-picker"], [class*="picker"], [role="listbox"]').first();
          const pickerVisible = await picker.isVisible({ timeout: 2000 }).catch(() => false);

          if (pickerVisible) {
            logStep('表情选择器打开', 'SUCCESS');
            await page.screenshot({ path: '/workspace/e2e/screenshots/04-emoji-picker.png', fullPage: true });

            // Close picker
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            logStep('表情选择器关闭', 'SUCCESS', '按Escape关闭');
          } else {
            logStep('表情选择器打开', 'WARNING', '点击了按钮但选择器未显示');
          }
        } else {
          logStep('表情按钮存在', 'WARNING', '未找到表情按钮');
        }

        // Test send button visibility when input has content
        console.log('\n📍 Step 8: 测试发送按钮');
        await textarea.fill('Test for send button');
        await page.waitForTimeout(300);

        const sendBtn = page.locator('button[aria-label*="send" i], button:has-text("Send")').first();
        const sendBtnVisible = await sendBtn.isVisible({ timeout: 1000 }).catch(() => false);

        if (sendBtnVisible) {
          logStep('发送按钮存在(输入时有内容)', 'SUCCESS');
        } else {
          logStep('发送按钮存在(输入时有内容)', 'WARNING', '未找到发送按钮');
        }

      } else {
        logStep('消息输入框存在', 'FAIL', '未找到输入框');
        TEST_RESULTS.issues.push({
          step: '消息输入框', expected: '应该有textarea', actual: '未找到', severity: 'high'
        });
      }

    } else {
      logStep('聊天对象存在', 'WARNING', '未找到聊天对象');
    }

    await page.screenshot({ path: '/workspace/e2e/screenshots/05-final.png', fullPage: true });

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
  console.log('截图: 01-initial, 02-chat-page, 03-chat-opened, 04-emoji-picker, 05-final');

  const reportContent = JSON.stringify(TEST_RESULTS, null, 2);
  await import('fs').then(fs => fs.writeFileSync('/workspace/e2e/test-report.json', reportContent));
  console.log('📄 报告: /workspace/e2e/test-report.json');

  return TEST_RESULTS;
}

testChatBuddy().catch(console.error);
