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

test('previews, explicitly commits and idempotently restores a private Mira chat on real PostgreSQL', async ({ page, request }) => {
    const signin = async name => {
        const res = await request.post(cloud + '/v1/auth/dev-signin', { data: { displayName: name, email: `merge-${randomUUID()}@example.test` } });
        expect(res.ok()).toBeTruthy();
        return res.json();
    };
    const tokens = await signin('Synthetic Merge');
    const outsider = await signin('Synthetic Outsider');
    const headers = { authorization: 'Bearer ' + tokens.accessToken };
    const outsiders = { authorization: 'Bearer ' + outsider.accessToken };
    expect((await request.post(cloud + '/v1/onboarding/bootstrap', { headers })).ok()).toBeTruthy();
    const document = await (await request.get(cloud + '/v1/account/backup/live', { headers })).json();
    const thread = document.cloudAccount.conversations.find(item => item.type === 'direct');
    expect(thread).toBeTruthy();
    const newId = randomUUID();
    const newMessage = {
        id: newId, senderActorId: tokens.actorId, sequence: 991, kind: 'text', status: 'accepted',
        content: 'Synthetic restored message', createdAt: new Date().toISOString(), editedAt: null,
        replyToMessageId: null, structuredPayload: null, attachmentIds: [golden.attachments[0].id],
    };
    document.attachments = [golden.attachments[0]];
    // Existing Mira authors are allowed to remain in the archive but not reinserted.
    const direction = cloud + '/v1/conversations/' + thread.id + '/messages';
    const ahead = async cursor => (await (await request.get(direction + (cursor ? '?cursor=' + cursor : ''), { headers })).json()).items;
    const before = await ahead();
    thread.messages.push(newMessage);
    const backup = cloud + '/v1/account/backup';
    const archive = JSON.stringify(document);
    expect((await request.put(backup, { headers, data: { document: archive } })).status()).toBe(200);
    expect((await request.post(backup + '/merge/preview', { headers: outsiders, data: {} })).status()).toBe(404);
    await page.addInitScript(session => {
        for (const [key, value] of Object.entries({
            access_token: session.accessToken, access_expires_at: session.accessExpiresAt,
            refresh_token: session.refreshToken, refresh_expires_at: session.refreshExpiresAt,
            account_id: session.accountId, actor_id: session.actorId,
        })) sessionStorage.setItem('cb.' + key, value);
        localStorage.setItem('chat-buddy-lang', '"en"');
    }, tokens);
    await page.goto('/settings');
    const panel = page.getByRole('region', { name: 'Portable account backup' });
    await panel.getByRole('button', { name: 'Open imported backup' }).click();
    const preview = panel.getByRole('button', { name: 'Preview online merge' });
    await preview.click();
    const plan = panel.getByRole('region', { name: 'Merge differences' });
    await expect(plan).toContainText('Messages: 1 to add');
    const commit = panel.getByRole('button', { name: 'Confirm merge to live conversations' });
    await expect(commit).toBeDisabled();
    expect(await ahead()).toEqual(before);
    // A normal writer advancing the sequence invalidates the confirmed snapshot.
    expect((await request.post(direction, { headers, data: { content: 'Synthetic live update', clientIdempotencyKey: randomUUID() } })).status()).toBe(201);
    await panel.getByRole('checkbox', { name: 'I confirm adding the previewed messages to live conversations.' }).check();
    await commit.click();
    await expect(panel.getByRole('alert')).toContainText('Preview expired or data changed');
    const justOnline = await ahead();
    expect(justOnline.map(m => m.content)).not.toContain(newMessage.content);
    const knownSequence = justOnline.at(-1).sequence;
    await preview.click();
    await panel.getByRole('checkbox', { name: 'I confirm adding the previewed messages to live conversations.' }).check();
    await commit.click();
    await expect(panel.getByRole('status')).toContainText('Added 1 messages');
    const delta = await ahead(knownSequence + 1);
    expect(delta).toHaveLength(1);
    expect(delta[0]).toMatchObject({ content: newMessage.content, sequence: knownSequence + 1, senderActorId: tokens.actorId });
    expect(createHash('sha256').update(Buffer.from(delta[0].structuredPayload.attachments[0].contentBase64, 'base64')).digest('hex')).toBe(pngSha);
    expect((await ahead()).slice(0, justOnline.length)).toEqual(justOnline);
    await preview.click();
    await expect(plan).toContainText('Messages: 0 to add');
    await expect(commit).toHaveCount(0);
    expect(await ahead(knownSequence + 1)).toEqual(delta);
    expect(await (await request.get(backup, { headers })).text()).toBe(archive);
    await page.goto('/chats/' + thread.id + '?restoredFrom=' + (knownSequence + 1));
    await expect(page.getByTestId('cloud-message-timeline').getByText(newMessage.content)).toBeVisible();
    const image = page.getByRole('img', { name: golden.attachments[0].name });
    await expect.poll(() => image.evaluate(node => node.naturalWidth)).toBe(1);
});
