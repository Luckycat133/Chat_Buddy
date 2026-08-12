/**
 * T15: ModelSwitcherPanel
 * Manual model switching + token usage dashboard.
 * Reads/writes to localStorage apiConfig, shows usage stats.
 */
import React, { useRef, useState } from 'react';
import { X, Cpu, Check, ChevronRight, BarChart2, Zap } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';
import { getConfig, saveConfig } from '../config/apiConfig';
import { resetAIClient } from '../services/api/aiClient';

const MODEL_PRESETS = [
    {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'DeepSeek',
        desc: 'Fast, cost-effective general assistant',
        desc_zh: '快速、低成本的通用助手',
        badge: 'Recommended',
        badge_zh: '推荐',
        color: 'from-blue-400 to-indigo-500',
        input_price: 0.14,   // USD per M tokens
        output_price: 0.28,
    },
    {
        id: 'deepseek-reasoner',
        name: 'DeepSeek R1',
        provider: 'DeepSeek',
        desc: 'Chain-of-thought reasoning model',
        desc_zh: '思维链推理模型',
        badge: 'Reasoning',
        badge_zh: '推理',
        color: 'from-purple-400 to-pink-500',
        input_price: 0.55,
        output_price: 2.19,
    },
    {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        provider: 'Anthropic',
        desc: 'Balanced performance and capability',
        desc_zh: '均衡的性能与能力',
        badge: 'Advanced',
        badge_zh: '高级',
        color: 'from-orange-400 to-red-500',
        input_price: 3.0,
        output_price: 15.0,
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        desc: 'Lightweight GPT-4 class model',
        desc_zh: '轻量级 GPT-4 级模型',
        badge: null,
        color: 'from-emerald-400 to-teal-500',
        input_price: 0.15,
        output_price: 0.60,
    },
    {
        id: 'custom',
        name: 'Custom Model',
        provider: 'Custom',
        desc: 'Any OpenAI-compatible model',
        desc_zh: '任意 OpenAI 兼容模型',
        badge: null,
        color: 'from-gray-400 to-gray-600',
        input_price: null,
        output_price: null,
    },
];

function getApiConfig() {
    return getConfig();
}

function saveModelPreference(modelId) {
    saveConfig({ ...getConfig(), model: modelId });
    resetAIClient();
}

function getUsageStats() {
    try {
        const raw = localStorage.getItem('chat-buddy-token-usage');
        return raw ? JSON.parse(raw) : { totalInput: 0, totalOutput: 0, sessions: 0 };
    } catch { return { totalInput: 0, totalOutput: 0, sessions: 0 }; }
}

function formatNum(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
}

export default function ModelSwitcherPanel({ onClose }) {
    const { t, language } = useLanguage();
    const [currentModel, setCurrentModel] = useState(() => {
        const cfg = getApiConfig();
        const model = cfg.model || import.meta.env?.VITE_AI_MODEL || 'deepseek-chat';
        const preset = MODEL_PRESETS.find(m => m.id === model);
        return preset ? model : 'custom';
    });
    const [customModel, setCustomModel] = useState(() => {
        const cfg = getApiConfig();
        const model = cfg.model || import.meta.env?.VITE_AI_MODEL || 'deepseek-chat';
        const preset = MODEL_PRESETS.find(m => m.id === model);
        return preset ? '' : model;
    });
    const [usage] = useState(() => getUsageStats());
    const [saved, setSaved] = useState(false);
    const dialogRef = useRef(null);
    useDialogFocusTrap(dialogRef, onClose);

    const handleSelect = (modelId) => {
        setCurrentModel(modelId);
        setSaved(false);
    };

    const handleSave = () => {
        const modelToSave = currentModel === 'custom' ? customModel.trim() : currentModel;
        if (!modelToSave) return;
        saveModelPreference(modelToSave);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const selectedPreset = MODEL_PRESETS.find(m => m.id === currentModel);

    return (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onMouseDown={onClose} aria-hidden="true" />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="model-switcher-title"
                aria-describedby="model-switcher-description"
                tabIndex={-1}
                className="relative w-full max-w-md glass-crystal rounded-[var(--radius-2xl)] shadow-floating flex flex-col max-h-[85vh] overflow-hidden animate-scale-spring outline-none"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[var(--radius-lg)] bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                            <Cpu size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 id="model-switcher-title" className="font-display font-bold text-[var(--color-text-main)]">{t('model_switcher_title')}</h2>
                            <p id="model-switcher-description" className="text-xs text-[var(--color-text-muted)]">{t('model_switcher_desc')}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label={t('close') || 'Close'} className="min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
                    {/* Model List */}
                    <div className="space-y-2">
                        {MODEL_PRESETS.map(preset => {
                            const isActive = currentModel === preset.id;
                            return (
                                <button
                                    type="button"
                                    key={preset.id}
                                    onClick={() => handleSelect(preset.id)}
                                    aria-pressed={isActive}
                                    className={cn(
                                        'w-full flex items-center gap-3 p-3.5 rounded-[var(--radius-xl)] border transition-all text-left',
                                        isActive
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                            : 'border-[var(--color-border)] bg-[var(--color-bg-white)] hover:bg-[var(--color-bg-hover)]'
                                    )}
                                >
                                    <div className={`w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br ${preset.color} flex items-center justify-center shrink-0`}>
                                        <Zap size={16} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-[var(--color-text-main)]">{preset.name}</span>
                                            {preset.badge && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold">
                                                    {language === 'zh' ? preset.badge_zh : preset.badge}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[var(--color-text-muted)] truncate">
                                            {preset.provider} · {language === 'zh' ? preset.desc_zh : preset.desc}
                                        </p>
                                        {preset.input_price !== null && (
                                            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                                                ${preset.input_price}/M in · ${preset.output_price}/M out
                                            </p>
                                        )}
                                    </div>
                                    {isActive && <Check size={16} className="text-[var(--color-primary)] shrink-0" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom model input */}
                    {currentModel === 'custom' && (
                        <label className="block text-sm font-medium text-[var(--color-text-main)]">
                            {t('custom_model') || 'Custom model'}
                            <input
                                type="text"
                                value={customModel}
                                onChange={e => setCustomModel(e.target.value)}
                                placeholder="e.g. mistral-7b, llama3-70b..."
                                className="mt-2 w-full input-modern text-sm"
                            />
                        </label>
                    )}

                    {/* Usage Stats */}
                    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-white)] overflow-hidden">
                        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[var(--color-border-light)]">
                            <BarChart2 size={13} className="text-[var(--color-primary)]" />
                            <span className="text-xs font-semibold text-[var(--color-text-main)]">{t('token_usage')}</span>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-[var(--color-border-light)]">
                            {[
                                { label: t('tokens_input'), value: formatNum(usage.totalInput) },
                                { label: t('tokens_output'), value: formatNum(usage.totalOutput) },
                                { label: t('token_sessions'), value: formatNum(usage.sessions) },
                            ].map(stat => (
                                <div key={stat.label} className="text-center px-3 py-3">
                                    <div className="text-lg font-display font-bold text-[var(--color-text-main)]">{stat.value}</div>
                                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                        {selectedPreset?.input_price && usage.totalInput > 0 && (
                            <div className="px-3.5 pb-3 pt-1 text-xs text-[var(--color-text-muted)] text-center border-t border-[var(--color-border-light)]">
                                {t('estimated_cost')}: $
                                {((usage.totalInput / 1_000_000) * selectedPreset.input_price +
                                    (usage.totalOutput / 1_000_000) * selectedPreset.output_price).toFixed(4)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-5 pt-3 pb-5 border-t border-[var(--color-border)]">
                    <button
                        type="button"
                        onClick={handleSave}
                        className={cn(
                            'flex-1 py-2.5 rounded-[var(--radius-xl)] font-semibold text-sm transition-all',
                            saved
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-coral)] text-white hover:opacity-90 active:scale-[0.98]'
                        )}
                    >
                        <span aria-live="polite">{saved ? `✓ ${t('saved')}` : t('save_model')}</span>
                    </button>
                    <button type="button" onClick={onClose} className="min-h-11 px-4 py-2.5 rounded-[var(--radius-xl)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors">
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
}
