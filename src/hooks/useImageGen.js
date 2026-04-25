/**
 * useImageGen.js — AI 图像生成 React Hook
 *
 * 功能：
 *  - 支持手动触发 / AI 主动触发两种模式
 *  - 实时预览（流式加载骨架 → 图片）
 *  - 参数调整（风格、宽高比、自定义 Prompt）
 *  - 会话级缓存，避免重复生成
 *  - 内置统计 (生成次数、耗时)
 *  - 优雅的加载 / 错误状态
 */

import { useState, useCallback, useRef } from 'react';
import { tryProactiveImageGen, analyzeContextForImageGen, STYLE_PRESETS } from '../services/proactiveImageService';
import { isMiniMaxConfigured } from '../services/minimaxService';

// 会话级缓存 Map<cacheKey, result>
const _imageCache = new Map();

/**
 * @param {string} chatId    - 当前聊天 ID
 * @param {Object} persona   - AI 角色信息
 * @param {Array}  messages  - 消息历史（用于上下文分析）
 */
export function useImageGen(chatId, persona, messages = []) {
    const [state, setState] = useState('idle');      // 'idle' | 'analyzing' | 'generating' | 'done' | 'error'
    const [result, setResult] = useState(null);       // { imageUrl, prompt, style, ... }
    const [error, setError] = useState(null);
    const [analysis, setAnalysis] = useState(null);  // 上下文分析结果
    const [params, setParams] = useState({           // 用户可调整的参数
        style: 'general',
        aspectRatio: '4:3',
        promptOverride: '',
    });

    const abortRef = useRef(null);
    const configured = isMiniMaxConfigured();

    // ─── 分析上下文（只分析，不生成）────────────────────────────────────────────
    const analyze = useCallback((aiResponse = '') => {
        const result = analyzeContextForImageGen(messages, aiResponse);
        setAnalysis(result);
        return result;
    }, [messages]);

    // ─── 生成图片 ───────────────────────────────────────────────────────────────
    const generate = useCallback(async (options = {}) => {
        if (!configured) return null;
        if (state === 'generating') return null;

        const {
            aiResponse  = '',
            force       = false,
            styleOverride     = params.style !== 'general' ? params.style : undefined,
            aspectRatioOverride = params.aspectRatio !== '4:3' ? params.aspectRatio : undefined,
            promptOverride      = params.promptOverride || undefined,
        } = options;

        // 缓存检查
        const cacheKey = `${chatId}::${styleOverride || 'auto'}::${promptOverride?.slice(0, 40) || aiResponse.slice(0, 40)}`;
        if (_imageCache.has(cacheKey)) {
            const cached = _imageCache.get(cacheKey);
            setResult(cached);
            setState('done');
            return cached;
        }

        setState('analyzing');
        setError(null);
        setResult(null);

        // 运行上下文分析
        const contextAnalysis = analyzeContextForImageGen(messages, aiResponse);
        setAnalysis(contextAnalysis);

        // 若未达阈值且非强制，则中止
        if (!force && !contextAnalysis.willTrigger && !promptOverride) {
            setState('idle');
            return null;
        }

        setState('generating');

        try {
            const genResult = await tryProactiveImageGen(
                chatId,
                messages,
                aiResponse,
                persona,
                { styleOverride, aspectRatioOverride, promptOverride, force }
            );

            if (genResult) {
                _imageCache.set(cacheKey, genResult);
                // LRU 限制
                if (_imageCache.size > 30) {
                    _imageCache.delete(_imageCache.keys().next().value);
                }
                setResult(genResult);
                setState('done');
                return genResult;
            } else {
                setState('idle');
                return null;
            }
        } catch (err) {
            setError(err.message);
            setState('error');
            return null;
        }
    }, [chatId, persona, messages, configured, state, params]);

    // ─── 强制生成（忽略冷却和阈值）──────────────────────────────────────────────
    const forceGenerate = useCallback((customPrompt = '') => {
        return generate({
            force: true,
            promptOverride: customPrompt || undefined,
            aiResponse: '',
        });
    }, [generate]);

    // ─── 重置 ────────────────────────────────────────────────────────────────────
    const reset = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setState('idle');
        setResult(null);
        setError(null);
        setAnalysis(null);
    }, []);

    // ─── 更新参数 ────────────────────────────────────────────────────────────────
    const updateParams = useCallback((newParams) => {
        setParams((prev) => ({ ...prev, ...newParams }));
    }, []);

    return {
        // 状态
        state,
        result,
        error,
        analysis,
        params,
        configured,
        isLoading:    state === 'analyzing' || state === 'generating',
        isAnalyzing:  state === 'analyzing',
        isGenerating: state === 'generating',
        isDone:       state === 'done',
        isError:      state === 'error',

        // 动作
        generate,
        forceGenerate,
        analyze,
        reset,
        updateParams,

        // 常量（便于 UI 使用）
        stylePresets: STYLE_PRESETS,
    };
}

export default useImageGen;
