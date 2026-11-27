import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const cloud = process.env.E2E_CLOUD_BASE_URL ?? 'http://localhost:8080';

// This spec intercepts browser traffic to keep a failed timeline load in
// effect until Retry. A production preview can install a service worker.
test.use({ serviceWorkers: 'block' });

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
  let interruptTimeline = true;
  const interruptedPaths = [];
  await page.context().route(
    (url) => url.origin === new URL(cloud).origin &&
      /^\/v1\/conversations\/[^/]+\/messages$/.test(url.pathname),
    async (route) => {
      const req = route.request();
      if (interruptTimeline && req.method() === 'GET') {
        interruptedPaths.push(new URL(req.url()).pathname);
        await route.abort('failed');
      } else {
        await route.continue();
      }
    },
  );
  await row.click();
  await expect(page).toHaveURL(/\/chats\/[0-9a-f-]+$/);
  const id = new URL(page.url()).pathname.split('/').pop();
  const timeline = '/v1/conversations/' + id + '/messages';
  await expect.poll(() => interruptedPaths).toContain(timeline);
  const loadError = page.getByTestId('cloud-chat-error');
  await expect(loadError).toBeVisible();
  const bubbles = page.getByTestId('cloud-message-bubble');
  await expect(bubbles).toHaveCount(0);
  const snapshot = await request.post(cloud + '/v1/onboarding/bootstrap', {
    headers: { authorization: 'Bearer ' + tokens.accessToken },
  });
  expect(snapshot.ok()).toBeTruthy();
  expect(await snapshot.json()).toMatchObject({ conversationId: id, unread: true });

  const read = page.waitForResponse((response) =>
    response.url().endsWith('/v1/onboarding/read') && response.request().method() === 'POST');
  const reload = page.waitForResponse((response) =>
    new URL(response.url()).pathname === timeline && response.request().method() === 'GET');
  interruptTimeline = false;
  await loadError.getByRole('button').click();
  expect((await reload).ok()).toBeTruthy();
  await expect(bubbles).toHaveCount(1);
  await expect(bubbles.first()).toContainText('What would you like me to call you?');

  expect((await read).ok()).toBeTruthy();

  const outsider = await signIn(request, 'a01-outsider-' + randomUUID() + '@example.test');
  const denied = await request.get(cloud + '/v1/conversations/' + id + '/messages', {
    headers: { authorization: 'Bearer ' + outsider.accessToken },
  });
  expect(denied.status()).toBe(403);

  const second = await browser.newContext({ serviceWorkers: 'block' });
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
