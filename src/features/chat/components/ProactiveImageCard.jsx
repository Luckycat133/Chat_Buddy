/**
 * ProactiveImageCard.jsx
 * ─────────────────────────────────────────────────────────────────────
 * AI 主动生成图片的展示 + 参数调整卡片
 *
 * 功能：
 *  - 加载骨架屏 → 图片预览（淡入动画）
 *  - 内联参数调整面板（风格 / 宽高比 / 自定义 Prompt）
 *  - 一键重新生成
 *  - 图片下载 / 全屏预览
 *  - 生成耗时 + 触发原因展示
 */

import React, { useState, useCallback } from 'react';
import {
    Sparkles,
    RefreshCw,
    Download,
    Expand,
    ChevronDown,
    ChevronUp,
    X,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Sliders,
    ImageOff,
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { STYLE_PRESETS } from '../../../services/proactiveImageService';

// ─── 宽高比选项 ───────────────────────────────────────────────────────────────
const ASPECT_OPTIONS = ['1:1', '4:3', '16:9', '9:16'];

// ─── 骨架屏 ───────────────────────────────────────────────────────────────────
function ImageSkeleton({ aspectRatio = '4:3' }) {
    const paddingMap = {
        '1:1': 'pt-[100%]',
        '4:3': 'pt-[75%]',
        '16:9': 'pt-[56.25%]',
        '9:16': 'pt-[177.78%]',
    };
    return (
        <div className={cn('relative w-full rounded-xl overflow-hidden bg-[var(--color-bg-active)]', paddingMap[aspectRatio] || 'pt-[75%]')}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 size={28} className="text-[var(--color-primary)] animate-spin" />
                <span className="text-xs text-[var(--color-text-muted)] animate-pulse">AI 正在绘图…</span>
            </div>
            {/* 光效扫过动画 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
    );
}

// ─── 参数调整面板 ────────────────────────────────────────────────────────────
function ParamsPanel({ params, onUpdate, onRegenerate, isLoading }) {
    const [customPrompt, setCustomPrompt] = useState(params.promptOverride || '');

    return (
        <div className="mt-3 p-3 bg-[var(--color-bg-active)] rounded-xl border border-[var(--color-border-light)] space-y-3">
            {/* 风格选择 */}
            <div>
                <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wide">风格</p>
                <div className="flex flex-wrap gap-1.5">
                    {Object.entries(STYLE_PRESETS).map(([key, preset]) => (
                        <button
                            key={key}
                            onClick={() => onUpdate({ style: key })}
                            className={cn(
                                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer',
                                params.style === key
                                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-sm'
                                    : 'bg-[var(--color-bg-white)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] border border-[var(--color-border-light)]'
                            )}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 宽高比 */}
            <div>
                <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wide">宽高比</p>
                <div className="flex gap-1.5">
                    {ASPECT_OPTIONS.map((ratio) => (
                        <button
                            key={ratio}
                            onClick={() => onUpdate({ aspectRatio: ratio })}
                            className={cn(
                                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer',
                                params.aspectRatio === ratio
                                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-sm'
                                    : 'bg-[var(--color-bg-white)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] border border-[var(--color-border-light)]'
                            )}
                        >
                            {ratio}
                        </button>
                    ))}
                </div>
            </div>

            {/* 自定义 Prompt */}
            <div>
                <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wide">图片描述（留空则看AI心情）</p>
                <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onBlur={() => onUpdate({ promptOverride: customPrompt })}
                    placeholder="例：夜晚的东京，霓虹灯下的街道..."
                    rows={2}
                    className="w-full text-xs bg-[var(--color-bg-white)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                />
            </div>

            {/* 重新生成按钮 */}
            <button
                onClick={onRegenerate}
                className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer",
                    isLoading
                        ? 'bg-transparent text-[var(--color-text-muted)] cursor-not-allowed'
                        : 'bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 active:scale-[0.98]'
                )}
                disabled={isLoading}
            >
                {isLoading
                    ? <><Loader2 size={13} className="animate-spin" /> 寻找中…</>
                    : <><RefreshCw size={13} /> 换一张照片</>
                }
            </button>
        </div>
    );
}

// ─── 全屏预览 Modal ───────────────────────────────────────────────────────────
function LightboxModal({ url, onClose }) {
    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={onClose}
        >
            <button
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors duration-200 cursor-pointer"
                onClick={onClose}
            >
                <X size={18} />
            </button>
            <img
                src={url}
                alt="AI Generated"
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {'idle'|'analyzing'|'generating'|'done'|'error'} props.state
 * @param {Object|null} props.result    - 生成结果 { imageUrl, prompt, style, triggerReason, durationMs }
 * @param {string|null} props.error
 * @param {Object}      props.params    - { style, aspectRatio, promptOverride }
 * @param {Function}    props.onUpdateParams
 * @param {Function}    props.onRegenerate
 * @param {Function}    props.onDismiss
 * @param {string}      props.personaName
 */
export default function ProactiveImageCard({
    state,
    result,
    error,
    params,
    onUpdateParams,
    onRegenerate,
    onDismiss,
    personaName = 'AI',
}) {
    const [showParams, setShowParams] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const handleDownload = useCallback(() => {
        if (!result?.imageUrl) return;
        const a = document.createElement('a');
        a.href = result.imageUrl;
        a.download = `chatbuddy-ai-${Date.now()}.jpg`;
        a.target = '_blank';
        a.click();
    }, [result]);

    // 不显示条件：空闲且无结果
    if (state === 'idle' && !result) return null;

    const isLoading = state === 'analyzing' || state === 'generating';

    return (
        <>
            <div className="mt-2 max-w-[320px] w-full">
                {/* 卡片头部 */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                        <Sparkles size={11} className="text-[var(--color-primary)]" />
                        <span className="text-[10px] font-semibold text-[var(--color-primary)]">
                            {personaName} 分享了一张照片
                        </span>
                    </div>

                    {/* 状态徽章 */}
                    {state === 'done' && (
                        <div className="flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                            <CheckCircle2 size={10} />
                            <span>{result?.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : '完成'}</span>
                        </div>
                    )}
                    {state === 'error' && (
                        <div className="flex items-center gap-1 text-[10px] text-[var(--color-danger)]">
                            <AlertCircle size={10} />
                            <span>获取照片失败</span>
                        </div>
                    )}

                    {/* 关闭按钮 */}
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="ml-auto w-5 h-5 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-active)] transition-colors duration-200 cursor-pointer"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* 图片区域 */}
                <div className="relative rounded-xl overflow-hidden bg-[var(--color-bg-active)] border border-[var(--color-border-light)]">
                    {isLoading && (
                        <ImageSkeleton aspectRatio={params.aspectRatio} />
                    )}

                    {state === 'error' && (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-[var(--color-text-muted)]">
                            <ImageOff size={24} className="opacity-50" />
                            <p className="text-xs text-center px-4">{error || '没找到合适的照片，换个要求试试吧'}</p>
                        </div>
                    )}

                    {state === 'done' && result?.imageUrl && (
                        <>
                            <img
                                src={result.imageUrl}
                                alt="AI Generated"
                                onLoad={() => setImageLoaded(true)}
                                className={cn(
                                    'w-full object-cover transition-opacity duration-500 cursor-zoom-in',
                                    imageLoaded ? 'opacity-100' : 'opacity-0'
                                )}
                                onClick={() => setShowLightbox(true)}
                            />
                            {!imageLoaded && <ImageSkeleton aspectRatio={result.aspectRatio || params.aspectRatio} />}

                            {/* 悬停操作按钮 */}
                            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                    onClick={() => setShowLightbox(true)}
                                    className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors duration-200 cursor-pointer"
                                    title="全屏预览"
                                >
                                    <Expand size={13} />
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors duration-200 cursor-pointer"
                                    title="下载图片"
                                >
                                    <Download size={13} />
                                </button>
                            </div>

                            {/* 风格标签 */}
                            {result.styleLabel && (
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium">
                                    {result.styleLabel}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 触发原因 */}
                {result?.triggerReason && (
                    <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)] truncate px-0.5" title={result.triggerReason}>
                        💡 {result.triggerReason}
                    </p>
                )}

                {/* 底部操作 */}
                <div className="flex items-center gap-2 mt-2">
                    {/* 参数调整 toggle */}
                    <button
                        onClick={() => setShowParams((v) => !v)}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer border',
                            showParams
                                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20'
                                : 'text-[var(--color-text-muted)] border-[var(--color-border-light)] hover:text-[var(--color-primary)]'
                        )}
                    >
                        <Sliders size={11} />
                        调整参数
                        {showParams ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>

                    {/* 快速重生成 */}
                    {(state === 'done' || state === 'error') && (
                        <button
                            onClick={onRegenerate}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--color-text-muted)] border border-[var(--color-border-light)] hover:text-[var(--color-primary)] transition-colors duration-200 cursor-pointer"
                        >
                            <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
                            换一张照片
                        </button>
                    )}

                    {/* 下载（done 状态显示） */}
                    {state === 'done' && result?.imageUrl && (
                        <button
                            onClick={handleDownload}
                            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--color-text-muted)] border border-[var(--color-border-light)] hover:text-[var(--color-primary)] transition-colors duration-200 cursor-pointer"
                        >
                            <Download size={11} />
                            下载
                        </button>
                    )}
                </div>

                {/* 可折叠参数面板 */}
                {showParams && (
                    <ParamsPanel
                        params={params}
                        onUpdate={onUpdateParams}
                        onRegenerate={onRegenerate}
                        isLoading={isLoading}
                    />
                )}
            </div>

            {/* 全屏 Lightbox */}
            {showLightbox && result?.imageUrl && (
                <LightboxModal url={result.imageUrl} onClose={() => setShowLightbox(false)} />
            )}
        </>
    );
}
