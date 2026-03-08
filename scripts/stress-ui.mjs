import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const APP_URL = 'http://127.0.0.1:4173';
const TOTAL_MESSAGES = 300;

async function waitForServer(url, timeoutMs = 45_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch (_error) {
            // keep polling until timeout
        }
        await delay(500);
    }
    throw new Error(`Vite dev server did not become ready within ${timeoutMs}ms`);
}

async function run() {
    const devServer = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    devServer.stdout.on('data', () => {});
    devServer.stderr.on('data', () => {});

    let browser;
    let page;
    try {
        await waitForServer(APP_URL);

        browser = await chromium.launch({ headless: true });
        page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

        const result = await page.evaluate(async (totalMessages) => {
            const [{ chatEngine }, { getAllPersonas }] = await Promise.all([
                import('/src/core/chat/ChatEngine.js'),
                import('/src/data/personas.js'),
            ]);

            localStorage.removeItem('chat-buddy-chats');
            localStorage.removeItem('chat-buddy:chat-buddy-chats');

            chatEngine.init(getAllPersonas());
            const chatId = chatEngine.createChat('Stress Chat', ['ai-1']);

            const start = performance.now();
            for (let i = 0; i < totalMessages; i += 1) {
                chatEngine.sendMessage(chatId, `stress-message-${i} ${'load '.repeat(10)}`);
            }
            const durationMs = performance.now() - start;

            const raw = localStorage.getItem('chat-buddy-chats') || localStorage.getItem('chat-buddy:chat-buddy-chats');
            const chats = raw ? JSON.parse(raw) : [];
            const chat = chats.find((c) => c.id === chatId);
            return {
                chatId,
                durationMs,
                messageCount: chat?.messages?.length ?? 0,
            };
        }, TOTAL_MESSAGES);

        console.log('UI Stress Test Result');
        console.log('='.repeat(60));
        console.log(`Messages sent: ${TOTAL_MESSAGES}`);
        console.log(`Duration: ${(result.durationMs / 1000).toFixed(2)} s`);
        console.log(`Throughput: ${(TOTAL_MESSAGES / (result.durationMs / 1000)).toFixed(2)} msg/s`);
        console.log(`Chat ID: ${result.chatId}`);
        console.log(`Persisted message count: ${result.messageCount}`);
        console.log('='.repeat(60));
    } catch (error) {
        if (page) {
            const debug = await page.evaluate(() => ({
                path: window.location.pathname,
                title: document.title,
                bodyPreview: (document.body?.innerText || '').slice(0, 500),
                textareaCount: document.querySelectorAll('textarea').length,
                storageRaw: localStorage.getItem('chat-buddy-chats'),
            }));
            console.error('[stress-ui] debug:', JSON.stringify(debug));
        }
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
        devServer.kill('SIGTERM');
    }
}

run().catch((error) => {
    console.error('[stress-ui] failed:', error.message);
    process.exit(1);
});
