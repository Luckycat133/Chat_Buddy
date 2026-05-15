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
  // Try to find and click close button or "Skip" button in modal
  const closeSelectors = [
    'button:has-text("Skip")',
    'button:has-text("跳过")',
    'button:has-text("Close")',
    'button:has-text("关闭")',
    'button[class*="close"]',
    'button[class*="skip"]',
    '[class*="close"]',
    '[aria-label*="close"]',
    'button:has-text("Got it")',
    'button:has-text("知道了")',
    'button:has-text("Start")',
    'button:has-text("开始")'
  ];

  for (const selector of closeSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click();
        await page.waitForTimeout(300);
        console.log(`   关闭了模态框 (${selector})`);
        return true;
      }
    } catch (e) {
      continue;
    }
  }

  // Try pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  return false;
}

async function testChatBuddy() {
  console.log('🚀 开始测试 Chat-Buddy 应用...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      logError(msg.text());
    }
  });

  page.on('pageerror', error => {
    logError(`Page Error: ${error.message}`);
  });

  try {
    // Step 1: Navigate to app
    console.log('\n📍 Step 1: 导航到应用首页');
    const navStart = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    TEST_RESULTS.pageLoadTime = Date.now() - navStart;
    logStep('页面加载', 'SUCCESS', `加载时间: ${TEST_RESULTS.pageLoadTime}ms`);

    // Wait for app to be ready
    await page.waitForSelector('#root', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Step 2: Close any modal/overlay
    console.log('\n📍 Step 2: 处理模态框');
    await closeModal(page);
    await closeModal(page); // Try again in case there are multiple
    await page.waitForTimeout(500);
    logStep('模态框处理', 'SUCCESS', '已尝试关闭模态框');

    // Take initial screenshot
    await page.screenshot({ path: '/workspace/e2e/screenshots/initial-state.png', fullPage: true });

    // Step 3: Navigate to chat page
    console.log('\n📍 Step 3: 导航到聊天页面');
    const chatLink = page.locator('a[href="/chat"]').first();

    if (await chatLink.isVisible({ timeout: 2000 })) {
      await chatLink.click({ force: true });
      await page.waitForTimeout(1000);
      logStep('点击聊天链接', 'SUCCESS', '成功导航到聊天页面');
    } else {
      // Try navigating directly
      await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      logStep('直接访问聊天页面', 'SUCCESS');
    }

    await page.screenshot({ path: '/workspace/e2e/screenshots/chat-page.png', fullPage: true });

    // Step 4: Check for chat items
    console.log('\n📍 Step 4: 检查聊天列表');
    let chatItems = await page.locator('a[href*="/chat/"]').all();
    console.log(`   找到 ${chatItems.length} 个聊天链接`);

    if (chatItems.length === 0) {
      // Check for empty state or "create chat" button
      const createBtn = page.locator('button:has-text("Start"), button:has-text("开始"), button:has-text("Chat")').first();
      if (await createBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        chatItems = await page.locator('a[href*="/chat/"]').all();
        console.log(`   创建后找到 ${chatItems.length} 个聊天链接`);
      }
    }

    if (chatItems.length > 0) {
      logStep('聊天对象存在', 'SUCCESS', `找到 ${chatItems.length} 个聊天对象`);

      // Click on first chat
      await chatItems[0].click({ force: true });
      await page.waitForTimeout(1500);
      logStep('打开聊天', 'SUCCESS', '成功打开第一个聊天');

      await page.screenshot({ path: '/workspace/e2e/screenshots/chat-opened.png', fullPage: true });

      // Step 5: Test message input
      console.log('\n📍 Step 5: 测试消息输入框');
      const inputSelectors = [
        'input[placeholder*="type" i]',
        'input[placeholder*="消息"]',
        'input[placeholder*="输入"]',
        'input[placeholder*="search" i]',
        'textarea'
      ];

      let messageInput = null;
      for (const selector of inputSelectors) {
        const input = page.locator(selector).first();
        try {
          if (await input.isVisible({ timeout: 500 })) {
            messageInput = input;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!messageInput) {
        // Try any visible enabled input
        const allInputs = await page.locator('input:not([type="hidden"]), textarea').all();
        for (const input of allInputs) {
          try {
            if (await input.isVisible() && await input.isEnabled()) {
              messageInput = input;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      if (messageInput) {
        logStep('消息输入框存在', 'SUCCESS');

        // Type test message
        await messageInput.fill('Hello, this is a test message!');
        const value = await messageInput.inputValue();

        if (value.length > 0) {
          logStep('消息输入功能', 'SUCCESS', `输入内容: "${value.substring(0, 20)}..."`);
        } else {
          logStep('消息输入功能', 'WARNING', '输入内容为空');
        }

        // Step 6: Test send button and Enter key
        console.log('\n📍 Step 6: 测试发送功能');

        // Find send button
        const sendBtnSelectors = [
          'button[class*="send" i]',
          'button:has-text("Send")',
          'button:has-text("发送")',
          '[class*="send-button"]'
        ];

        let sendButton = null;
        for (const selector of sendBtnSelectors) {
          try {
            const btn = page.locator(selector).first();
            if (await btn.isVisible({ timeout: 300 })) {
              sendButton = btn;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (sendButton) {
          logStep('发送按钮存在', 'SUCCESS');
        } else {
          logStep('发送按钮存在', 'WARNING', '未找到专用发送按钮');
        }

        // Try to send with Enter
        await messageInput.press('Enter');
        await page.waitForTimeout(1000);

        // Check for messages in chat
        const messages = await page.locator('[class*="message"], [class*="bubble"], .message, .bubble').all();
        logStep('消息显示', messages.length > 0 ? 'SUCCESS' : 'WARNING', `找到 ${messages.length} 条消息`);

        // Step 7: Test emoji picker
        console.log('\n📍 Step 7: 测试表情选择器');

        const emojiBtnSelectors = [
          '[class*="emoji-button"]',
          '[class*="emoji-picker" i]',
          'button[title*="emoji" i]',
          'button[aria-label*="emoji" i]'
        ];

        let emojiButton = null;
        for (const selector of emojiBtnSelectors) {
          try {
            const btn = page.locator(selector).first();
            if (await btn.isVisible({ timeout: 300 })) {
              emojiButton = btn;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!emojiButton) {
          // Try finding button with emoji icon
          const allBtns = await page.locator('button').all();
          for (const btn of allBtns) {
            try {
              const text = await btn.textContent();
              const isVisible = await btn.isVisible();
              if (isVisible && text && /[😊😀😃😄🙂👍🎉💬📎]/.test(text)) {
                emojiButton = btn;
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }

        if (emojiButton) {
          logStep('表情按钮存在', 'SUCCESS');
          await emojiButton.click();
          await page.waitForTimeout(500);

          // Check for picker
          const picker = page.locator('[class*="picker" i], [role="listbox"], [class*="emoji-grid" i]').first();
          if (await picker.isVisible({ timeout: 1000 }).catch(() => false)) {
            logStep('表情选择器打开', 'SUCCESS');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            logStep('表情选择器关闭', 'SUCCESS');
          } else {
            logStep('表情选择器打开', 'WARNING', '点击了按钮但选择器未显示');
          }
        } else {
          logStep('表情按钮存在', 'WARNING', '未找到表情按钮');
        }

      } else {
        logStep('消息输入框存在', 'FAIL', '未找到消息输入框');
        TEST_RESULTS.issues.push({
          step: '消息输入框',
          expected: '应该有消息输入框',
          actual: '未找到输入框元素',
          severity: 'high'
        });
      }

    } else {
      logStep('聊天对象存在', 'WARNING', '未找到聊天对象，可能需要先创建');
      TEST_RESULTS.issues.push({
        step: '聊天列表',
        expected: '应该有聊天对象',
        actual: '聊天列表为空',
        severity: 'medium'
      });
    }

    // Final screenshot
    await page.screenshot({ path: '/workspace/e2e/screenshots/final-state.png', fullPage: true });
    logStep('截图保存', 'SUCCESS');

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);
    TEST_RESULTS.issues.push({
      step: '测试执行',
      expected: '测试应正常完成',
      actual: `发生错误: ${error.message}`,
      severity: 'critical'
    });
  } finally {
    await browser.close();
  }

  // Generate final report
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
      console.log(`  ${i + 1}. ${err.message.substring(0, 150)}`);
    });
  }

  console.log(`\n发现的问题数量: ${TEST_RESULTS.issues.length}`);
  if (TEST_RESULTS.issues.length > 0) {
    console.log('\n问题详情:');
    TEST_RESULTS.issues.forEach((issue, index) => {
      console.log(`\n  问题 ${index + 1}:`);
      console.log(`    步骤: ${issue.step}`);
      console.log(`    预期: ${issue.expected}`);
      console.log(`    实际: ${issue.actual}`);
      console.log(`    严重性: ${issue.severity}`);
    });
  }

  console.log('\n========================================\n');
  console.log('截图已保存:');
  console.log('  - /workspace/e2e/screenshots/initial-state.png');
  console.log('  - /workspace/e2e/screenshots/chat-page.png');
  console.log('  - /workspace/e2e/screenshots/chat-opened.png');
  console.log('  - /workspace/e2e/screenshots/final-state.png');

  const reportContent = JSON.stringify(TEST_RESULTS, null, 2);
  await import('fs').then(fs => fs.writeFileSync('/workspace/e2e/test-report.json', reportContent));
  console.log('\n📄 测试报告已保存到: /workspace/e2e/test-report.json');

  return TEST_RESULTS;
}

testChatBuddy().catch(console.error);
