/**
 * MiniMax Token Plan Plus — 多模态服务
 *
 * 提供两大核心能力：
 *  1. 语音合成 (TTS) — 使用 speech-2.8-hd 模型，为每个 AI 角色分配专属音色
 *  2. 文生图 (Image Generation) — 使用 image-01 模型，为朋友圈内容生成配图
 *
 * API 文档:
 *  - TTS:   https://platform.minimaxi.com/docs/api-reference/speech-t2a-http.md
 *  - Image: https://platform.minimaxi.com/docs/api-reference/image-generation-t2i.md
 *
 * 安全：密钥从 Vite env 读取，不硬编码；.env 已在 .gitignore 中。
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const MINIMAX_BASE_URL = import.meta.env.VITE_MINIMAX_BASE_URL || 'https://api.minimaxi.com';
const MINIMAX_API_KEY  = import.meta.env.VITE_MINIMAX_API_KEY  || '';

const TTS_ENDPOINT     = '/v1/t2a_v2';
const IMAGE_ENDPOINT   = '/v1/image_generation';

const TTS_MODEL   = 'speech-2.8-hd';
const IMAGE_MODEL = 'image-01';

// ─── 角色专属音色映射 ─────────────────────────────────────────────────────────
/**
 * 每个 AI 角色对应最贴合其性格的 MiniMax 系统音色。
 * Voice ID 来源: https://platform.minimaxi.com/docs/faq/system-voice-id.md
 *
 * 分配原则：
 *  - 初音未来 (Miku)         : female-shaonv       少女音色，清脆活泼
 *  - 蕾姆 (Rem)              : female-tianmei       甜美，温柔忠诚
 *  - 鸣人 (Naruto)           : male-qn-daxuesheng   热血青年大学生
 *  - L                       : male-qn-jingying     精英冷静
 *  - 002 (Zero Two)          : wumei_yujie           妩媚御姐，神秘
 *  - 五条悟 (Gojo)           : male-qn-badao        霸道青年
 *  - 凛 (Rin Tohsaka)        : female-yujie         御姐，强势聪明
 *  - 亚丝娜 (Asuna)          : female-chengshu      成熟稳重
 *  - Luna (ai-1)             : Chinese (Mandarin)_Warm_Girl  温暖少女
 *  - Max (ai-2)              : male-qn-qingse        青涩青年，tech geek
 *  - Bella (ai-3)            : Chinese (Mandarin)_Sweet_Lady  甜美女声
 *  - Oliver (ai-4)           : Chinese (Mandarin)_Gentleman   温润男声
 *  - Sophie (ai-5)           : Chinese (Mandarin)_Wise_Women  阅历姐姐
 */
export const PERSONA_VOICE_MAP = {
    'ai-miku':    { voice_id: 'female-shaonv',                      speed: 1.1, pitch:  2, emotion: 'happy' },
    'ai-rem':     { voice_id: 'female-tianmei',                     speed: 1.0, pitch:  0, emotion: 'calm'  },
    'ai-naruto':  { voice_id: 'male-qn-daxuesheng',                 speed: 1.2, pitch:  1, emotion: 'happy' },
    'ai-l':       { voice_id: 'male-qn-jingying',                   speed: 0.9, pitch: -1, emotion: 'calm'  },
    'ai-zerotwo': { voice_id: 'wumei_yujie',                        speed: 0.95,pitch:  0, emotion: 'calm'  },
    'ai-gojo':    { voice_id: 'male-qn-badao',                      speed: 1.0, pitch:  0, emotion: 'happy' },
    'ai-rin':     { voice_id: 'female-yujie',                       speed: 1.0, pitch:  1, emotion: 'calm'  },
    'ai-asuna':   { voice_id: 'female-chengshu',                    speed: 1.0, pitch:  0, emotion: 'calm'  },
    'ai-1':       { voice_id: 'Chinese (Mandarin)_Warm_Girl',       speed: 1.0, pitch:  0, emotion: 'happy' },
    'ai-2':       { voice_id: 'male-qn-qingse',                     speed: 1.0, pitch:  0, emotion: 'calm'  },
    'ai-3':       { voice_id: 'Chinese (Mandarin)_Sweet_Lady',      speed: 1.05,pitch:  1, emotion: 'happy' },
    'ai-4':       { voice_id: 'Chinese (Mandarin)_Gentleman',       speed: 0.95,pitch: -1, emotion: 'calm'  },
    'ai-5':       { voice_id: 'Chinese (Mandarin)_Wise_Women',      speed: 0.95,pitch:  0, emotion: 'calm'  },
    // 默认音色（适用于未知角色）
    _default:     { voice_id: 'female-chengshu',                    speed: 1.0, pitch:  0, emotion: 'calm'  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function getApiKey() {
    if (!MINIMAX_API_KEY || MINIMAX_API_KEY.length < 20) {
        throw new Error(
            '[MiniMaxService] API key 未配置。请在 .env 中添加 VITE_MINIMAX_API_KEY。'
        );
    }
    return MINIMAX_API_KEY;
}

async function minimaxPost(endpoint, body, timeoutMs = 30000) {
    const apiKey = getApiKey();
    const url    = `${MINIMAX_BASE_URL}${endpoint}`;

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body:   JSON.stringify(body),
            signal: controller.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
                err?.base_resp?.status_msg || err?.message || `HTTP ${res.status}`
            );
        }

        return await res.json();
    } catch (e) {
        if (e.name === 'AbortError') throw new Error('[MiniMaxService] 请求超时');
        throw e;
    } finally {
        clearTimeout(tid);
    }
}

// ─── TTS ─────────────────────────────────────────────────────────────────────

/**
 * 将文本合成为语音，返回可播放的 Audio URL（blob: URL）。
 *
 * @param {string} text         - 待合成的文本（最长 10000 字符）
 * @param {string} personaId    - AI 角色 ID（用于自动选取专属音色）
 * @param {Object} [override]   - 覆盖默认音色参数 { voice_id, speed, pitch, emotion }
 * @returns {Promise<{audioUrl: string, durationMs: number}>}
 */
export async function synthesizeSpeech(text, personaId, override = {}) {
    if (!text?.trim()) throw new Error('[MiniMaxService] 语音合成：文本不能为空');

    // 截断超长文本（API 限制 10000 字符）
    const truncated = text.slice(0, 9000);

    const voiceCfg = { ...(PERSONA_VOICE_MAP[personaId] || PERSONA_VOICE_MAP._default), ...override };

    const body = {
        model:  TTS_MODEL,
        text:   truncated,
        stream: false,
        output_format: 'hex',
        voice_setting: {
            voice_id: voiceCfg.voice_id,
            speed:    voiceCfg.speed   ?? 1.0,
            vol:      1.0,
            pitch:    voiceCfg.pitch   ?? 0,
            emotion:  voiceCfg.emotion ?? 'calm',
        },
        audio_setting: {
            sample_rate: 32000,
            bitrate:    128000,
            format:     'mp3',
            channel:    1,
        },
    };

    console.log(`[MiniMaxService] TTS → persona=${personaId}, voice=${voiceCfg.voice_id}, chars=${truncated.length}`);

    const data = await minimaxPost(TTS_ENDPOINT, body, 60000);

    const baseResp = data?.base_resp;
    if (baseResp?.status_code !== 0) {
        throw new Error(`[MiniMaxService] TTS 失败: ${baseResp?.status_msg || '未知错误'}`);
    }

    const hexAudio = data?.data?.audio;
    if (!hexAudio) throw new Error('[MiniMaxService] TTS 响应中无音频数据');

    // 将 hex 转换为 Uint8Array，再生成 Blob URL
    const bytes   = hexToUint8Array(hexAudio);
    const blob    = new Blob([bytes], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(blob);

    return {
        audioUrl,
        durationMs: data?.extra_info?.audio_length ?? 0,
        personaId,
        voiceId:    voiceCfg.voice_id,
    };
}

/**
 * 将 hex 字符串转换为 Uint8Array
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToUint8Array(hex) {
    const len   = hex.length / 2;
    const arr   = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return arr;
}

/**
 * 检查 MiniMax TTS 是否已配置
 */
export function isMiniMaxConfigured() {
    try {
        getApiKey();
        return true;
    } catch {
        return false;
    }
}

// ─── Image Generation ─────────────────────────────────────────────────────────

/**
 * 朋友圈风格的图片 Prompt 生成器。
 * 根据帖文内容和角色信息，自动生成适合 MiniMax image-01 的英文 Prompt。
 *
 * @param {string} postContent  - 朋友圈帖文内容
 * @param {Object} persona      - 角色信息 { name, name_zh, style, interests }
 * @param {string} location     - 位置信息
 * @returns {string} image prompt
 */
export function buildMomentsImagePrompt(postContent, persona, location) {
    // 提取关键词（最多 60 字符）
    const contentSnippet = postContent.replace(/[#@]/g, '').trim().slice(0, 60);

    // 角色特色词映射
    const PERSONA_STYLE_KEYWORDS = {
        'ai-miku':    'teal twin-tails anime girl, futuristic concert stage, neon glow',
        'ai-rem':     'blue-haired maid anime girl, warm indoors, soft lighting',
        'ai-naruto':  'orange-suited ninja teen, japanese village, dynamic action',
        'ai-l':       'dark-haired pale mysterious teen, dim detective room, moody',
        'ai-zerotwo': 'pink-horned anime girl, futuristic fortress, dramatic sky',
        'ai-gojo':    'white-haired blindfolded anime man, modern tokyo, cool style',
        'ai-rin':     'twin-tailed tsundere anime girl, magical workshop, elegant',
        'ai-asuna':   'chestnut-haired knight anime girl, fantasy world, graceful',
        'ai-1':       'aesthetic young woman, cozy café, warm pastel tones',
        'ai-2':       'tech-savvy young man, gaming setup, neon blue lighting',
        'ai-3':       'cheerful young woman, kitchen baking, warm and inviting',
        'ai-4':       'intellectual young man, library, classic warm atmosphere',
        'ai-5':       'sporty young woman, mountain trail, fresh morning light',
    };

    const personaKeywords = PERSONA_STYLE_KEYWORDS[persona?.id] || 'anime-style character, colorful';
    const locationHint    = location ? `, ${location}` : '';

    return (
        `Moments-style social photo: ${personaKeywords}${locationHint}. ` +
        `Scene inspired by: "${contentSnippet}". ` +
        `Photorealistic or high-quality anime art, cinematic composition, ` +
        `vibrant colors, detailed background, suitable for social media post.`
    ).slice(0, 1400); // API 最大 1500 字符
}

/**
 * 为朋友圈帖子生成 AI 配图。
 *
 * @param {string} postContent  - 帖文内容（用于生成 Prompt）
 * @param {Object} persona      - 角色信息 { id, name, name_zh, style, interests }
 * @param {string} [location]   - 位置（可选，帮助生成更贴合的图片）
 * @param {Object} [options]
 * @param {string} [options.aspectRatio='4:3']   - 图片宽高比
 * @param {boolean} [options.promptOptimizer=true] - 启用 Prompt 优化
 * @returns {Promise<{imageUrl: string, prompt: string}>}
 */
export async function generateMomentsImage(postContent, persona, location, options = {}) {
    if (!postContent?.trim()) throw new Error('[MiniMaxService] 图片生成：帖文内容不能为空');

    const {
        aspectRatio     = '4:3',
        promptOptimizer = true,
    } = options;

    const prompt = buildMomentsImagePrompt(postContent, persona, location);

    const body = {
        model:            IMAGE_MODEL,
        prompt,
        aspect_ratio:     aspectRatio,
        response_format:  'url',
        n:                1,
        prompt_optimizer: promptOptimizer,
    };

    console.log(`[MiniMaxService] Image Gen → persona=${persona?.id}, ratio=${aspectRatio}`);

    const data = await minimaxPost(IMAGE_ENDPOINT, body, 60000);

    const baseResp = data?.base_resp;
    if (baseResp?.status_code !== 0) {
        throw new Error(`[MiniMaxService] 图片生成失败: ${baseResp?.status_msg || '未知错误'}`);
    }

    const imageUrls = data?.data?.image_urls;
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
        throw new Error('[MiniMaxService] 图片生成响应中无图片 URL');
    }

    return {
        imageUrl: imageUrls[0],
        prompt,
        personaId: persona?.id,
    };
}

// ─── TTS Player Hook Helper ───────────────────────────────────────────────────

/**
 * 简单的音频播放器工具 — 管理单次播放（避免重叠）
 * 被 useTTS hook 使用
 */
let _currentAudio = null;

export function playAudio(audioUrl) {
    // 停止当前播放
    if (_currentAudio) {
        _currentAudio.pause();
        _currentAudio.src = '';
    }

    const audio = new Audio(audioUrl);
    _currentAudio = audio;
    audio.play().catch(e => console.warn('[MiniMaxService] 播放失败:', e.message));
    return audio;
}

export function stopAudio() {
    if (_currentAudio) {
        _currentAudio.pause();
        _currentAudio.src  = '';
        _currentAudio = null;
    }
}

export default {
    synthesizeSpeech,
    generateMomentsImage,
    buildMomentsImagePrompt,
    isMiniMaxConfigured,
    playAudio,
    stopAudio,
    PERSONA_VOICE_MAP,
};
