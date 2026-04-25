/**
 * minimaxSkillsManifest.js
 * ─────────────────────────────────────────────────────────────────────
 * MiniMax 技能总目录（Skill Manifest）
 *
 * 作用：
 *  1. 为 AI 系统提供所有可调用的 MiniMax 能力描述（注入 System Prompt）
 *  2. 为 UI 提供技能卡片数据（能力列表 + 参数指南 + 使用示例）
 *  3. 实现基于关键词的技能自动推荐
 *
 * 技能来源：MiniMax Token Plan Plus 多模态能力
 * API Docs: https://platform.minimaxi.com/docs
 */

// ─── 技能分类枚举 ─────────────────────────────────────────────────────────────

export const SKILL_CATEGORIES = {
  MULTIMODAL:  '多模态生成',
  LANGUAGE:    '语言能力',
  AGENT:       'AI Agent',
  INTEGRATION: '系统集成',
};

// ─── 技能清单 ─────────────────────────────────────────────────────────────────

/**
 * MiniMax 全量技能定义
 * 每个技能包含：ID / 名称 / 分类 / 描述 / 模型 / 参数指南 / 触发词 / 使用示例
 */
export const MINIMAX_SKILLS = [
  // ── 1. 文生图 ──────────────────────────────────────────────────────────────
  {
    id:       'image_generation',
    name:     '📸 分享照片',
    category: SKILL_CATEGORIES.MULTIMODAL,
    model:    'image-01',
    enabled:  true,
    description: '根据文字描述生成高质量图片，支持多种风格和宽高比。',
    longDescription: `
利用 MiniMax image-01 模型，将文字描述转化为精美图像。
支持写实摄影、动漫插画、概念艺术等多种风格。
图片分辨率高、细节丰富，适合社交媒体分享。
    `.trim(),
    params: [
      { name: 'prompt',           type: 'string',  required: true,  desc: '图片描述（英文效果更好，最多 1500 字符）' },
      { name: 'aspect_ratio',     type: 'string',  required: false, desc: '宽高比：1:1 / 4:3 / 16:9 / 9:16，默认 4:3' },
      { name: 'n',                type: 'number',  required: false, desc: '生成数量：1-4，默认 1' },
      { name: 'prompt_optimizer', type: 'boolean', required: false, desc: '启用 Prompt 优化（推荐开启）' },
    ],
    triggerKeywords: ['图', '画', '生成图片', '图像', 'image', 'draw', 'picture', '插画', '照片'],
    usageExamples: [
      {
        title: '风景图',
        prompt: '夜晚的东京街头，霓虹灯倒映在雨后的石板路上，行人撑着雨伞，电影感构图',
        aspectRatio: '16:9',
      },
      {
        title: '动漫风格',
        prompt: 'Beautiful anime girl with silver hair, sitting under cherry blossoms, soft lighting, detailed illustration',
        aspectRatio: '9:16',
      },
      {
        title: '美食摄影',
        prompt: '一碗精致的日式拉面，浓郁汤底，叉烧肉片，温泉蛋，俯拍，专业食物摄影',
        aspectRatio: '1:1',
      },
    ],
    apiEndpoint: '/v1/image_generation',
    docsUrl: 'https://platform.minimaxi.com/docs/api-reference/image-generation-t2i.md',
  },

  // ── 2. 语音合成 TTS ────────────────────────────────────────────────────────
  {
    id:       'text_to_speech',
    name:     '🔊 语音合成（TTS）',
    category: SKILL_CATEGORIES.MULTIMODAL,
    model:    'speech-2.8-hd',
    enabled:  true,
    description: '将文字转化为自然流畅的语音，每个 AI 角色都有专属音色。',
    longDescription: `
使用 MiniMax speech-2.8-hd 最新语音模型，提供影视级音质。
支持 13 种角色专属音色（少女音 / 御姐音 / 精英男声等），
以及情绪调节（开心 / 平静 / 悲伤）和语速 / 音调控制。
输出格式：MP3，采样率 32000Hz，128kbps。
    `.trim(),
    params: [
      { name: 'text',            type: 'string',  required: true,  desc: '待合成文本，最长 10000 字符' },
      { name: 'voice_id',        type: 'string',  required: true,  desc: '音色 ID，见角色音色映射表' },
      { name: 'speed',           type: 'number',  required: false, desc: '语速：0.5-2.0，默认 1.0' },
      { name: 'pitch',           type: 'number',  required: false, desc: '音调：-12 到 12，默认 0' },
      { name: 'emotion',         type: 'string',  required: false, desc: 'happy / calm / sad / angry / fearful' },
    ],
    triggerKeywords: ['朗读', '语音', '听', '声音', 'tts', 'voice', 'read aloud', '播放'],
    usageExamples: [
      { title: '角色朗读', desc: '点击 AI 消息旁边的 🔊 按钮即可让该角色朗读消息' },
      { title: 'API 调用', desc: 'synthesizeSpeech("你好，世界", "ai-miku") → Blob URL' },
    ],
    voiceMap: {
      'ai-miku':    'female-shaonv（少女）',
      'ai-rem':     'female-tianmei（甜美）',
      'ai-naruto':  'male-qn-daxuesheng（热血）',
      'ai-l':       'male-qn-jingying（精英）',
      'ai-zerotwo': 'wumei_yujie（妩媚）',
      'ai-gojo':    'male-qn-badao（霸道）',
      'ai-rin':     'female-yujie（御姐）',
      'ai-asuna':   'female-chengshu（成熟）',
    },
    apiEndpoint: '/v1/t2a_v2',
    docsUrl: 'https://platform.minimaxi.com/docs/api-reference/speech-t2a-http.md',
  },

  // ── 3. 视频生成 ────────────────────────────────────────────────────────────
  {
    id:       'video_generation',
    name:     '🎬 AI 视频生成',
    category: SKILL_CATEGORIES.MULTIMODAL,
    model:    'video-01',
    enabled:  false, // Token Plan 高级功能，按需开启
    description: '文字或图片转视频，生成 6 秒 720P 动态内容。',
    longDescription: `
MiniMax video-01 模型支持文生视频与图生视频。
输出分辨率 1280×720，时长约 6 秒，格式 MP4。
适合生成产品展示、角色动画、场景演示等内容。
（此功能需要 Token Plan Pro 及以上套餐）
    `.trim(),
    params: [
      { name: 'prompt', type: 'string', required: true,  desc: '视频场景描述' },
      { name: 'first_frame_image', type: 'string', required: false, desc: '图生视频：首帧图片（base64 或 URL）' },
    ],
    triggerKeywords: ['视频', '动画', 'video', 'animate', '动起来', '制作视频'],
    usageExamples: [
      { title: '场景动画', desc: '描述一段动态场景，AI 生成 6 秒视频片段' },
    ],
    apiEndpoint: '/v1/video_generation',
    docsUrl: 'https://platform.minimaxi.com/docs/api-reference/video-generation.md',
  },

  // ── 4. 音乐生成 ────────────────────────────────────────────────────────────
  {
    id:       'music_generation',
    name:     '🎵 AI 音乐生成',
    category: SKILL_CATEGORIES.MULTIMODAL,
    model:    'music-01',
    enabled:  false,
    description: '根据歌词和参考音频风格生成完整音乐作品。',
    longDescription: `
MiniMax music-01 模型支持歌词转音乐。
支持指定音乐风格参考（最多 3 段），
输出高质量 MP3 格式音频。
    `.trim(),
    params: [
      { name: 'lyrics',       type: 'string',   required: true, desc: '歌词内容' },
      { name: 'refer_voice',  type: 'string[]', required: true, desc: '声音参考（URL 数组）' },
      { name: 'refer_instrumental', type: 'string[]', required: true, desc: '伴奏参考（URL 数组）' },
    ],
    triggerKeywords: ['音乐', '歌曲', '作曲', 'music', 'song', '旋律'],
    usageExamples: [],
    apiEndpoint: '/v1/music_generation',
    docsUrl: 'https://platform.minimaxi.com/docs',
  },

  // ── 5. 多模态对话 (MiniMax-Text-01) ───────────────────────────────────────
  {
    id:       'multimodal_llm',
    name:     '🤖 MiniMax 对话模型',
    category: SKILL_CATEGORIES.LANGUAGE,
    model:    'MiniMax-Text-01',
    enabled:  true,
    description: '256K 上下文 LLM，支持图文理解，适合长对话和多模态任务。',
    longDescription: `
MiniMax-Text-01 是 MiniMax 最新旗舰语言模型。
- 上下文窗口：256K token
- 支持多模态：文本 + 图片理解
- 支持 Function Calling / Tool Use
- 中英文双语能力强，逻辑推理优秀
    `.trim(),
    params: [
      { name: 'model',       type: 'string', required: true,  desc: '"MiniMax-Text-01" 或 "abab6.5s-chat"' },
      { name: 'messages',    type: 'array',  required: true,  desc: '对话消息数组 [{role, content}]' },
      { name: 'tools',       type: 'array',  required: false, desc: 'Function Calling 工具定义' },
      { name: 'temperature', type: 'number', required: false, desc: '温度：0-1，默认 0.8' },
    ],
    triggerKeywords: ['长对话', '分析', '推理', '图文', 'multimodal', '256k'],
    usageExamples: [],
    apiEndpoint: '/v1/chat/completions',
    docsUrl: 'https://platform.minimaxi.com/docs',
  },
];

// ─── 系统 Prompt 注入块 ───────────────────────────────────────────────────────

/**
 * 生成供注入 AI System Prompt 的技能说明块
 * AI 可以通过此获知所有可用的 MiniMax 能力
 */
export function buildSkillsSystemBlock(enabledOnly = true) {
  const skills = enabledOnly
    ? MINIMAX_SKILLS.filter((s) => s.enabled)
    : MINIMAX_SKILLS;

  if (skills.length === 0) return '';

  const lines = skills.map((s) => `- ${s.name} (${s.model}): ${s.description}`);

  return `
MINIMAX MULTIMODAL SKILLS AVAILABLE:
${lines.join('\n')}

When conversation context involves visuals, audio, or creative generation:
1. For image requests: mention that you can generate images proactively
2. For voice/audio: remind user that each character has a unique voice
3. For video/music: note that advanced Token Plan features are available
4. Use TOOL_CALL: generate_image {"prompt":"..."} to request image generation
`.trim();
}

// ─── 技能推荐引擎 ─────────────────────────────────────────────────────────────

/**
 * 根据消息内容推荐相关技能
 * @param {string} messageContent
 * @param {number} [maxResults=3]
 * @returns {Array<SkillRecommendation>}
 */
export function getSkillRecommendations(messageContent = '', maxResults = 3) {
  const text = messageContent.toLowerCase();
  const scored = MINIMAX_SKILLS
    .filter((s) => s.enabled)
    .map((skill) => {
      const hits = skill.triggerKeywords.filter((kw) => text.includes(kw));
      return { skill, score: hits.length, hits };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored.map(({ skill, hits }) => ({
    skillId:     skill.id,
    name:        skill.name,
    description: skill.description,
    model:       skill.model,
    triggerHits: hits,
    examples:    skill.usageExamples.slice(0, 2),
    docsUrl:     skill.docsUrl,
  }));
}

/**
 * 通过 ID 获取技能详情
 */
export function getSkillById(skillId) {
  return MINIMAX_SKILLS.find((s) => s.id === skillId) || null;
}

/**
 * 获取所有已启用技能的简要列表（供 UI 展示）
 */
export function getEnabledSkillsSummary() {
  return MINIMAX_SKILLS
    .filter((s) => s.enabled)
    .map(({ id, name, category, model, description }) => ({
      id, name, category, model, description,
    }));
}

export default {
  MINIMAX_SKILLS,
  SKILL_CATEGORIES,
  buildSkillsSystemBlock,
  getSkillRecommendations,
  getSkillById,
  getEnabledSkillsSummary,
};
