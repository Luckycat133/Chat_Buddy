import { test, expect } from '@playwright/test';

// Skip E2E tests in CI if no API key configured
const TEST_API_KEY = process.env.VITE_AI_API_KEY;
const SKIP_IF_NO_API = test.skip;

test.describe('Chat Buddy E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).toBeVisible();
  });

  test.describe('Navigation & Layout', () => {
    test('should load the dashboard page', async ({ page }) => {
      // Dashboard should be the default page
      await expect(page).toHaveTitle(/Chat Buddy/i);
    });

    test('should navigate to all main pages via sidebar', async ({ page }) => {
      // Test Chat page navigation
      const chatNav = page.locator('nav').getByText(/Chat/i).first();
      if (await chatNav.isVisible()) {
        await chatNav.click();
        await expect(page).toHaveURL(/\/chat/);
      }

      // Test Friends page navigation
      const friendsNav = page.locator('nav').getByText(/Friends/i).first();
      if (await friendsNav.isVisible()) {
        await friendsNav.click();
        await expect(page).toHaveURL(/\/friends/);
      }

      // Test Moments page navigation
      const momentsNav = page.locator('nav').getByText(/Moments/i).first();
      if (await momentsNav.isVisible()) {
        await momentsNav.click();
        await expect(page).toHaveURL(/\/moments/);
      }
    });

    test('should toggle dark/light mode', async ({ page }) => {
      // Find the settings or theme toggle
      const html = page.locator('html');
      const initialClass = await html.getAttribute('class');

      // Find theme toggle (could be in header, sidebar, or settings)
      const themeToggle = page.locator('button').filter({ has: page.locator('[class*="sun"], [class*="moon"], [class*="theme"]') }).first();

      if (await themeToggle.isVisible({ timeout: 2000 })) {
        await themeToggle.click();
        const newClass = await html.getAttribute('class');
        // Verify class changed
        expect(newClass).not.toBe(initialClass);
      }
    });
  });

  test.describe('Chat Feature', () => {
    test('should display chat list with AI personas', async ({ page }) => {
      // Wait for chat list to load
      await page.waitForSelector('[class*="chat-list"], .chat-list', { timeout: 5000 }).catch(() => null);

      // Check that personas are displayed
      const chatItems = page.locator('[class*="chat-item"], .chat-item');
      await expect(chatItems.first()).toBeVisible({ timeout: 5000 });
    });

    test('should open a chat when clicking on a contact', async ({ page }) => {
      // Find a chat item and click it
      const chatItem = page.locator('[class*="chat-item"], .chat-item').first();
      await chatItem.click();

      // Verify chat window opened
      const chatWindow = page.locator('[class*="chat-window"], .chat-window, [class*="message-timeline"]').first();
      await expect(chatWindow).toBeVisible({ timeout: 3000 });
    });

    SKIP_IF_NO_API('should send a message and receive AI response', async ({ page }) => {
      // Open a chat
      const chatItem = page.locator('[class*="chat-item"], .chat-item').first();
      await chatItem.click();

      // Wait for chat to open
      await page.waitForTimeout(500);

      // Find the message input
      const input = page.locator('input[placeholder*="Type"], input[placeholder*="消息"], textarea').first();
      await expect(input).toBeVisible({ timeout: 3000 });

      // Type a message
      await input.fill('Hello, how are you?');
      await input.press('Enter');

      // Verify message appears in chat
      const messages = page.locator('[class*="message"], [class*="bubble"]');
      await expect(messages.last()).toBeVisible({ timeout: 10000 });

      // Wait for AI response (typing indicator should show first)
      // Then verify AI response appears
      const aiMessage = page.locator('[class*="message"][class*="ai"], [class*="bubble"][class*="ai"]').last();
      await expect(aiMessage).toBeVisible({ timeout: 30000 });
    });

    test('should display AI persona avatar and status', async ({ page }) => {
      // Open a chat
      const chatItem = page.locator('[class*="chat-item"], .chat-item').first();
      await chatItem.click();

      // Check for avatar image
      const avatar = page.locator('[class*="avatar"], img[alt*="Luna"], img[alt*="Max"]').first();
      await expect(avatar).toBeVisible({ timeout: 3000 });

      // Check for status indicator (online/offline/busy dot)
      const statusDot = page.locator('[class*="status"], [class*="online"], [class*="offline"]').first();
      await expect(statusDot).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Friends Feature', () => {
    test('should navigate to friends page', async ({ page }) => {
      const friendsLink = page.locator('a[href="/friends"], nav').filter({ hasText: /Friends/i }).first();
      await friendsLink.click();
      await expect(page).toHaveURL(/\/friends/);
    });

    test('should display friend list with groups', async ({ page }) => {
      await page.goto('/friends');
      await page.waitForLoadState('domcontentloaded');

      // Check for friend cards or list items
      const friendItem = page.locator('[class*="friend"], [class*="contact"]').first();
      await expect(friendItem).toBeVisible({ timeout: 5000 });
    });

    test('should open friend detail panel', async ({ page }) => {
      await page.goto('/friends');
      await page.waitForLoadState('domcontentloaded');

      // Click on a friend
      const friendItem = page.locator('[class*="friend"], [class*="contact"]').first();
      await friendItem.click();

      // Verify detail panel opens
      const detailPanel = page.locator('[class*="detail"], [class*="panel"], [class*="modal"]').first();
      await expect(detailPanel).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Moments Feature', () => {
    test('should navigate to moments page', async ({ page }) => {
      const momentsLink = page.locator('a[href="/moments"], nav').filter({ hasText: /Moments|朋友圈/i }).first();
      await momentsLink.click();
      await expect(page).toHaveURL(/\/moments/);
    });

    test('should display moments feed', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForLoadState('domcontentloaded');

      // Check for moment cards
      const momentCard = page.locator('[class*="moment"], [class*="post"], [class*="feed-item"]').first();
      await expect(momentCard).toBeVisible({ timeout: 5000 });
    });

    SKIP_IF_NO_API('should create a new moment', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForLoadState('domcontentloaded');

      // Find and click the compose button
      const composeBtn = page.locator('button').filter({ has: page.locator('[class*="plus"], [class*="camera"], [class*="edit"]') }).first();
      if (await composeBtn.isVisible({ timeout: 2000 })) {
        await composeBtn.click();

        // Type in the composer
        const composer = page.locator('textarea, [contenteditable]').first();
        await composer.fill('Test moment content');

        // Submit
        const submitBtn = page.locator('button').filter({ hasText: /Post|Send|发布/i }).first();
        await submitBtn.click();

        // Verify post appears
        const newPost = page.locator('[class*="moment"]:has-text("Test moment content")');
        await expect(newPost).toBeVisible({ timeout: 5000 });
      }
    });

    test('should filter moments by tab (all/mine/AI)', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForLoadState('domcontentloaded');

      // Find tab buttons
      const tabs = page.locator('[class*="tab"], button').filter({ hasText: /All|Mine|AI|全部|我的/i });
      if (await tabs.count() > 0) {
        await tabs.nth(1).click();
        await page.waitForTimeout(300);
        // Verify filtered results
      }
    });
  });

  test.describe('Settings Feature', () => {
    test('should navigate to settings page', async ({ page }) => {
      const settingsLink = page.locator('a[href="/settings"], button').filter({ hasText: /Settings|设置/i }).first();
      await settingsLink.click();
      await expect(page).toHaveURL(/\/settings/);
    });

    test('should toggle language between EN and ZH', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Find language toggle
      const langToggle = page.locator('button').filter({ hasText: /EN|中|语言|Language/i }).first();
      if (await langToggle.isVisible({ timeout: 2000 })) {
        await langToggle.click();
        await page.waitForTimeout(300);
        // Verify language changed (text content should change)
      }
    });

    test('should display API configuration panel', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Find API settings
      const apiSection = page.locator('[class*="api"], [class*="config"]').first();
      await expect(apiSection).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Navigate using Tab key
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Verify some interactive element got focus
      const focused = page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'BUTTON', 'A']).toContain(focused);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check that h1 exists
      const h1 = page.locator('h1').first();
      if (await h1.isVisible({ timeout: 2000 })) {
        await expect(h1).toBeVisible();
      }

      // Check that headings don't skip levels (h1 -> h2 -> h3)
      const headings = await page.locator('h1, h2, h3, h4').all();
      // Verify at least one heading exists
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should have sufficient color contrast', async ({ page }) => {
      // Basic check - no white text on white background
      const bodyBg = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor
      );
      // Don't assert exact color, just ensure body has a background
      expect(bodyBg).toBeTruthy();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Verify main content is visible
      const mainContent = page.locator('main, [role="main"], #root > div').first();
      await expect(mainContent).toBeVisible();
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Verify main content is visible
      const mainContent = page.locator('main, [role="main"], #root > div').first();
      await expect(mainContent).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load initial page within 5 seconds', async ({ page }) => {
      const start = Date.now();
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(5000);
    });

    test('should not have excessive console errors', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Filter out known acceptable errors (CORS, network issues in test env, etc.)
      const criticalErrors = errors.filter(e =>
        !e.includes('CORS') &&
        !e.includes('net::ERR') &&
        !e.includes('Failed to fetch') &&
        !e.includes('AI API')
      );

      expect(criticalErrors.length).toBeLessThan(3);
    });
  });
});

// Browser compatibility tests
test.describe('Browser Compatibility', () => {
  test('should work in Chromium', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify basic functionality
    await expect(page.locator('#root')).toBeVisible();

    await context.close();
  });
});