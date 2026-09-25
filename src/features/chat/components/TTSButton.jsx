/**
 * TTSButton — AI 消息语音朗读按钮
 *
 * 在 AI 消息气泡旁显示一个小喇叭图标，
 * 点击后调用 MiniMax TTS API 朗读该消息内容。
 *
 * 特性：
 *  - 按角色自动选取专属音色
 *  - 加载/播放/停止三态切换
 *  - 缓存已合成音频（避免重复 API 调用）
 *  - MiniMax 未配置时自动隐藏
 */

import React, { useState, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { synthesizeSpeech, playAudio, stopAudio, isMiniMaxConfigured } from '../../../services/minimaxService';
import { cloudEnabled, getCloud } from '../../../api/cloud-adapter';

// 会话级缓存
const _ttsCache = new Map();

function base64AudioUrl(audioBase64, format) {
    const binary = globalThis.atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    const mime = format === 'wav' ? 'audio/wav' : format === 'pcm' ? 'audio/L16' : 'audio/mpeg';
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

async function synthesizeForCurrentMode(text, personaId) {
    if (!cloudEnabled()) {
        return synthesizeSpeech(text, personaId);
    }
    const result = await getCloud().synthesizeSpeech({ text });
    return {
        audioUrl: base64AudioUrl(result.audioBase64, result.format),
        durationMs: result.durationMs ?? 0,
        personaId,
    };
}

export default function TTSButton({ text, personaId, className }) {
    const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'playing'
    const [error, setError] = useState(null);
    const audioRef = useRef(null);

    const handleClick = useCallback(async () => {
        // 正在播放 → 停止
        if (state === 'playing') {
            stopAudio();
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setState('idle');
            return;
        }

        // 正在加载 → 忽略
        if (state === 'loading') return;

        setState('loading');
        setError(null);

        const cacheKey = `${personaId}::${text.slice(0, 120)}`;

        try {
            let audioUrl;

            if (_ttsCache.has(cacheKey)) {
                audioUrl = _ttsCache.get(cacheKey);
            } else {
                // 截断太长的文本
                const truncated = text.replace(/```[\s\S]*?```/g, '（代码块）').slice(0, 400);
                const result = await synthesizeForCurrentMode(truncated, personaId);
                audioUrl = result.audioUrl;

                if (_ttsCache.size >= 50) {
                    const firstKey = _ttsCache.keys().next().value;
                    _ttsCache.delete(firstKey);
                }
                _ttsCache.set(cacheKey, audioUrl);
            }

            const audio = playAudio(audioUrl);
            audioRef.current = audio;
            setState('playing');

            audio.onended = () => {
                setState('idle');
                audioRef.current = null;
            };
            audio.onerror = () => {
                setState('idle');
                audioRef.current = null;
            };
        } catch (err) {
            console.error('[TTSButton] 语音合成失败:', err.message);
            setError(err?.message || '语音合成失败');
            setState('idle');
        }
    }, [state, text, personaId]);

    // Legacy mode can know from Vite env that no provider is configured.
    // Cloud mode keeps the control visible and surfaces the server's stable
    // MEDIA_NOT_CONFIGURED / MEDIA_FAILURE error instead of hiding the gap.
    // 所有 Hook 已在更早的位置调用，这里可以安全早返回
    if ((!cloudEnabled() && !isMiniMaxConfigured()) || !text?.trim()) return null;

    const icon = {
        idle:    <Volume2    size={12} />,
        loading: <Loader2   size={12} className="animate-spin" />,
        playing: <VolumeX   size={12} />,
    }[state];

    const label = {
        idle:    '朗读',
        loading: '合成中…',
        playing: '停止',
    }[state];

    return (
        <span className="inline-flex items-center gap-1">
            <button
                onClick={handleClick}
                title={error || label}
                aria-label={error || label}
                className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200',
                    'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]',
                    'hover:bg-[var(--color-bg-active)] active:scale-95',
                    state === 'playing' && 'text-[var(--color-primary)] bg-[var(--color-bg-active)]',
                    state === 'loading' && 'opacity-70 cursor-wait',
                    error && 'text-[var(--color-danger)]',
                    className
                )}
            >
                {icon}
            </button>
            {error && (
                <span role="alert" className="max-w-48 truncate text-[11px] text-[var(--color-danger)]">
                    {error}
                </span>
            )}
        </span>
    );
}
