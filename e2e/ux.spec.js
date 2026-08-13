import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SEEDED_MOMENTS = {
  posts: [{
    id: 'e2e-seed-post',
    authorId: 'ai-1',
    content: 'A quiet moment to test the feed.',
    images: [],
    likes: [],
    comments: [],
    reactions: {},
    createdAt: '2026-08-12T00:00:00.000Z',
  }],
  lastAIPostTime: {},
  imageApiKey: '',
  imageApiUrl: '',
  draft: null,
  lastStoryEventDate: new Date().toDateString(),
};

async function seedApp(page, language = 'en', mode = 'light') {
  await page.addInitScript(({ moments, lang, themeMode }) => {
    localStorage.setItem('chat-buddy-onboarding-done', JSON.stringify(true));
    localStorage.setItem('chat-buddy-lang', JSON.stringify(lang));
    localStorage.setItem('chat-buddy-theme', JSON.stringify({
      mode: themeMode,
      oledEnabled: false,
      chatBackground: 'default',
      customBackground: null,
      accentColor: null,
      animationIntensity: 'standard',
      bubbleStyle: 'rounded',
    }));
    localStorage.setItem('chat-buddy-moments', JSON.stringify(moments));
  }, { moments: SEEDED_MOMENTS, lang: language, themeMode: mode });
}

async function openReady(page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
}

test.describe('Chat Buddy UX acceptance', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await seedApp(page, 'en', testInfo.title.includes('dark mode') ? 'dark' : 'light');
  });

  test('has no serious automated accessibility violations on primary pages', async ({ page }) => {
    for (const route of ['/', '/agents', '/friends', '/moments', '/settings', '/help']) {
      await openReady(page, route);
      await page.waitForTimeout(800);
      const result = await new AxeBuilder({ page }).analyze();
      const serious = result.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious');
      expect(serious, `${route}: ${serious.map(item => item.id).join(', ')}`).toEqual([]);
    }
  });

  test('has no serious automated accessibility violations in dark mode', async ({ page }) => {
    for (const route of ['/', '/agents', '/friends', '/moments', '/settings', '/help']) {
      await openReady(page, route);
      await page.waitForTimeout(800);
      const result = await new AxeBuilder({ page }).analyze();
      const serious = result.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious');
      expect(serious, `${route}: ${serious.map(item => item.id).join(', ')}`).toEqual([]);
    }
  });

  test('stays within the viewport at phone, tablet, laptop and desktop widths', async ({ page }, testInfo) => {
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await openReady(page, '/settings');
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        page: document.documentElement.scrollWidth,
        mainCount: document.querySelectorAll('main').length,
      }));
      expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.mainCount).toBe(1);

      if (viewport.width === 375 || viewport.width === 1440) {
        await page.screenshot({ path: testInfo.outputPath(`settings-${viewport.width}.png`), fullPage: true });
      }
    }
  });

  test('uses 44px targets for visible buttons on touch layouts', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const route of ['/create', '/agents', '/settings', '/moments']) {
      await openReady(page, route);
      const undersized = await page.locator('button:visible').evaluateAll(buttons => buttons
        .map(button => {
          const rect = button.getBoundingClientRect();
          return {
            name: button.getAttribute('aria-label') || button.textContent?.trim().slice(0, 40),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter(({ width, height }) => width < 44 || height < 44));
      expect(undersized, `${route}: ${JSON.stringify(undersized)}`).toEqual([]);
    }
  });

  test('model dialog traps focus, closes with Escape, and restores the opener', async ({ page }) => {
    await openReady(page, '/settings');
    const opener = page.getByRole('button', { name: /Model Switcher/i });
    await opener.click();

    const dialog = page.getByRole('dialog', { name: /Model Switcher/i });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);

    for (let index = 0; index < 20; index += 1) await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(opener).toBeFocused();
  });

  test('updates language metadata and honors reduced-motion preferences', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openReady(page, '/settings');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByRole('button', { name: /Interface Language/i }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    const motion = await page.getByRole('button', { name: /界面语言/ }).evaluate(element => {
      const style = getComputedStyle(element);
      return { duration: style.transitionDuration, animation: style.animationDuration };
    });
    const durationMs = value => value.split(',').map(item => item.trim().endsWith('ms')
      ? Number.parseFloat(item)
      : Number.parseFloat(item) * 1000);
    expect(Math.max(...durationMs(motion.duration))).toBeLessThanOrEqual(0.01);
    expect(Math.max(...durationMs(motion.animation))).toBeLessThanOrEqual(0.01);
  });

  test('creates a chat with the keyboard and sends a message through the real UI', async ({ page }) => {
    await page.route('**/chat/completions', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'Use items[0].' } }],
      }),
    }));

    await openReady(page, '/create');
    const luna = page.getByRole('button', { name: 'Select Luna' });
    await luna.focus();
    await page.keyboard.press('Enter');
    await expect(luna).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Done(1)' }).click();
    await expect(page).toHaveURL(/\/chat\//);

    const composer = page.getByRole('textbox', { name: 'Type a message...' });
    await composer.fill('UX acceptance message: items[1]');
    await composer.press('Enter');
    await expect(page.getByText('UX acceptance message: items[1]', { exact: true })).toBeVisible();
    await expect(page.getByText('Use items[0].', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('unknown URLs recover to the application instead of showing a blank page', async ({ page }) => {
    await openReady(page, '/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});
