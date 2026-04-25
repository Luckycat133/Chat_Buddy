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

// 会话级缓存
const _ttsCache = new Map();

export default function TTSButton({ text, personaId, className }) {
    const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'playing'
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

        const cacheKey = `${personaId}::${text.slice(0, 120)}`;

        try {
            let audioUrl;

            if (_ttsCache.has(cacheKey)) {
                audioUrl = _ttsCache.get(cacheKey);
            } else {
                // 截断太长的文本
                const truncated = text.replace(/```[\s\S]*?```/g, '（代码块）').slice(0, 400);
                const result = await synthesizeSpeech(truncated, personaId);
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
            setState('idle');
        }
    }, [state, text, personaId]);

    // 如果未配置或文本为空，不渲染
    // 所有 Hook 已在更早的位置调用，这里可以安全早返回
    if (!isMiniMaxConfigured() || !text?.trim()) return null;

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
        <button
            onClick={handleClick}
            title={label}
            aria-label={label}
            className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200',
                'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]',
                'hover:bg-[var(--color-bg-active)] active:scale-95',
                state === 'playing' && 'text-[var(--color-primary)] bg-[var(--color-bg-active)]',
                state === 'loading' && 'opacity-70 cursor-wait',
                className
            )}
        >
            {icon}
        </button>
    );
}
