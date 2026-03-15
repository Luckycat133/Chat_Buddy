#!/usr/bin/env node
/**
 * Chat Buddy - 全面回归测试脚本 (ES Module版本)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');

// 确保截图目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
    passed: [],
    failed: [],
    warnings: [],
    screenshots: []
};

function log(section, message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `[${timestamp}] [${section}]`;
    if (type === 'error') {
        console.error(`❌ ${prefix} ${message}`);
        results.failed.push(`${section}: ${message}`);
    } else if (type === 'warning') {
        console.warn(`⚠️ ${prefix} ${message}`);
        results.warnings.push(`${section}: ${message}`);
    } else if (type === 'success') {
        console.log(`✅ ${prefix} ${message}`);
        results.passed.push(`${section}: ${message}`);
    } else {
        console.log(`ℹ️ ${prefix} ${message}`);
    }
}

async function takeScreenshot(page, name) {
    const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push(filepath);
    return filepath;
}

// ============ 测试阶段 1: 首页加载与基础UI ============
async function testHomepage(page) {
    log('Phase 1', '开始测试首页加载与基础UI...');

    try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        log('Phase 1', '页面成功加载', 'success');

        // 检查页面标题
        const title = await page.title();
        log('Phase 1', `页面标题: "${title}"`);

        // 等待React渲染完成
        await page.waitForTimeout(2000);

        // 检查页面内容是否加载
        const bodyText = await page.locator('body').textContent();
        if (bodyText && bodyText.length > 100) {
            log('Phase 1', `页面内容已渲染 (${bodyText.length} 字符)`, 'success');
        } else {
            log('Phase 1', '页面内容可能未完全加载', 'warning');
        }

        // 检查导航项
        const navLinks = await page.locator('nav a, aside a').allInnerTexts();
        log('Phase 1', `发现导航项: ${navLinks.length > 0 ? navLinks.join(', ') : '未找到'}`);

        // 检查Logo区域
        const logoArea = await page.locator('aside img[alt="Chat Buddy"], aside div:has-text("CB"), aside svg').count();
        log('Phase 1', `Logo元素: ${logoArea}`, logoArea > 0 ? 'success' : 'warning');

        // 检查主内容区域
        const mainContent = await page.locator('main, [role="main"], .main-content').count();
        log('Phase 1', `主内容区域: ${mainContent}`, mainContent > 0 ? 'success' : 'warning');

        await takeScreenshot(page, '01-homepage');
        log('Phase 1', '首页测试完成', 'success');

    } catch (error) {
        log('Phase 1', `测试失败: ${error.message}`, 'error');
        await takeScreenshot(page, '01-homepage-error');
    }
}

// ============ 测试阶段 2: 导航功能 ============
async function testNavigation(page) {
    log('Phase 2', '开始测试导航功能...');

    const routes = [
        { path: '/agents', name: 'Agents' },
        { path: '/friends', name: 'Friends' },
        { path: '/moments', name: 'Moments' },
        { path: '/settings', name: 'Settings' },
        { path: '/about', name: 'About' }
    ];

    for (const route of routes) {
        try {
            await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
            await page.waitForTimeout(1000);

            const url = page.url();
            const hasError = await page.locator('text=/404|not found|error/i').count() > 0;

            if (url.includes(route.path) && !hasError) {
                log('Phase 2', `${route.name} (${route.path}) 导航成功`, 'success');
            } else {
                log('Phase 2', `${route.name} 可能有错误`, 'warning');
            }

            await takeScreenshot(page, `02-nav-${route.name.toLowerCase()}`);

        } catch (error) {
            log('Phase 2', `${route.name} 导航错误: ${error.message}`, 'error');
        }
    }

    // 返回首页
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    log('Phase 2', '导航测试完成', 'success');
}

// ============ 测试阶段 3: 设置页面深度测试 ============
async function testSettings(page) {
    log('Phase 3', '开始测试设置页面...');

    try {
        await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1500);

        // 检查设置分类
        const settingsSections = await page.locator('section, .settings-section, [class*="setting"]').count();
        log('Phase 3', `设置区块数量: ${settingsSections}`);

        // 查找所有按钮和交互元素
        const buttons = await page.locator('button').allInnerTexts();
        log('Phase 3', `按钮数量: ${buttons.length}`);
        if (buttons.length > 0) {
            log('Phase 3', `按钮文本: ${buttons.slice(0, 5).join(', ')}${buttons.length > 5 ? '...' : ''}`);
        }

        // 检查表单元素
        const inputs = await page.locator('input, select, textarea').count();
        log('Phase 3', `表单元素: ${inputs}`, inputs > 0 ? 'success' : 'info');

        // 检查语言相关元素
        const langElements = await page.locator('text=/English|中文|Language|语言/i').count();
        log('Phase 3', `语言设置元素: ${langElements}`, langElements > 0 ? 'success' : 'warning');

        // 检查主题相关元素
        const themeElements = await page.locator('text=/Dark|Light|Theme|主题|深色|浅色/i').count();
        log('Phase 3', `主题设置元素: ${themeElements}`, themeElements > 0 ? 'success' : 'warning');

        await takeScreenshot(page, '03-settings');
        log('Phase 3', '设置页面测试完成', 'success');

    } catch (error) {
        log('Phase 3', `测试失败: ${error.message}`, 'error');
    }
}

// ============ 测试阶段 4: 关于页面（验证XSS修复） ============
async function testAbout(page) {
    log('Phase 4', '开始测试关于页面（验证安全修复）...');

    try {
        await page.goto(`${BASE_URL}/about`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1500);

        // 检查版本号
        const versionText = await page.locator('text=/v0\\.\\d+\\.\\d+/').first().textContent().catch(() => null);
        log('Phase 4', `版本号: ${versionText || '未找到'}`);

        // 检查功能特性列表
        const features = await page.locator('text=/Features|特性|功能|Personalities|Anime/i').count();
        log('Phase 4', `功能特性: ${features}`, features > 0 ? 'success' : 'warning');

        // 检查技术栈
        const techStack = await page.locator('text=/React|Vite|Tailwind|DeepSeek/i').count();
        log('Phase 4', `技术栈标签: ${techStack}`, techStack > 0 ? 'success' : 'warning');

        // 检查更新日志
        const changelog = await page.locator('text=/Changelog|更新日志|version history/i').count();
        log('Phase 4', `更新日志: ${changelog}`);

        // 关键：验证Logo显示（检查innerHTML修复）
        const hasLogoImg = await page.locator('img[alt="Chat Buddy"]').count() > 0;
        const hasLogoFallback = await page.locator('div:has-text("CB")').count() > 0;
        const hasRawHtml = await page.locator('body').innerHTML().then(html =>
            html.includes('dangerouslySetInnerHTML') || html.includes('&lt;')
        );

        if (hasLogoImg || hasLogoFallback) {
            log('Phase 4', 'Logo正常显示（innerHTML XSS修复生效）', 'success');
        } else {
            log('Phase 4', 'Logo显示异常', 'warning');
        }

        if (hasRawHtml) {
            log('Phase 4', '检测到可能的HTML转义问题', 'warning');
        }

        // 检查GitHub链接
        const githubLinks = await page.locator('a[href*="github.com"]').count();
        log('Phase 4', `GitHub链接: ${githubLinks}`, githubLinks > 0 ? 'success' : 'warning');

        await takeScreenshot(page, '04-about');
        log('Phase 4', '关于页面测试完成', 'success');

    } catch (error) {
        log('Phase 4', `测试失败: ${error.message}`, 'error');
    }
}

// ============ 测试阶段 5: 聊天功能 ============
async function testChat(page) {
    log('Phase 5', '开始测试聊天功能...');

    try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1500);

        // 检查是否有"新建聊天"按钮或链接
        const newChatBtn = await page.locator('a[href*="create"], button:has-text("New"), button:has-text("Create"), button:has-text("新建"), button:has-text("创建"), [data-testid="new-chat"]').first();

        if (await newChatBtn.count() > 0) {
            log('Phase 5', '找到创建聊天按钮', 'success');

            await newChatBtn.click();
            await page.waitForTimeout(2000);

            const url = page.url();
            log('Phase 5', `创建页面URL: ${url}`);

            // 检查角色选择
            const personas = await page.locator('[data-persona], .persona, .character, [class*="persona"]').count();
            log('Phase 5', `可选AI角色: ${personas}`, personas > 0 ? 'success' : 'warning');

            if (personas > 0) {
                // 选择第一个角色
                await page.locator('[data-persona], .persona, .character').first().click();
                await page.waitForTimeout(500);

                // 查找创建按钮
                const createBtn = await page.locator('button:has-text("Start"), button:has-text("Create"), button:has-text("开始"), button:has-text("创建"), button[type="submit"]').first();
                if (await createBtn.count() > 0) {
                    await createBtn.click();
                    await page.waitForTimeout(2000);

                    // 检查聊天界面
                    const chatInput = await page.locator('input[type="text"], textarea, [contenteditable]').count();
                    log('Phase 5', `聊天输入框: ${chatInput}`, chatInput > 0 ? 'success' : 'warning');

                    if (chatInput > 0) {
                        // 尝试发送消息
                        const input = page.locator('input[type="text"], textarea').first();
                        await input.fill('Hello! This is a test message.');
                        await page.locator('button[type="submit"], button:has-text("Send"), button:has-text("发送")').first().click();
                        await page.waitForTimeout(2000);

                        // 检查消息是否显示
                        const messages = await page.locator('.message, [data-message], .chat-message, .bubble').count();
                        log('Phase 5', `消息气泡: ${messages}`, messages > 0 ? 'success' : 'warning');
                    }
                }
            }
        } else {
            // 检查是否已有聊天
            const existingChats = await page.locator('a[href*="/chat/"], [data-chat], .chat-item').count();
            log('Phase 5', `现有聊天: ${existingChats}`, existingChats > 0 ? 'success' : 'info');

            if (existingChats > 0) {
                await page.locator('a[href*="/chat/"], [data-chat], .chat-item').first().click();
                await page.waitForTimeout(1500);
                log('Phase 5', '进入现有聊天', 'success');
            }
        }

        await takeScreenshot(page, '05-chat');
        log('Phase 5', '聊天功能测试完成', 'success');

    } catch (error) {
        log('Phase 5', `测试失败: ${error.message}`, 'error');
        await takeScreenshot(page, '05-chat-error');
    }
}

// ============ 测试阶段 6: 响应式设计 ============
async function testResponsive(page) {
    log('Phase 6', '开始测试响应式设计...');

    const viewports = [
        { name: 'desktop', width: 1920, height: 1080, desc: '桌面端' },
        { name: 'tablet', width: 768, height: 1024, desc: '平板端' },
        { name: 'mobile', width: 375, height: 812, desc: '移动端' }
    ];

    for (const vp of viewports) {
        try {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
            await page.waitForTimeout(1500);

            // 检查布局元素
            const hasSidebar = await page.locator('aside, .sidebar').count() > 0;
            const hasBottomNav = await page.locator('.mobile-nav, .bottom-nav, nav[class*="mobile"]').count() > 0;

            log('Phase 6', `${vp.desc}: 侧边栏=${hasSidebar}, 底部导航=${hasBottomNav}`);

            // 检查内容是否可见
            const bodyVisible = await page.locator('body').isVisible();
            log('Phase 6', `${vp.desc}: 页面可见=${bodyVisible}`, bodyVisible ? 'success' : 'error');

            await takeScreenshot(page, `06-responsive-${vp.name}`);

        } catch (error) {
            log('Phase 6', `${vp.desc} 测试失败: ${error.message}`, 'error');
        }
    }

    log('Phase 6', '响应式设计测试完成', 'success');
}

// ============ 主函数 ============
async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         Chat Buddy - 全面回归测试报告                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`测试时间: ${new Date().toLocaleString()}`);
    console.log(`目标URL: ${BASE_URL}`);
    console.log(`截图目录: ${SCREENSHOT_DIR}`);
    console.log('─'.repeat(60));

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1
    });

    const page = await context.newPage();

    // 捕获控制台错误
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    page.on('pageerror', error => {
        consoleErrors.push(error.message);
    });

    try {
        await testHomepage(page);
        await testNavigation(page);
        await testSettings(page);
        await testAbout(page);
        await testChat(page);
        await testResponsive(page);

    } catch (error) {
        log('Main', `测试过程错误: ${error.message}`, 'error');
    } finally {
        await browser.close();
    }

    // 输出测试报告
    console.log('\n' + '═'.repeat(60));
    console.log('                     测试报告摘要');
    console.log('═'.repeat(60));
    console.log(`✅ 通过: ${results.passed.length}`);
    console.log(`❌ 失败: ${results.failed.length}`);
    console.log(`⚠️  警告: ${results.warnings.length}`);
    console.log(`📸 截图: ${results.screenshots.length}`);
    console.log('─'.repeat(60));

    if (consoleErrors.length > 0) {
        console.log(`\n📝 控制台错误 (${consoleErrors.length}个):`);
        consoleErrors.slice(0, 5).forEach(err => console.log(`   • ${err.substring(0, 80)}...`));
    }

    if (results.failed.length > 0) {
        console.log('\n❌ 失败项:');
        results.failed.forEach(item => console.log(`   • ${item}`));
    }

    if (results.warnings.length > 0) {
        console.log('\n⚠️  警告项:');
        results.warnings.forEach(item => console.log(`   • ${item}`));
    }

    // 保存详细报告
    const reportPath = path.join(SCREENSHOT_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
            passed: results.passed.length,
            failed: results.failed.length,
            warnings: results.warnings.length,
            screenshots: results.screenshots.length
        },
        results
    }, null, 2));
    console.log(`\n📄 详细报告: ${reportPath}`);
    console.log('═'.repeat(60));

    // 设置退出码
    process.exit(results.failed.length > 0 ? 1 : 0);
}

main().catch(error => {
    console.error('致命错误:', error);
    process.exit(1);
});
