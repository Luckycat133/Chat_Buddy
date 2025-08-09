
import { test, expect } from '@playwright/test';

test('GeneratedTest_2025-08-05', async ({ page, context }) => {
  
    // Navigate to initial URL
    await page.goto('http://localhost:3000/');

    // Navigate to target URL
    await page.goto('http://localhost:3001/', { waitUntil: 'load' });

    // Verify the page loaded successfully
    await expect(page).toHaveURL('http://localhost:3001/');
});