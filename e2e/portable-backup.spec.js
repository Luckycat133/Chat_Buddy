import { test, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const cloud = process.env.E2E_CLOUD_BASE_URL ?? 'http://localhost:8080';
const golden = JSON.parse(readFileSync(new URL('../docs/fixtures/web-v2-cloud-backup-golden.json', import.meta.url), 'utf8'));
const pngSha = '1d4b76d057042b92d4f9ae29eed2ca0ee1f4baa28f17f3e72163aec022273e78';
test.use({ serviceWorkers: 'block' });

test('restore and re-export one bound Web v2 archive with real Chromium and a synthetic account', async ({ page, request }) => {
    const auth = await request.post(cloud + '/v1/auth/dev-signin', {
        data: { displayName: 'Synthetic Backup', email: `backup-${randomUUID()}@example.test` },
    });
    expect(auth.ok()).toBeTruthy();
    const tokens = await auth.json();
    const headers = { authorization: 'Bearer ' + tokens.accessToken };
    const bootstrap = await request.post(cloud + '/v1/onboarding/bootstrap', { headers });
    expect(bootstrap.ok()).toBeTruthy();
    const live = await request.get(cloud + '/v1/account/backup/live', { headers });
    expect(live.ok()).toBeTruthy();
    const current = (await live.json()).cloudAccount;
    const source = structuredClone(golden);
    source.cloudAccount.accountId = current.accountId;
    source.cloudAccount.actorId = current.actorId;
    const thread = source.cloudAccount.conversations[0];
    thread.id = current.conversations[0].id;
    for (const message of thread.messages) message.senderActorId = current.actorId;
    const original = JSON.stringify(source, null, 2) + '\n';
    await page.addInitScript((session) => {
        sessionStorage.setItem('cb.access_token', session.accessToken);
        sessionStorage.setItem('cb.access_expires_at', session.accessExpiresAt);
        sessionStorage.setItem('cb.refresh_token', session.refreshToken);
        sessionStorage.setItem('cb.refresh_expires_at', session.refreshExpiresAt);
        sessionStorage.setItem('cb.actor_id', session.actorId);
        sessionStorage.setItem('cb.account_id', session.accountId);
        localStorage.setItem('chat-buddy-lang', '"en"');
    }, tokens);
    await page.goto('/settings');
    const panel = page.getByRole('region', { name: 'Portable account backup' });
    await expect(panel).toBeVisible();
    await panel.locator('input[type=file]').setInputFiles({
        name: 'web-v2.json', mimeType: 'application/json', buffer: Buffer.from(original),
    });
    const write = page.waitForResponse(response =>
        response.url().endsWith('/v1/account/backup') && response.request().method() === 'PUT');
    await panel.getByRole('button', { name: 'Import and replace saved backup' }).click();
    expect((await write).status()).toBe(200);
    await panel.locator('summary').filter({ hasText: '云端聊天' }).click();
    await panel.locator('summary').filter({ hasText: '本地聊天' }).click();
    const localImage = panel.getByRole('img', { name: 'image-local-1' });
    await expect.poll(() => localImage.evaluate(node => node.naturalWidth)).toBe(1);
    await expect(panel.getByText('missing-remote-image (attachment placeholder)')).toBeVisible();
    const legacyImage = panel.getByRole('img', { name: 'inline-image-0' });
    await expect.poll(() => legacyImage.evaluate(node => node.naturalWidth)).toBe(1);
    await expect(panel.getByText('云端消息 1')).toBeVisible();
    const image = panel.getByRole('img', { name: '小图.png' });
    await expect.poll(() => image.evaluate(node => node.naturalWidth)).toBe(1);
    await expect(panel.getByText('offline.pdf (attachment placeholder)')).toBeVisible();
    const reexport = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Re-export original backup' }).click();
    const transfer = await reexport;
    const downloaded = readFileSync(await transfer.path(), 'utf8');
    expect(downloaded).toBe(original);
    const retrieved = JSON.parse(downloaded);
    expect(retrieved.cloudAccount.conversations[0].messages[1].replyToMessageId).toBe('cloud-message-1');
    expect(createHash('sha256').update(Buffer.from(retrieved.attachments[0].contentBase64, 'base64')).digest('hex')).toBe(pngSha);
});
