/**
 * useTTS — MiniMax 语音合成 React Hook
 *
 * 功能：
 *  - 对话中每条 AI 回复自动触发语音合成
 *  - 按角色自动选取专属音色
 *  - 管理播放状态（loading / playing / idle / error）
 *  - 支持手动触发、手动停止
 *  - 缓存已合成的音频（会话级，避免重复请求）
 *
 * 使用示例：
 *   const { speak, stop, isPlaying, isLoading } = useTTS(personaId);
 *   speak(messageText);          // 播放指定文本
 *   speak(messageText, true);    // 自动播放（AI 回复时触发）
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { synthesizeSpeech, playAudio, stopAudio, isMiniMaxConfigured } from '../services/minimaxService';

// 会话级缓存 Map<cacheKey, audioUrl>
const _audioCache = new Map();

/**
 * @param {string} personaId   - AI 角色 ID（用于自动选取音色，如 'ai-miku'）
 * @param {Object} [options]
 * @param {boolean} [options.autoPlay=false]      - 是否自动播放新增文本
 * @param {number}  [options.maxCacheSize=30]     - 最大缓存条目数
 */
export function useTTS(personaId, options = {}) {
    const { autoPlay = false, maxCacheSize = 30 } = options;

    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError]         = useState(null);
    const [lastVoiceId, setLastVoiceId] = useState(null);

    const audioRef = useRef(null);
    const configured = isMiniMaxConfigured();

    // 清理组件卸载时的音频
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, []);

    /**
     * 停止当前播放
     */
    const stop = useCallback(() => {
        stopAudio();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    /**
     * 合成并播放文本
     * @param {string} text          - 要朗读的文本
     * @param {boolean} [silent=false] - true = 仅合成不播放（预热缓存）
     * @param {Object}  [voiceOverride] - 覆盖音色参数
     */
    const speak = useCallback(async (text, silent = false, voiceOverride = {}) => {
        if (!configured) {
            console.warn('[useTTS] MiniMax API 未配置，跳过语音合成');
            return;
        }

        if (!text?.trim()) return;

        // 停止当前播放
        stop();
        setError(null);
        setIsLoading(true);

        // 构建缓存 key（角色 + 文本前 100 字）
        const cacheKey = `${personaId}::${text.slice(0, 100)}`;

        try {
            let audioUrl;

            if (_audioCache.has(cacheKey)) {
                audioUrl = _audioCache.get(cacheKey);
                console.log(`[useTTS] 缓存命中 → ${cacheKey.slice(0, 40)}…`);
            } else {
                const result = await synthesizeSpeech(text, personaId, voiceOverride);
                audioUrl = result.audioUrl;
                setLastVoiceId(result.voiceId);

                // LRU 简化：超出限制时清除最旧条目
                if (_audioCache.size >= maxCacheSize) {
                    const firstKey = _audioCache.keys().next().value;
                    _audioCache.delete(firstKey);
                }
                _audioCache.set(cacheKey, audioUrl);
            }

            if (!silent) {
                const audio = playAudio(audioUrl);
                audioRef.current = audio;
                setIsPlaying(true);

                audio.onended = () => {
                    setIsPlaying(false);
                    audioRef.current = null;
                };
                audio.onerror = () => {
                    setIsPlaying(false);
                    setError('音频播放失败');
                    audioRef.current = null;
                };
            }
        } catch (err) {
            console.error('[useTTS] 语音合成失败:', err.message);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [personaId, configured, stop, maxCacheSize]);

    /**
     * 自动播放 — 由 useEffect 在组件外部调用
     * 只有 autoPlay=true 时才触发
     */
    const autoSpeak = useCallback(async (text) => {
        if (!autoPlay) return;
        await speak(text, false);
    }, [autoPlay, speak]);

    return {
        speak,
        autoSpeak,
        stop,
        isPlaying,
        isLoading,
        error,
        lastVoiceId,
        configured,
    };
}

export default useTTS;
