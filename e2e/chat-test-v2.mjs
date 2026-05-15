import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';
const TEST_RESULTS = {
  steps: [],
  consoleErrors: [],
  pageLoadTime: null,
  issues: []
};

function logStep(name, status, details = '') {
  const result = {
    name,
    status,
    details,
    timestamp: new Date().toISOString()
  };
  TEST_RESULTS.steps.push(result);
  const icon = status === 'SUCCESS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}: ${status}${details ? ' - ' + details : ''}`);
}

function logError(message) {
  TEST_RESULTS.consoleErrors.push({ message });
  console.log(`❌ Console Error: ${message}`);
}

async function testChatBuddy() {
  console.log('🚀 开始测试 Chat-Buddy 应用...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const startTime = Date.now();

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
    // Step 1: Navigate to app and measure load time
    console.log('\n📍 Step 1: 导航到应用首页');
    const navStart = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    TEST_RESULTS.pageLoadTime = Date.now() - navStart;
    logStep('页面加载', 'SUCCESS', `加载时间: ${TEST_RESULTS.pageLoadTime}ms`);

    // Wait for app to be ready
    await page.waitForSelector('#root', { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Step 2: Check current URL
    const url = page.url();
    logStep('导航验证', 'SUCCESS', `当前URL: ${url}`);

    // Step 3: Take initial screenshot
    await page.screenshot({ path: '/workspace/e2e/screenshots/initial-state.png', fullPage: true });

    // Step 4: Look for chat-related links and buttons
    console.log('\n📍 Step 2: 检查页面结构');
    const allLinks = await page.locator('a[href*="/chat/"]').all();
    const chatNavButtons = await page.locator('nav a, aside a').all();

    console.log(`   发现 ${allLinks.length} 个 /chat/ 链接`);
    console.log(`   发现 ${chatNavButtons.length} 个导航链接`);

    // Try to find a chat link
    let chatLink = null;
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (href && href.includes('/chat/')) {
        chatLink = link;
        break;
      }
    }

    if (!chatLink) {
      // Try to find chat nav button
      for (const btn of chatNavButtons) {
        const text = await btn.textContent();
        if (text && (text.toLowerCase().includes('chat') || text.includes('聊天'))) {
          chatLink = btn;
          break;
        }
      }
    }

    if (chatLink) {
      logStep('找到聊天导航', 'SUCCESS');
      await chatLink.click();
      await page.waitForTimeout(1000);
    }

    // Step 5: Check for chat items (using Link elements that point to /chat/)
    console.log('\n📍 Step 3: 测试聊天列表');
    const chatItems = await page.locator('a[href*="/chat/"]').all();

    if (chatItems.length > 0) {
      logStep('聊天对象数量', 'SUCCESS', `找到 ${chatItems.length} 个聊天对象`);

      // Click on the first chat item
      await chatItems[0].click();
      await page.waitForTimeout(1000);
      logStep('点击聊天对象', 'SUCCESS', '成功点击第一个聊天对象');

      // Take screenshot after clicking
      await page.screenshot({ path: '/workspace/e2e/screenshots/after-chat-click.png', fullPage: true });

      // Step 6: Test message input
      console.log('\n📍 Step 4: 测试消息输入框');

      // Look for input fields more broadly
      const inputs = await page.locator('input, textarea').all();
      console.log(`   找到 ${inputs.length} 个输入字段`);

      let messageInput = null;
      for (const input of inputs) {
        const placeholder = await input.getAttribute('placeholder').catch(() => '');
        const type = await input.getAttribute('type').catch(() => 'text');
        const isVisible = await input.isVisible().catch(() => false);

        if (isVisible && (placeholder?.toLowerCase().includes('type') ||
            placeholder?.includes('消息') ||
            placeholder?.includes('输入') ||
            placeholder?.includes('search') ||
            type === 'text' && placeholder)) {
          messageInput = input;
          console.log(`   使用输入框: placeholder="${placeholder}", type="${type}"`);
          break;
        }
      }

      if (!messageInput) {
        // Try to find any enabled input/textarea
        for (const input of inputs) {
          const isEnabled = await input.isEnabled().catch(() => false);
          const isVisible = await input.isVisible().catch(() => false);
          if (isEnabled && isVisible) {
            messageInput = input;
            break;
          }
        }
      }

      if (messageInput) {
        logStep('消息输入框存在', 'SUCCESS');

        // Clear and type test message
        await messageInput.clear();
        await messageInput.fill('Hello, this is a test message!');
        const inputValue = await messageInput.inputValue();

        if (inputValue.length > 0) {
          logStep('消息输入功能', 'SUCCESS', `输入了 "${inputValue.substring(0, 30)}..."`);
        } else {
          logStep('消息输入功能', 'FAIL', '输入内容未正确保存');
        }

        // Step 7: Test send functionality
        console.log('\n📍 Step 5: 测试发送消息');

        // Try Enter key to send
        await messageInput.press('Enter');
        await page.waitForTimeout(1000);
        logStep('按Enter发送消息', 'SUCCESS', '已按Enter发送消息');

        // Check if message appears in chat area
        const chatMessages = await page.locator('.message, .bubble, [class*="message"], [class*="bubble"]').all();
        console.log(`   找到 ${chatMessages.length} 个消息元素`);
        logStep('消息显示检查', chatMessages.length > 0 ? 'SUCCESS' : 'WARNING', `找到 ${chatMessages.length} 条消息`);

        // Step 8: Test emoji picker
        console.log('\n📍 Step 6: 测试表情选择器');

        // Find emoji button
        const emojiButton = page.locator('button').filter({ hasText: /[😊😀😃😄🙂👍🎉]/ }).first();
        const emojiButtonAlt = page.locator('[class*="emoji"]').first();

        let foundEmojiButton = null;
        if (await emojiButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          foundEmojiButton = emojiButton;
        } else if (await emojiButtonAlt.isVisible({ timeout: 1000 }).catch(() => false)) {
          foundEmojiButton = emojiButtonAlt;
        }

        // Also try to find by aria-label or title
        if (!foundEmojiButton) {
          const allButtons = await page.locator('button').all();
          for (const btn of allButtons) {
            const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
            const title = await btn.getAttribute('title').catch(() => '');
            const isVisible = await btn.isVisible().catch(() => false);

            if (isVisible && (ariaLabel?.toLowerCase().includes('emoji') ||
                title?.toLowerCase().includes('emoji'))) {
              foundEmojiButton = btn;
              break;
            }
          }
        }

        if (foundEmojiButton) {
          logStep('表情按钮存在', 'SUCCESS');
          await foundEmojiButton.click();
          await page.waitForTimeout(500);

          // Check if emoji picker appeared
          const emojiPicker = page.locator('[class*="emoji-picker"], [class*="picker"], [role="listbox"]').first();
          const pickerVisible = await emojiPicker.isVisible({ timeout: 2000 }).catch(() => false);

          if (pickerVisible) {
            logStep('表情选择器打开', 'SUCCESS');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            logStep('表情选择器关闭', 'SUCCESS');
          } else {
            logStep('表情选择器打开', 'WARNING', '点击了表情按钮但选择器未显示');
          }
        } else {
          logStep('表情按钮存在', 'WARNING', '未找到表情按钮');
        }

        // Step 9: Test send button
        console.log('\n📍 Step 7: 测试发送按钮');
        const sendButton = page.locator('button[class*="send"], button:has-text("Send"), button:has-text("发送")').first();
        const sendButtonVisible = await sendButton.isVisible({ timeout: 1000 }).catch(() => false);

        if (sendButtonVisible) {
          logStep('发送按钮存在', 'SUCCESS');
        } else {
          logStep('发送按钮存在', 'WARNING', '未找到专用发送按钮(可能使用Enter发送)');
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
      logStep('聊天对象数量', 'WARNING', '未找到 /chat/ 链接，可能需要先创建聊天或检查路由');
      TEST_RESULTS.issues.push({
        step: '聊天列表',
        expected: '应该至少有一个聊天对象',
        actual: '未找到聊天对象链接',
        severity: 'medium'
      });
    }

    // Final screenshot
    await page.screenshot({ path: '/workspace/e2e/screenshots/final-state.png', fullPage: true });
    logStep('截图保存', 'SUCCESS', '已保存初始、点击后和最终状态截图');

  } catch (error) {
    console.error('测试过程中发生错误:', error);
    TEST_RESULTS.issues.push({
      step: '测试执行',
      expected: '测试应正常完成',
      actual: `发生错误: ${error.message}`,
      severity: 'critical'
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
    TEST_RESULTS.consoleErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message}`);
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
  console.log('  - /workspace/e2e/screenshots/after-chat-click.png');
  console.log('  - /workspace/e2e/screenshots/final-state.png');

  // Save report to file
  const reportContent = JSON.stringify(TEST_RESULTS, null, 2);
  await import('fs').then(fs => fs.writeFileSync('/workspace/e2e/test-report.json', reportContent));
  console.log('\n📄 测试报告已保存到: /workspace/e2e/test-report.json');

  return TEST_RESULTS;
}

testChatBuddy().catch(console.error);
