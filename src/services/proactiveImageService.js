/**
 * proactiveImageService.js
 * ─────────────────────────────────────────────────────────────────────
 * AI 主动图像生成服务
 *
 * 功能：
 *  1. 分析对话上下文，智能判断是否应该主动生成图片
 *  2. 根据场景自动选择最适合的图片风格和宽高比
 *  3. 调用 MiniMax image-01 模型生成高质量图片
 *  4. 记录生成历史与性能统计
 *
 * 触发逻辑（任满足一条）：
 *  - 用户明确要求看图 / 描述场景 → score ≥ 30
 *  - AI 回复中包含"看看"、"图片"、"画" 等视觉词 → score ≥ 20
 *  - 对话主题为旅行 / 美食 / 创作 / 时尚等视觉强话题 → score ≥ 25
 *  - 情感表达"开心/难过/兴奋" + LEN > 60 → score ≥ 18
 *  - 随机探索（每 20 条消息一次）→ score ≥ 15
 */

import { generateMomentsImage, isMiniMaxConfigured } from './minimaxService';

// ─── 常量 ─────────────────────────────────────────────────────────────────────

/** 触发图片生成的最低置信分 */
const TRIGGER_SCORE_THRESHOLD = 20;

/** 同一对话最短冷却（毫秒）— 防止频繁生成 */
const COOLDOWN_MS = 3 * 60 * 1000; // 3 分钟

/** 统计存储 key */
const STATS_KEY = 'chatbuddy_imggen_stats';

// 视觉触发关键词（中/英）
const VISUAL_TRIGGER_KEYWORDS = {
  zh: [
    '看看', '看一下', '图片', '照片', '截图', '拍', '画', '展示', '发图',
    '长什么样', '描述一下', '帮我画', '生成图', '图像', '可视化', '图表',
  ],
  en: [
    'show me', 'picture', 'image', 'photo', 'draw', 'visualize', 'generate image',
    'what does it look like', 'thumbnail', 'chart', 'graph', 'diagram',
  ],
};

// 视觉强话题词（权重较低，作为辅助信号）
const VISUAL_TOPIC_KEYWORDS = {
  zh: ['旅行', '美食', '穿搭', '时尚', '设计', '插画', '创作', '艺术', '摄影', '景色', '花', '动漫', '猫', '狗'],
  en: ['travel', 'food', 'fashion', 'design', 'art', 'photography', 'anime', 'scenery', 'outfit', 'cat', 'dog'],
};

// 情感词（结合长回复时加分）
const EMOTION_KEYWORDS = {
  zh: ['好开心', '太棒了', '绝了', '美极了', '惊艳', '哇', '震惊', '感动', '悲伤', '思念'],
  en: ['amazing', 'beautiful', 'gorgeous', 'breathtaking', 'incredible', 'wonderful', 'lovely'],
};

// 图片风格 → 适合的话题和宽高比
export const STYLE_PRESETS = {
  scenic: {
    label: '风景写真',
    aspectRatio: '16:9',
    promptSuffix: 'cinematic landscape, wide angle, natural lighting, ultra detailed',
  },
  portrait: {
    label: '人物写真',
    aspectRatio: '9:16',
    promptSuffix: 'portrait photography, bokeh background, soft lighting',
  },
  food: {
    label: '美食摄影',
    aspectRatio: '4:3',
    promptSuffix: 'food photography, studio lighting, close-up, appetizing',
  },
  anime: {
    label: '动漫插画',
    aspectRatio: '1:1',
    promptSuffix: 'detailed anime illustration, high quality, vibrant colors',
  },
  concept: {
    label: '概念艺术',
    aspectRatio: '4:3',
    promptSuffix: 'concept art, digital painting, professional illustration',
  },
  general: {
    label: '通用',
    aspectRatio: '4:3',
    promptSuffix: 'high quality, detailed, professional photography',
  },
};

// ─── 统计持久化 ───────────────────────────────────────────────────────────────

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
  } catch (e) {
    console.warn('[proactiveImageService] Failed to load stats:', e?.message);
    return {};
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('[proactiveImageService] Failed to save stats (likely QuotaExceeded):', e?.message);
  }
}

function updateStats(chatId, persona, success, durationMs, triggerReason) {
  const stats = loadStats();
  const today = new Date().toISOString().slice(0, 10);

  if (!stats.daily) stats.daily = {};
  if (!stats.daily[today]) stats.daily[today] = { total: 0, success: 0, failed: 0 };

  stats.daily[today].total++;
  if (success) stats.daily[today].success++;
  else stats.daily[today].failed++;

  if (!stats.perChat) stats.perChat = {};
  if (!stats.perChat[chatId]) stats.perChat[chatId] = [];
  stats.perChat[chatId].push({
    ts: Date.now(),
    personaId: persona?.id,
    success,
    durationMs,
    triggerReason,
  });
  // 只保最近 50 条
  stats.perChat[chatId] = stats.perChat[chatId].slice(-50);

  stats.totalGenerated = (stats.totalGenerated || 0) + 1;
  stats.lastUpdated = Date.now();

  saveStats(stats);
}

/** 获取图片生成统计数据 */
export function getImageGenStats() {
  const stats = loadStats();
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalGenerated: stats.totalGenerated || 0,
    todayTotal: stats.daily?.[today]?.total || 0,
    todaySuccess: stats.daily?.[today]?.success || 0,
    todayFailed: stats.daily?.[today]?.failed || 0,
    daily: stats.daily || {},
    lastUpdated: stats.lastUpdated,
  };
}

// ─── 冷却管理 ─────────────────────────────────────────────────────────────────

const _cooldownMap = new Map(); // chatId → lastGenerateTime

function isOnCooldown(chatId) {
  const last = _cooldownMap.get(chatId) || 0;
  return Date.now() - last < COOLDOWN_MS;
}

function setCooldown(chatId) {
  _cooldownMap.set(chatId, Date.now());
}

// ─── 上下文分析 ───────────────────────────────────────────────────────────────

/**
 * 分析消息列表，返回图片生成置信分和触发原因
 * @param {Array}  messages   - 最近 N 条消息
 * @param {string} aiResponse - AI 当前回复内容
 * @returns {{ score: number, reason: string, style: string }}
 */
export function analyzeContextForImageGen(messages = [], aiResponse = '') {
  let score = 0;
  const reasons = [];

  const recentText = messages
    .slice(-6)
    .map((m) => m.content || '')
    .join(' ')
    .toLowerCase();

  const fullText = (recentText + ' ' + aiResponse).toLowerCase();
  const isZh = /[\u4e00-\u9fff]/.test(fullText);

  // 1. 明确视觉触发词（高权重）
  const visualHits = [
    ...(isZh ? VISUAL_TRIGGER_KEYWORDS.zh : []),
    ...VISUAL_TRIGGER_KEYWORDS.en,
  ].filter((kw) => fullText.includes(kw));

  if (visualHits.length > 0) {
    score += visualHits.length * 12;
    reasons.push(`视觉请求: ${visualHits.slice(0, 2).join(', ')}`);
  }

  // 2. 视觉话题（中权重）
  const topicHits = [
    ...(isZh ? VISUAL_TOPIC_KEYWORDS.zh : []),
    ...VISUAL_TOPIC_KEYWORDS.en,
  ].filter((kw) => fullText.includes(kw));

  if (topicHits.length > 0) {
    score += topicHits.length * 6;
    reasons.push(`视觉话题: ${topicHits.slice(0, 2).join(', ')}`);
  }

  // 3. 情感词 + 长文本（低权重）
  const emotionHits = [
    ...(isZh ? EMOTION_KEYWORDS.zh : []),
    ...EMOTION_KEYWORDS.en,
  ].filter((kw) => fullText.includes(kw));

  if (emotionHits.length > 0 && aiResponse.length > 60) {
    score += emotionHits.length * 4;
    reasons.push(`情感共鸣: ${emotionHits[0]}`);
  }

  // 4. AI 回复包含"图片"描述性短语
  if (/imagine|picture this|envision|visualize|look like/i.test(aiResponse)) {
    score += 10;
    reasons.push('AI 视觉描述');
  }

  // 5. 随机探索（低概率）— 无其他信号时最多加 8 分
  if (score < 5 && messages.length > 0 && messages.length % 20 === 0) {
    score += 8;
    reasons.push('探索性生成');
  }

  // 推断风格
  const style = inferStyle(fullText);

  return {
    score,
    reason: reasons.join(' | ') || '无明确触发',
    style,
    willTrigger: score >= TRIGGER_SCORE_THRESHOLD,
  };
}

/**
 * 根据对话文本推断最适合的图片风格
 */
function inferStyle(text) {
  if (/旅行|travel|风景|scenery|山|海|湖|森林|mountain|ocean|lake|forest/.test(text)) return 'scenic';
  if (/美食|food|餐厅|料理|甜点|dessert|restaurant/.test(text)) return 'food';
  if (/动漫|anime|manga|漫画|二次元/.test(text)) return 'anime';
  if (/穿搭|时尚|fashion|outfit|造型|portrait|人物/.test(text)) return 'portrait';
  if (/设计|design|艺术|art|概念|concept|创作/.test(text)) return 'concept';
  return 'general';
}

// ─── 主动图像生成 ──────────────────────────────────────────────────────────────

/**
 * 主动生成图片（由 AIPipeline 或 UI 调用）
 *
 * @param {string} chatId       - 当前聊天 ID
 * @param {Array}  messages     - 消息历史
 * @param {string} aiResponse   - AI 当前回复
 * @param {Object} persona      - AI 角色信息 { id, name, ... }
 * @param {Object} [options]
 * @param {string} [options.styleOverride]       - 强制指定风格 key
 * @param {string} [options.aspectRatioOverride] - 强制宽高比
 * @param {string} [options.promptOverride]      - 完全自定义 Prompt
 * @param {boolean}[options.force]               - 跳过冷却和阈值检查
 * @returns {Promise<null | { imageUrl, prompt, style, triggerReason, durationMs }>}
 */
export async function tryProactiveImageGen(chatId, messages, aiResponse, persona, options = {}) {
  if (!isMiniMaxConfigured()) return null;

  const { styleOverride, aspectRatioOverride, promptOverride, force = false } = options;

  // 冷却检查
  if (!force && isOnCooldown(chatId)) {
    console.log('[ProactiveImage] 冷却中，跳过');
    return null;
  }

  // 上下文分析
  const analysis = analyzeContextForImageGen(messages, aiResponse);
  if (!force && !analysis.willTrigger) {
    console.log(`[ProactiveImage] 分数 ${analysis.score} < ${TRIGGER_SCORE_THRESHOLD}，跳过`);
    return null;
  }

  const styleKey = styleOverride || analysis.style;
  const preset = STYLE_PRESETS[styleKey] || STYLE_PRESETS.general;
  const aspectRatio = aspectRatioOverride || preset.aspectRatio;

  // 构建 Prompt
  const imagePrompt = promptOverride
    ? promptOverride
    : buildChatImagePrompt(messages, aiResponse, persona, preset);

  console.log(`[ProactiveImage] 触发! 分数=${analysis.score}, 风格=${styleKey}, reason=${analysis.reason}`);

  const startTime = Date.now();
  let result;

  try {
    // 使用通用图片生成接口（复用 minimaxService）
    const genResult = await generateMomentsImage(
      imagePrompt,
      persona,
      null, // 聊天场景不需要位置
      { aspectRatio, promptOptimizer: true }
    );

    const durationMs = Date.now() - startTime;

    setCooldown(chatId);
    updateStats(chatId, persona, true, durationMs, analysis.reason);

    result = {
      imageUrl: genResult.imageUrl,
      prompt: imagePrompt,
      style: styleKey,
      styleLabel: preset.label,
      aspectRatio,
      triggerReason: analysis.reason,
      triggerScore: analysis.score,
      durationMs,
      personaId: persona?.id,
    };

    console.log(`[ProactiveImage] 生成成功 in ${durationMs}ms: ${genResult.imageUrl.slice(0, 60)}...`);
    return result;

  } catch (err) {
    const durationMs = Date.now() - startTime;
    updateStats(chatId, persona, false, durationMs, analysis.reason);
    console.error('[ProactiveImage] 生成失败:', err.message);
    return null;
  }
}

/**
 * 基于聊天上下文构建图片 Prompt
 */
function buildChatImagePrompt(messages, aiResponse, persona, preset) {
  // 提取最近对话的核心内容
  const recentContent = messages
    .slice(-4)
    .filter((m) => m.senderId === 'user-me')
    .map((m) => m.content)
    .join(' ')
    .replace(/[#@[\]]/g, '')
    .slice(0, 80);

  const aiSnippet = aiResponse
    .replace(/\[.*?\]/g, '')
    .slice(0, 60);

  const personaContext = persona
    ? `${persona.name || 'AI'} character, `
    : '';

  return (
    `${personaContext}${preset.promptSuffix}. ` +
    `Context: "${recentContent || aiSnippet}". ` +
    `Cinematic, high quality, detailed, professional composition.`
  ).slice(0, 1400);
}

// ─── 技能推荐 ─────────────────────────────────────────────────────────────────

/**
 * 根据当前消息内容推荐可用的 MiniMax 技能
 * @param {string} messageContent - 用户消息
 * @returns {Array<{ skillId, name, description, example }>}
 */
export function recommendSkills(messageContent = '') {
  const text = messageContent.toLowerCase();
  const suggestions = [];

  if (/图|画|image|picture|photo|发图|看看/.test(text)) {
    suggestions.push({
      skillId: 'image_gen',
      name: '📸 分享照片',
      description: '使用 MiniMax image-01 生成高质量图片',
      example: '帮我画一幅樱花树下的场景',
    });
  }

  if (/朗读|语音|声音|听|read aloud|tts|voice/.test(text)) {
    suggestions.push({
      skillId: 'tts',
      name: '🔊 语音朗读',
      description: '使用角色专属音色朗读消息（MiniMax speech-2.8-hd）',
      example: '点击消息旁边的喇叭图标即可朗读',
    });
  }

  if (/视频|动画|video|animate/.test(text)) {
    suggestions.push({
      skillId: 'video_gen',
      name: '🎬 AI 视频生成',
      description: 'MiniMax video-01 支持文转视频（需升级 Token Plan）',
      example: '描述一段视频场景让 AI 生成动态内容',
    });
  }

  return suggestions;
}

export default {
  tryProactiveImageGen,
  analyzeContextForImageGen,
  getImageGenStats,
  recommendSkills,
  STYLE_PRESETS,
  TRIGGER_SCORE_THRESHOLD,
  COOLDOWN_MS,
};
