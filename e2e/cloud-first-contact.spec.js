import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const cloud = process.env.E2E_CLOUD_BASE_URL ?? 'http://localhost:8080';

async function signIn(request, email) {
  const response = await request.post(cloud + '/v1/auth/dev-signin', {
    data: { displayName: 'A01 fixture', email },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function useSession(page, tokens) {
  await page.addInitScript((session) => {
    sessionStorage.setItem('cb.access_token', session.accessToken);
    sessionStorage.setItem('cb.access_expires_at', session.accessExpiresAt);
    sessionStorage.setItem('cb.refresh_token', session.refreshToken);
    sessionStorage.setItem('cb.refresh_expires_at', session.refreshExpiresAt);
    sessionStorage.setItem('cb.actor_id', session.actorId);
    sessionStorage.setItem('cb.account_id', session.accountId);
  }, tokens);
}

test('A01 fresh cloud account lands in Chats with one real unread Mira welcome', async ({ page, request, browser }) => {
  const email = 'a01-' + randomUUID() + '@example.test';
  const tokens = await signIn(request, email);
  await useSession(page, tokens);
  await page.goto('/');
  await expect(page).toHaveURL(/\/chats$/);
  await expect(page.getByTestId('chat-list')).toBeVisible();
  await expect(page.getByTestId('legacy-onboarding-tour')).toHaveCount(0);
  const row = page.getByTestId('first-contact-mira');
  await expect(row).toBeVisible();
  await expect(row.getByTestId('first-contact-unread')).toHaveCount(1);
  await row.click();
  await expect(page).toHaveURL(/\/chats\/[0-9a-f-]+$/);
  const id = new URL(page.url()).pathname.split('/').pop();
  const bubbles = page.getByTestId('cloud-message-bubble');
  await expect(bubbles).toHaveCount(1);
  await expect(bubbles.first()).toContainText('What would you like me to call you?');

  const outsider = await signIn(request, 'a01-outsider-' + randomUUID() + '@example.test');
  const denied = await request.get(cloud + '/v1/conversations/' + id + '/messages', {
    headers: { authorization: 'Bearer ' + outsider.accessToken },
  });
  expect(denied.status()).toBe(403);

  const second = await browser.newContext();
  try {
    const otherPage = await second.newPage();
    const anotherSession = await signIn(request, email);
    expect(anotherSession.accountId).toBe(tokens.accountId);
    await useSession(otherPage, anotherSession);
    await otherPage.goto(new URL('/chats', page.url()).href);
    const sameRow = otherPage.getByTestId('first-contact-mira');
    await expect(sameRow).toBeVisible();
    await expect(sameRow.getByTestId('first-contact-unread')).toHaveCount(0);
    await sameRow.click();
    await expect(otherPage).toHaveURL(new RegExp('/chats/' + id + '$'));
  } finally {
    await second.close();
  }
});
