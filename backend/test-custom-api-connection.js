#!/usr/bin/env node
/**
 * 通用自定义 API 连通性测试脚本
 * 支持任何兼容 OpenAI 格式的 API
 * 用法：
 *   node test-custom-api-connection.js
 * 环境变量：
 *   CUSTOM_API_URL   - 必需，如 https://api.openai.com/v1/chat/completions
 *   CUSTOM_API_KEY   - 必需
 *   CUSTOM_API_MODEL - 可选，默认 gpt-3.5-turbo
 */

const https = require('https');
const http = require('http');

// 读取环境变量
const apiUrl = process.env.CUSTOM_API_URL;
const apiKey = process.env.CUSTOM_API_KEY;
const model = process.env.CUSTOM_API_MODEL || 'gpt-3.5-turbo';

if (!apiUrl || !apiKey) {
  console.error('❌ 缺少必要环境变量：');
  console.error('   CUSTOM_API_URL 与 CUSTOM_API_KEY 必须设置');
  process.exit(1);
}

console.log('🔍 正在测试 API 连通性...');
console.log(`   URL: ${apiUrl}`);
console.log(`   Model: ${model}`);

const requestData = JSON.stringify({
  model,
  messages: [
    { role: 'user', content: 'Hello, this is a connectivity test.' }
  ],
  max_tokens: 10,
  temperature: 0
});

const url = new URL(apiUrl);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData),
    'Authorization': `Bearer ${apiKey}`
  }
};

const req = client.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const json = JSON.parse(body);
        console.log('✅ API 连通成功！');
        console.log(`   回复预览: ${json.choices?.[0]?.message?.content || '[无内容]'}`);
      } catch {
        console.log('⚠️ 返回非 JSON 数据，但连接成功');
        console.log('   原始响应:', body.slice(0, 200));
      }
    } else {
      console.error('❌ API 返回错误：');
      console.error(body);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ 网络错误:', err.message);
});

req.setTimeout(10000, () => {
  console.error('❌ 请求超时（10 秒）');
  req.destroy();
});

req.write(requestData);
req.end();