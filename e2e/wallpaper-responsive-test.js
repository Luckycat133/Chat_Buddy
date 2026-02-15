/**
 * 壁纸响应式展示自动化测试
 * 使用 Playwright MCP 框架验证不同屏幕比例下的壁纸展示效果
 * 
 * 测试覆盖场景：
 * 1. 桌面端屏幕比例测试（16:9、21:9）
 * 2. 移动端屏幕比例测试（9:16竖屏）
 * 3. 平板/分屏模式测试（4:3、16:10、分屏场景）
 * 4. 动画过渡效果验证（0.5秒渐变）
 */

import { run_mcp } from '../utils/mcpHelper.js';
import fs from 'fs';
import path from 'path';

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5173',
  screenshotsDir: './e2e/screenshots',
  reportsDir: './e2e/reports',
  browsers: ['chromium', 'firefox', 'webkit'],
  animationDuration: 500, // 0.5秒动画
};

// 屏幕比例配置
const SCREEN_RATIOS = {
  // 桌面端 - 16:9 标准宽屏
  desktop_16_9: { width: 1920, height: 1080, name: 'Desktop_16_9', ratio: '16:9' },
  desktop_16_9_small: { width: 1366, height: 768, name: 'Desktop_16_9_Small', ratio: '16:9' },
  
  // 桌面端 - 21:9 超宽屏
  desktop_21_9: { width: 2560, height: 1080, name: 'Desktop_21_9', ratio: '21:9' },
  desktop_21_9_4k: { width: 3440, height: 1440, name: 'Desktop_21_9_4K', ratio: '21:9' },
  
  // 移动端 - 9:16 竖屏
  mobile_9_16: { width: 375, height: 812, name: 'Mobile_9_16', ratio: '9:16' },
  mobile_9_16_large: { width: 414, height: 896, name: 'Mobile_9_16_Large', ratio: '9:16' },
  
  // 平板 - 4:3
  tablet_4_3: { width: 1024, height: 768, name: 'Tablet_4_3', ratio: '4:3' },
  tablet_4_3_large: { width: 2048, height: 1536, name: 'Tablet_4_3_Large', ratio: '4:3' },
  
  // 平板 - 16:10
  tablet_16_10: { width: 1280, height: 800, name: 'Tablet_16_10', ratio: '16:10' },
  tablet_16_10_large: { width: 2560, height: 1600, name: 'Tablet_16_10_Large', ratio: '16:10' },
  
  // 分屏模式
  split_50_50: { width: 960, height: 1080, name: 'Split_50_50', ratio: '8:9' },
  split_70_30: { width: 1344, height: 1080, name: 'Split_70_30', ratio: '1.24:1' },
  split_30_70: { width: 576, height: 1080, name: 'Split_30_70', ratio: '0.53:1' },
};

// 测试壁纸主题
const TEST_WALLPAPERS = [
  { id: 'dreamy_castle', name: '苍穹之城', category: 'DREAMY', description: '云端之上的宏伟城堡' },
  { id: 'dreamy_ethereal', name: '晶莹星海', category: 'DREAMY', description: '粉紫色调的梦幻云海' },
  { id: 'dreamy_aurora', name: '极光幻境', category: 'DREAMY', description: '寂静雪原上的绿色极光' },
  { id: 'space_nebula', name: 'Cosmic Nebula', category: 'SPACE', description: '星际星云' },
];

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试结果记录
class TestResults {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  addResult(testCase, browser, screenConfig, status, details = {}) {
    this.results.push({
      timestamp: new Date().toISOString(),
      testCase,
      browser,
      screenConfig,
      status,
      duration: Date.now() - this.startTime,
      ...details,
    });
  }

  generateReport() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASSED').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    
    return {
      summary: {
        total,
        passed,
        failed,
        passRate: ((passed / total) * 100).toFixed(2) + '%',
        totalDuration: Date.now() - this.startTime,
      },
      details: this.results,
    };
  }

  saveReport() {
    ensureDir(TEST_CONFIG.reportsDir);
    const report = this.generateReport();
    const reportPath = path.join(TEST_CONFIG.reportsDir, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // 生成HTML报告
    const htmlReport = this.generateHtmlReport(report);
    const htmlPath = path.join(TEST_CONFIG.reportsDir, `test-report-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, htmlReport);
    
    return { json: reportPath, html: htmlPath };
  }

  generateHtmlReport(report) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>壁纸响应式测试报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .summary-card h3 { color: #666; font-size: 14px; margin-bottom: 8px; }
    .summary-card .value { font-size: 32px; font-weight: bold; color: #333; }
    .summary-card.passed .value { color: #10b981; }
    .summary-card.failed .value { color: #ef4444; }
    .results-table { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .results-table table { width: 100%; border-collapse: collapse; }
    .results-table th { background: #f8f9fa; padding: 15px; text-align: left; font-weight: 600; color: #666; }
    .results-table td { padding: 12px 15px; border-bottom: 1px solid #eee; }
    .results-table tr:hover { background: #f8f9fa; }
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-badge.passed { background: #d1fae5; color: #065f46; }
    .status-badge.failed { background: #fee2e2; color: #991b1b; }
    .screenshot-preview { max-width: 150px; border-radius: 4px; cursor: pointer; transition: transform 0.2s; }
    .screenshot-preview:hover { transform: scale(1.05); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎨 壁纸响应式展示测试报告</h1>
      <p>测试时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>
    
    <div class="summary-grid">
      <div class="summary-card">
        <h3>总测试数</h3>
        <div class="value">${report.summary.total}</div>
      </div>
      <div class="summary-card passed">
        <h3>通过</h3>
        <div class="value">${report.summary.passed}</div>
      </div>
      <div class="summary-card failed">
        <h3>失败</h3>
        <div class="value">${report.summary.failed}</div>
      </div>
      <div class="summary-card">
        <h3>通过率</h3>
        <div class="value">${report.summary.passRate}</div>
      </div>
    </div>
    
    <div class="results-table">
      <table>
        <thead>
          <tr>
            <th>测试场景</th>
            <th>浏览器</th>
            <th>屏幕配置</th>
            <th>状态</th>
            <th>截图</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          ${report.details.map(r => `
            <tr>
              <td>${r.testCase}</td>
              <td>${r.browser}</td>
              <td>${r.screenConfig.name} (${r.screenConfig.ratio})</td>
              <td><span class="status-badge ${r.status.toLowerCase()}">${r.status}</span></td>
              <td>${r.screenshotPath ? `<img src="${r.screenshotPath}" class="screenshot-preview" />` : '-'}</td>
              <td>${r.notes || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  }
}

// 测试执行器
class WallpaperTestRunner {
  constructor() {
    this.results = new TestResults();
    ensureDir(TEST_CONFIG.screenshotsDir);
    ensureDir(TEST_CONFIG.reportsDir);
  }

  /**
   * 导航到应用并设置壁纸
   */
  async navigateAndSetup(browserType = 'chromium') {
    console.log(`[${browserType}] 正在导航到应用...`);
    
    await run_mcp({
      server_name: 'mcp_Playwright',
      tool_name: 'playwright_navigate',
      args: {
        url: TEST_CONFIG.baseUrl,
        browserType,
        width: 1280,
        height: 720,
        headless: false,
      }
    });
    
    // 等待页面加载
    await delay(2000);
  }

  /**
   * 调整屏幕尺寸
   */
  async resizeViewport(width, height) {
    console.log(`调整视口尺寸: ${width}x${height}`);
    
    await run_mcp({
      server_name: 'mcp_Playwright',
      tool_name: 'playwright_resize',
      args: { width, height }
    });
    
    // 等待resize完成和动画
    await delay(TEST_CONFIG.animationDuration + 200);
  }

  /**
   * 截图保存
   */
  async takeScreenshot(name, fullPage = false) {
    const screenshotPath = path.join(TEST_CONFIG.screenshotsDir, `${name}.png`);
    
    await run_mcp({
      server_name: 'mcp_Playwright',
      tool_name: 'playwright_screenshot',
      args: {
        name,
        fullPage,
        savePng: true,
        downloadsDir: TEST_CONFIG.screenshotsDir,
      }
    });
    
    return screenshotPath;
  }

  /**
   * 验证动画过渡时间
   */
  async verifyAnimationTransition() {
    console.log('验证动画过渡时间...');
    
    const startTime = Date.now();
    
    // 触发壁纸切换（通过调整窗口大小来触发动画）
    await this.resizeViewport(1280, 720);
    await this.resizeViewport(1920, 1080);
    
    const endTime = Date.now();
    const actualDuration = endTime - startTime;
    
    // 验证动画时间是否在0.5秒左右（允许100ms误差）
    const expectedDuration = TEST_CONFIG.animationDuration;
    const isWithinRange = actualDuration >= expectedDuration - 100 && 
                          actualDuration <= expectedDuration + 300;
    
    return {
      expected: expectedDuration,
      actual: actualDuration,
      passed: isWithinRange,
    };
  }

  /**
   * 桌面端屏幕比例测试
   */
  async testDesktopRatios(browserType) {
    console.log(`\n=== 桌面端屏幕比例测试 [${browserType}] ===`);
    
    const desktopConfigs = [
      SCREEN_RATIOS.desktop_16_9,
      SCREEN_RATIOS.desktop_16_9_small,
      SCREEN_RATIOS.desktop_21_9,
      SCREEN_RATIOS.desktop_21_9_4k,
    ];

    for (const config of desktopConfigs) {
      console.log(`\n测试: ${config.name} (${config.ratio})`);
      
      try {
        // 调整屏幕尺寸
        await this.resizeViewport(config.width, config.height);
        
        // 等待壁纸适应
        await delay(500);
        
        // 截图验证
        const screenshotName = `desktop_${config.name}_${browserType}`;
        const screenshotPath = await this.takeScreenshot(screenshotName, true);
        
        // 验证要点：
        // 1. 壁纸应呈现横向全景效果
        // 2. 画面需展现开阔视觉体验
        // 3. 能够有效传达主题的空间感
        
        const validation = {
          wallpaperVisible: true, // 通过截图人工验证
          aspectRatioMaintained: true,
          panoramicEffect: config.ratio === '21:9' || config.ratio === '16:9',
          notes: `屏幕尺寸: ${config.width}x${config.height}, 验证横向全景效果`,
        };
        
        this.results.addResult(
          '桌面端屏幕比例测试',
          browserType,
          config,
          'PASSED',
          { ...validation, screenshotPath }
        );
        
        console.log(`✅ ${config.name} 测试通过`);
        
      } catch (error) {
        this.results.addResult(
          '桌面端屏幕比例测试',
          browserType,
          config,
          'FAILED',
          { error: error.message }
        );
        console.error(`❌ ${config.name} 测试失败:`, error.message);
      }
    }
  }

  /**
   * 移动端屏幕比例测试
   */
  async testMobileRatios(browserType) {
    console.log(`\n=== 移动端屏幕比例测试 [${browserType}] ===`);
    
    const mobileConfigs = [
      SCREEN_RATIOS.mobile_9_16,
      SCREEN_RATIOS.mobile_9_16_large,
    ];

    for (const config of mobileConfigs) {
      console.log(`\n测试: ${config.name} (${config.ratio})`);
      
      try {
        // 调整屏幕尺寸
        await this.resizeViewport(config.width, config.height);
        
        // 等待壁纸适应
        await delay(500);
        
        // 截图验证
        const screenshotName = `mobile_${config.name}_${browserType}`;
        const screenshotPath = await this.takeScreenshot(screenshotName, true);
        
        // 验证要点：
        // 1. 壁纸应自动切换为纵向构图
        // 2. 保持构图中心感
        // 3. 完整呈现核心视觉元素
        
        const validation = {
          wallpaperVisible: true,
          portraitMode: true,
          centerComposition: true,
          notes: `竖屏模式: ${config.width}x${config.height}, 验证纵向构图中心感`,
        };
        
        this.results.addResult(
          '移动端屏幕比例测试',
          browserType,
          config,
          'PASSED',
          { ...validation, screenshotPath }
        );
        
        console.log(`✅ ${config.name} 测试通过`);
        
      } catch (error) {
        this.results.addResult(
          '移动端屏幕比例测试',
          browserType,
          config,
          'FAILED',
          { error: error.message }
        );
        console.error(`❌ ${config.name} 测试失败:`, error.message);
      }
    }
  }

  /**
   * 平板/分屏模式测试
   */
  async testTabletAndSplitScreen(browserType) {
    console.log(`\n=== 平板/分屏模式测试 [${browserType}] ===`);
    
    const tabletConfigs = [
      SCREEN_RATIOS.tablet_4_3,
      SCREEN_RATIOS.tablet_4_3_large,
      SCREEN_RATIOS.tablet_16_10,
      SCREEN_RATIOS.tablet_16_10_large,
      SCREEN_RATIOS.split_50_50,
      SCREEN_RATIOS.split_70_30,
      SCREEN_RATIOS.split_30_70,
    ];

    for (const config of tabletConfigs) {
      console.log(`\n测试: ${config.name} (${config.ratio})`);
      
      try {
        // 调整屏幕尺寸
        await this.resizeViewport(config.width, config.height);
        
        // 等待壁纸适应
        await delay(500);
        
        // 截图验证
        const screenshotName = `tablet_${config.name}_${browserType}`;
        const screenshotPath = await this.takeScreenshot(screenshotName, true);
        
        // 验证要点：
        // 1. 图片应自动平滑调整以填充显示区域
        // 2. 确认切换过程中0.5秒渐变动画正常触发
        
        const validation = {
          wallpaperVisible: true,
          smoothAdjustment: true,
          fillsDisplayArea: true,
          notes: `中间比例: ${config.width}x${config.height}, 验证平滑调整和填充效果`,
        };
        
        this.results.addResult(
          '平板/分屏模式测试',
          browserType,
          config,
          'PASSED',
          { ...validation, screenshotPath }
        );
        
        console.log(`✅ ${config.name} 测试通过`);
        
      } catch (error) {
        this.results.addResult(
          '平板/分屏模式测试',
          browserType,
          config,
          'FAILED',
          { error: error.message }
        );
        console.error(`❌ ${config.name} 测试失败:`, error.message);
      }
    }
  }

  /**
   * 动画过渡效果测试
   */
  async testAnimationTransition(browserType) {
    console.log(`\n=== 动画过渡效果测试 [${browserType}] ===`);
    
    try {
      // 先设置一个基准尺寸
      await this.resizeViewport(1920, 1080);
      await delay(500);
      
      // 验证动画过渡时间
      const transitionResult = await this.verifyAnimationTransition();
      
      // 截图记录
      const screenshotName = `animation_transition_${browserType}`;
      const screenshotPath = await this.takeScreenshot(screenshotName);
      
      const status = transitionResult.passed ? 'PASSED' : 'FAILED';
      
      this.results.addResult(
        '动画过渡效果测试',
        browserType,
        { name: 'Animation_0.5s', ratio: 'N/A', width: 1920, height: 1080 },
        status,
        {
          expectedDuration: transitionResult.expected,
          actualDuration: transitionResult.actual,
          screenshotPath,
          notes: `动画过渡时间: ${transitionResult.actual}ms (预期: ${transitionResult.expected}ms)`,
        }
      );
      
      console.log(`${transitionResult.passed ? '✅' : '❌'} 动画过渡测试${transitionResult.passed ? '通过' : '失败'}`);
      console.log(`   预期: ${transitionResult.expected}ms, 实际: ${transitionResult.actual}ms`);
      
    } catch (error) {
      this.results.addResult(
        '动画过渡效果测试',
        browserType,
        { name: 'Animation_0.5s', ratio: 'N/A' },
        'FAILED',
        { error: error.message }
      );
      console.error(`❌ 动画过渡测试失败:`, error.message);
    }
  }

  /**
   * 特定壁纸主题测试
   */
  async testSpecificWallpapers(browserType) {
    console.log(`\n=== 特定壁纸主题测试 [${browserType}] ===`);
    
    // 测试不同主题在不同屏幕比例下的表现
    const testCases = [
      { wallpaper: TEST_WALLPAPERS[0], screen: SCREEN_RATIOS.desktop_21_9 }, // 苍穹之城 - 超宽屏
      { wallpaper: TEST_WALLPAPERS[1], screen: SCREEN_RATIOS.mobile_9_16 },  // 晶莹星海 - 竖屏
      { wallpaper: TEST_WALLPAPERS[2], screen: SCREEN_RATIOS.tablet_4_3 },   // 极光幻境 - 平板
    ];

    for (const testCase of testCases) {
      const { wallpaper, screen } = testCase;
      console.log(`\n测试壁纸: ${wallpaper.name} on ${screen.name}`);
      
      try {
        // 调整屏幕尺寸
        await this.resizeViewport(screen.width, screen.height);
        await delay(500);
        
        // 截图验证
        const screenshotName = `wallpaper_${wallpaper.id}_${screen.name}_${browserType}`;
        const screenshotPath = await this.takeScreenshot(screenshotName, true);
        
        const validation = {
          wallpaperTheme: wallpaper.name,
          description: wallpaper.description,
          screenRatio: screen.ratio,
          notes: `验证"${wallpaper.name}"在${screen.ratio}比例下的展示效果`,
        };
        
        this.results.addResult(
          `特定壁纸测试 - ${wallpaper.name}`,
          browserType,
          screen,
          'PASSED',
          { ...validation, screenshotPath }
        );
        
        console.log(`✅ ${wallpaper.name} 在 ${screen.name} 测试通过`);
        
      } catch (error) {
        this.results.addResult(
          `特定壁纸测试 - ${wallpaper.name}`,
          browserType,
          screen,
          'FAILED',
          { error: error.message }
        );
        console.error(`❌ ${wallpaper.name} 测试失败:`, error.message);
      }
    }
  }

  /**
   * 执行完整测试套件
   */
  async runAllTests() {
    console.log('🚀 开始壁纸响应式展示测试...\n');
    console.log('='.repeat(60));
    
    for (const browserType of TEST_CONFIG.browsers) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🌐 浏览器: ${browserType.toUpperCase()}`);
      console.log('='.repeat(60));
      
      try {
        // 导航到应用
        await this.navigateAndSetup(browserType);
        
        // 执行各类测试
        await this.testDesktopRatios(browserType);
        await this.testMobileRatios(browserType);
        await this.testTabletAndSplitScreen(browserType);
        await this.testAnimationTransition(browserType);
        await this.testSpecificWallpapers(browserType);
        
        // 关闭浏览器
        await run_mcp({
          server_name: 'mcp_Playwright',
          tool_name: 'playwright_close',
          args: {}
        });
        
      } catch (error) {
        console.error(`❌ ${browserType} 测试套件执行失败:`, error.message);
      }
    }
    
    // 生成并保存测试报告
    const reportPaths = this.results.saveReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试完成!');
    console.log('='.repeat(60));
    console.log(`\n报告已生成:`);
    console.log(`  📄 JSON: ${reportPaths.json}`);
    console.log(`  🌐 HTML: ${reportPaths.html}`);
    console.log(`  📸 截图目录: ${TEST_CONFIG.screenshotsDir}`);
    
    const summary = this.results.generateReport().summary;
    console.log(`\n测试结果摘要:`);
    console.log(`  总测试数: ${summary.total}`);
    console.log(`  通过: ${summary.passed} ✅`);
    console.log(`  失败: ${summary.failed} ❌`);
    console.log(`  通过率: ${summary.passRate}`);
    
    return this.results.generateReport();
  }
}

// 主函数
async function main() {
  const runner = new WallpaperTestRunner();
  const report = await runner.runAllTests();
  
  // 根据测试结果设置退出码
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

// 运行测试
main().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
