
import { test } from '@playwright/test';
import { expect } from '@playwright/test';

test('GeneratedTest_2025-08-05', async ({ page, context }) => {

    // Navigate to URL
    await page.goto('http://localhost:3000/');

    // Navigate to the application and wait for it to load
    await page.goto('http://localhost:3001/', { waitUntil: 'load' });

    // Verify that the page loaded successfully
    await expect(page).toHaveURL('http://localhost:3001/');
});
