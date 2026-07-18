import { test, expect } from '@playwright/test';

async function expectAppReady(page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('main').first()).toBeVisible();
}

test.describe('Chat Buddy smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await expectAppReady(page);
  });

  test('loads the application shell', async ({ page }) => {
    await expect(page).toHaveTitle(/Chat Buddy/i);
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  });

  test('navigates through every primary route', async ({ page }) => {
    const routes = ['/agents', '/friends', '/moments', '/settings'];

    for (const route of routes) {
      await page.locator(`nav[aria-label="Primary"] a[href="${route}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  for (const route of ['/', '/agents', '/friends', '/moments', '/settings']) {
    test(`renders ${route} directly`, async ({ page }) => {
      await expectAppReady(page, route);
      await expect(page).toHaveURL(new RegExp(route === '/' ? '/$' : `${route}$`));
    });
  }

  test('supports keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT', 'TEXTAREA']).toContain(focusedTag);
  });

  test('renders at phone and tablet sizes', async ({ page }) => {
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await expectAppReady(page);
    }
  });

  test('loads the shell within five seconds', async ({ page }) => {
    const startedAt = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).toBeVisible();
    expect(Date.now() - startedAt).toBeLessThan(5000);
  });

  test('does not emit unexpected console errors during startup', async ({ page }) => {
    const errors = [];
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await expectAppReady(page);
    const unexpected = errors.filter(message =>
      !message.includes('CORS') &&
      !message.includes('net::ERR') &&
      !message.includes('Failed to fetch') &&
      !message.includes('AI API')
    );
    expect(unexpected).toEqual([]);
  });
});
