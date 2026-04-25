/**
 * SkillRecommendationBubble.jsx
 * ─────────────────────────────────────────────────────────────────────
 * 技能自动推荐气泡组件
 *
 * 在 AI 消息下方（或输入框上方）展示 MiniMax 技能推荐卡片。
 * 当用户提及图像/语音/视频等相关词时自动弹出。
 *
 * 特性：
 *  - 流畅的滑入动画
 *  - 多技能平铺展示
 *  - 点击展开详情（参数指南 + 使用示例）
 *  - 一键触发图像生成
 *  - 5 秒自动消失 / 手动关闭
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    Sparkles,
    X,
    ChevronRight,
    Lightbulb,
    Info,
    Zap,
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { getSkillRecommendations, getSkillById } from '../../../services/minimaxSkillsManifest';
import { isMiniMaxConfigured } from '../../../services/minimaxService';

// ─── 技能详情展开面板 ─────────────────────────────────────────────────────────
function SkillDetailPanel({ skill, onClose, onTrigger }) {
    return (
        <div className="mt-2 p-3 bg-[var(--color-bg-white)] border border-[var(--color-border-light)] rounded-xl shadow-md">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <p className="text-sm font-bold text-[var(--color-text-main)]">{skill.name}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">模型: {skill.model}</p>
                </div>
                <button
                    onClick={onClose}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-active)] transition-colors duration-200 cursor-pointer"
                >
                    <X size={13} />
                </button>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] mb-3 leading-relaxed">
                {skill.longDescription || skill.description}
            </p>

            {/* 参数列表 */}
            {skill.params?.length > 0 && (
                <div className="mb-3">
                    <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wide flex items-center gap-1">
                        <Info size={10} /> 参数
                    </p>
                    <div className="space-y-1.5">
                        {skill.params.map((p) => (
                            <div key={p.name} className="flex items-start gap-2">
                                <code className="text-[10px] px-1.5 py-0.5 bg-[var(--color-bg-active)] rounded font-mono text-[var(--color-primary)] flex-shrink-0">
                                    {p.name}
                                </code>
                                <span className="text-[11px] text-[var(--color-text-secondary)]">
                                {p.required && <span className="text-[var(--color-danger)] mr-1">*</span>}
                                    {p.desc}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 示例 */}
            {skill.usageExamples?.length > 0 && (
                <div>
                    <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wide flex items-center gap-1">
                        <Lightbulb size={10} /> 示例
                    </p>
                    <div className="space-y-1.5">
                        {skill.usageExamples.slice(0, 2).map((ex, i) => (
                            <div key={i} className="p-2 bg-[var(--color-bg-active)] rounded-lg">
                                <p className="text-[11px] font-medium text-[var(--color-text-main)]">{ex.title}</p>
                                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{ex.prompt || ex.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 操作按钮 */}
            {skill.id === 'image_generation' && onTrigger && (
                <button
                    onClick={() => onTrigger(skill)}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                    <Image size={14} />
                    看看相册里的照片
                </button>
            )}
        </div>
    );
}

// ─── 单个技能推荐徽章 ─────────────────────────────────────────────────────────
function SkillBadge({ recommendation, onExpand, isExpanded }) {
    return (
        <button
            onClick={() => onExpand(recommendation.skillId)}
            className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer border',
                isExpanded
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                    : 'bg-[var(--color-bg-white)] text-[var(--color-text-main)] border-[var(--color-border-light)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
            )}
        >
            <span>{recommendation.name}</span>
            <ChevronRight size={11} className={cn('transition-transform', isExpanded && 'rotate-90')} />
        </button>
    );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
/**
 * @param {string}   messageContent  - 用于分析推荐技能的文本
 * @param {Function} onTriggerImage  - 触发图像生成的回调
 * @param {boolean}  [autoHide=true] - 5 秒后自动消失
 * @param {Function} [onDismiss]     - 关闭回调
 */
export default function SkillRecommendationBubble({
    messageContent = '',
    onTriggerImage,
    onDismiss,
}) {
    const [expandedSkillId, setExpandedSkillId] = useState(null);

    const configured = isMiniMaxConfigured();

    // Purely derived — no state, no effects
    const recommendations = useMemo(() => {
        if (!configured || !messageContent?.trim()) return [];
        return getSkillRecommendations(messageContent, 3);
    }, [messageContent, configured]);

    const handleExpand = useCallback((skillId) => {
        setExpandedSkillId((prev) => (prev === skillId ? null : skillId));
    }, []);

    const handleDismiss = useCallback(() => {
        setExpandedSkillId(null);
        onDismiss?.();
    }, [onDismiss]);

    const handleTrigger = useCallback((skill) => {
        if (skill.id === 'image_generation' && onTriggerImage) {
            onTriggerImage();
            handleDismiss();
        }
    }, [onTriggerImage, handleDismiss]);

    if (!configured || recommendations.length === 0) return null;

    const expandedSkill = expandedSkillId ? getSkillById(expandedSkillId) : null;

    return (
        <div className="mt-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
            {/* 推荐头 */}
            <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25">
                    <Sparkles size={10} className="text-[var(--color-primary)]" />
                    <span className="text-[10px] font-semibold text-[var(--color-primary-active)]">MiniMax 技能推荐</span>
                </div>
                <button
                    onClick={handleDismiss}
                    className="ml-auto w-5 h-5 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-active)] transition-colors duration-200 cursor-pointer"
                >
                    <X size={11} />
                </button>
            </div>

            {/* 技能徽章列表 */}
            <div className="flex flex-wrap gap-1.5">
                {recommendations.map((rec) => (
                    <SkillBadge
                        key={rec.skillId}
                        recommendation={rec}
                        onExpand={handleExpand}
                        isExpanded={expandedSkillId === rec.skillId}
                    />
                ))}
            </div>

            {/* 展开的技能详情 */}
            {expandedSkill && (
                <SkillDetailPanel
                    skill={expandedSkill}
                    onClose={() => setExpandedSkillId(null)}
                    onTrigger={handleTrigger}
                />
            )}
        </div>
    );
}
