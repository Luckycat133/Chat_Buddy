/**
 * T13: AgentEditorModal
 * Create or edit a custom AI agent.
 * iOS 26 Liquid Glass design — reusable from AgentsPage and future character creation.
 */
import React, { useState } from 'react';
import { X, Bot, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { useLanguage } from '../context/LanguageContext';
import { AGENT_SKILLS } from '../data/agentSkills';
import { useFocusTrap } from '../hooks/useFocusTrap';

const GRADIENT_OPTIONS = [
    { label: 'Ocean',    value: 'from-blue-500 to-cyan-400',    preview: 'linear-gradient(135deg, #3b82f6, #22d3ee)' },
    { label: 'Sunset',   value: 'from-orange-500 to-pink-500',  preview: 'linear-gradient(135deg, #f97316, #ec4899)' },
    { label: 'Forest',   value: 'from-green-500 to-teal-400',   preview: 'linear-gradient(135deg, #22c55e, #2dd4bf)' },
    { label: 'Galaxy',   value: 'from-purple-600 to-indigo-500',preview: 'linear-gradient(135deg, #9333ea, #6366f1)' },
    { label: 'Gold',     value: 'from-yellow-400 to-orange-400',preview: 'linear-gradient(135deg, #facc15, #fb923c)' },
    { label: 'Rose',     value: 'from-rose-500 to-pink-400',    preview: 'linear-gradient(135deg, #f43f5e, #f472b6)' },
];

const SKILL_OPTIONS = Object.values(AGENT_SKILLS).map(s => ({
    id: s.id,
    label: s.name,
    label_zh: s.name_zh || s.name,
    category: s.category,
}));

const CATEGORY_ORDER = ['programming', 'creative', 'research', 'education', 'emotional', 'design'];

/**
 * @param {Object}   props
 * @param {boolean}  props.isOpen
 * @param {Object|null} props.agent  - null = create mode, object = edit mode
 * @param {Function} props.onSave    - (agentData) => void
 * @param {Function} props.onDelete  - (agentId) => void
 * @param {Function} props.onClose
 */
export default function AgentEditorModal(props) {
    if (!props.isOpen) return null;

    return <AgentEditorForm key={props.agent?.id || 'new-agent'} {...props} />;
}

function AgentEditorForm({ agent, onSave, onDelete, onClose }) {
    const { language, t } = useLanguage();
    const trapRef = useFocusTrap(true, onClose);

    const [name, setName]           = useState(() => agent?.name || '');
    const [nameZh, setNameZh]       = useState(() => agent?.name_zh || '');
    const [personality, setPersonality] = useState(() => agent?.personality || '');
    const [systemPrompt, setSystemPrompt] = useState(() => agent?.systemPrompt || '');
    const [selectedSkills, setSelectedSkills] = useState(() => agent?.skills || []);
    const [color, setColor]         = useState(() => agent?.color || GRADIENT_OPTIONS[0].value);
    const [saving, setSaving]       = useState(false);
    const [error, setError]         = useState('');

    const isEdit = Boolean(agent?.id);

    const toggleSkill = (skillId) => {
        setSelectedSkills(prev =>
            prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]
        );
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) { setError(language === 'zh' ? '请输入助手名称' : 'Name is required'); return; }
        if (!systemPrompt.trim()) { setError(language === 'zh' ? '请输入系统提示词' : 'System prompt is required'); return; }

        setSaving(true);
        setError('');
        try {
            await onSave({
                ...(agent || {}),
                name: trimmedName,
                name_zh: nameZh.trim() || trimmedName,
                personality: personality.trim(),
                systemPrompt: systemPrompt.trim(),
                skills: selectedSkills,
                color,
            });
            onClose();
        } catch (e) {
            setError(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!agent?.id) return;
        if (!window.confirm(language === 'zh' ? `确定删除「${agent.name}」吗？` : `Delete "${agent.name}"?`)) return;
        await onDelete(agent.id);
        onClose();
    };

    const selectedGradient = GRADIENT_OPTIONS.find(g => g.value === color) || GRADIENT_OPTIONS[0];

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="agent-editor-title">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Sheet */}
            <div ref={trapRef} tabIndex={-1} className={cn(
                'relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col',
                'glass-strong rounded-3xl border border-[var(--color-border)] shadow-floating',
                'animate-scale-spring',
            )}>
                {/* Header */}
                <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-[var(--color-border-light)] shrink-0">
                    <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{ background: selectedGradient.preview }}
                    >
                        <Bot size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 id="agent-editor-title" className="font-display font-bold text-lg text-[var(--color-text-main)]">
                            {isEdit
                                ? (language === 'zh' ? '编辑助手' : 'Edit Agent')
                                : (language === 'zh' ? '创建自定义助手' : 'Create Custom Agent')}
                        </h2>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {language === 'zh' ? '定义专属 AI 助手的角色和能力' : 'Define a specialized AI assistant'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label={t('close')} className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">
                    {/* Name */}
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
                                {t('agent_editor_name')} *
                            </span>
                            <input
                                autoFocus
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder={t('agent_editor_name_placeholder')}
                                className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm placeholder:text-[var(--color-text-light)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
                                {t('agent_editor_name_zh')}
                            </span>
                            <input
                                value={nameZh}
                                onChange={e => setNameZh(e.target.value)}
                                placeholder={t('agent_editor_name_zh_placeholder')}
                                className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm placeholder:text-[var(--color-text-light)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                            />
                        </label>
                    </div>

                    {/* Personality */}
                    <label className="block">
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
                            {t('agent_editor_desc')}
                        </span>
                        <input
                            value={personality}
                            onChange={e => setPersonality(e.target.value)}
                            placeholder={t('agent_editor_desc_placeholder')}
                            className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm placeholder:text-[var(--color-text-light)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                        />
                    </label>

                    {/* System Prompt */}
                    <label className="block">
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Sparkles size={11} className="text-[var(--color-primary)]" />
                            {t('agent_editor_system_prompt')} *
                        </span>
                        <textarea
                            value={systemPrompt}
                            onChange={e => setSystemPrompt(e.target.value)}
                            rows={6}
                            placeholder={t('agent_editor_prompt_placeholder')}
                            className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm placeholder:text-[var(--color-text-light)] focus:outline-none focus:border-[var(--color-primary)] transition-colors resize-none font-mono leading-relaxed"
                        />
                    </label>

                    {/* Color */}
                    <div>
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">
                            {t('agent_editor_theme')}
                        </span>
                        <div className="flex gap-2 flex-wrap">
                            {GRADIENT_OPTIONS.map(g => (
                                <button
                                    key={g.value}
                                    onClick={() => setColor(g.value)}
                                    title={g.label}
                                    aria-label={g.label}
                                    aria-pressed={color === g.value}
                                    className={cn(
                                        'w-11 h-11 rounded-xl transition-all duration-200',
                                        color === g.value ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-transparent scale-110' : 'hover:scale-105',
                                    )}
                                    style={{ background: g.preview }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Skills */}
                    <div>
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">
                            {t('agent_editor_skills')}
                        </span>
                        <div className="space-y-3">
                            {CATEGORY_ORDER.map(cat => {
                                const skills = SKILL_OPTIONS.filter(s => s.category === cat);
                                if (!skills.length) return null;
                                return (
                                    <div key={cat}>
                                        <p className="text-[10px] font-bold text-[var(--color-text-light)] uppercase tracking-wider mb-1.5 capitalize">{cat}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {skills.map(s => {
                                                const active = selectedSkills.includes(s.id);
                                                return (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        onClick={() => toggleSkill(s.id)}
                                                        aria-pressed={active}
                                                        className={cn(
                                                            'min-h-11 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all duration-150',
                                                            active
                                                                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                                                                : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/50',
                                                        )}
                                                    >
                                                        {language === 'zh' ? s.label_zh : s.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-400 font-medium">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-[var(--color-border-light)] shrink-0">
                    {isEdit && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            aria-label={t('delete')}
                            className="min-h-11 min-w-11 p-2.5 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors"
                            title={t('delete')}
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-11 px-4 py-2 rounded-xl text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="min-h-11 px-5 py-2 rounded-xl text-sm font-bold text-[var(--color-on-primary)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                    >
                        {saving ? t('saving') : t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
