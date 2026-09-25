/**
 * Cloud chat window smoke — /chats/:conversationId route.
 *
 * Complements p0-acceptance (API-level) with one real-browser check of the
 * new cloud window: the timeline renders cloud messages through the cloud
 * adapter, the composer sends via the cloud POST, and the composer stays
 * enabled afterwards (never locked).
 *
 * Runs against the same dev runtime as p0-acceptance; skipped when the
 * cloud server is unreachable. Chromium-only to keep the smoke light.
 */
import { test, expect } from '@playwright/test';

const CLOUD_HEALTH_URL =
  process.env.E2E_CLOUD_BASE_URL ?? 'http://localhost:8080';

async function serverAvailable(request) {
  try {
    const res = await request.get(`${CLOUD_HEALTH_URL}/healthz`, {
      timeout: 2000,
    });
    return res.ok();
  } catch {
    return false;
  }
}

test.describe('Cloud chat window smoke (/chats/:conversationId)', () => {
  test.beforeEach(async ({ request }, testInfo) => {
    test.skip(
      test.info().project.name !== 'chromium',
      'chromium-only smoke test',
    );
    const ok = await serverAvailable(request);
    if (!ok) {
      testInfo.skip(true, `Cloud runtime not reachable at ${CLOUD_HEALTH_URL}`);
    }
  });

  test('cloud window renders timeline and sends via cloud POST', async ({
    page,
    request,
  }) => {
    test.slow(); // Cold dev-server transform can delay the first styled paint.

    const res = await request.post(`${CLOUD_HEALTH_URL}/v1/auth/dev-signin`, {
      data: { displayName: 'Cloud Window Smoke' },
    });
    expect(res.ok()).toBeTruthy();
    const tokens = await res.json();

    // Direct conversation with Mira (seeded first official friend).
    const actorsRes = await request.get(`${CLOUD_HEALTH_URL}/v1/actors`, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(actorsRes.ok()).toBeTruthy();
    const { items } = await actorsRes.json();
    const mira = items.find((a) => a.publicName === 'Mira');
    expect(mira).toBeTruthy();

    const convRes = await request.post(`${CLOUD_HEALTH_URL}/v1/conversations`, {
      data: { type: 'direct', inviteeActorIds: [mira.id] },
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(convRes.status()).toBe(201);
    const { id: conversationId } = await convRes.json();

    // One seeded cloud message so the timeline has server truth to render.
    const seedRes = await request.post(
      `${CLOUD_HEALTH_URL}/v1/conversations/${conversationId}/messages`,
      {
        data: {
          clientIdempotencyKey: `smoke-seed-${Date.now()}`,
          kind: 'text',
          content: 'Cloud smoke seed message',
        },
        headers: { authorization: `Bearer ${tokens.accessToken}` },
      },
    );
    expect(seedRes.status()).toBe(201);

    // Share the session with the page before the app boots.
    await page.addInitScript(
      ([access, refresh, actor, account]) => {
        sessionStorage.setItem('cb.access_token', access);
        sessionStorage.setItem('cb.refresh_token', refresh);
        sessionStorage.setItem('cb.actor_id', actor);
        sessionStorage.setItem('cb.account_id', account);
      },
      [
        tokens.accessToken,
        tokens.refreshToken,
        tokens.actorId,
        tokens.accountId,
      ],
    );

    await page.goto(`/chats/${conversationId}`, {
      waitUntil: 'domcontentloaded',
    });

    // Cloud window (not the legacy /chat/:id ChatWindow) renders.
    await expect(page.getByText('Cloud Chat')).toBeVisible({
      timeout: 30_000,
    });
    const timeline = page.locator('[data-testid="cloud-message-timeline"]');
    await timeline.waitFor({ state: 'attached', timeout: 30_000 });
    await expect(
      page
        .getByTestId('cloud-message-bubble')
        .filter({ hasText: 'Cloud smoke seed message' }),
    ).toBeVisible({ timeout: 30_000 });

    // Send through the composer: optimistic bubble appears immediately,
    // the cloud POST persists it, and the composer is never disabled.
    const composer = page.getByRole('textbox');
    await composer.fill('Cloud smoke reply');
    await composer.press('Enter');
    await expect(
      page
        .getByTestId('cloud-message-bubble')
        .filter({ hasText: 'Cloud smoke reply' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('cloud-message-error')).toHaveCount(0);
    await expect(composer).toBeEnabled();
  });
});
