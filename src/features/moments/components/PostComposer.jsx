import React, { useEffect, useRef, useState } from 'react';
import {
    Check, ChevronDown, Eye, Image as ImageIcon, Lightbulb,
    MapPin, Sparkles, Wand2, X, Smile, Type, Hash,
} from 'lucide-react';
import { useMoments } from '../context/MomentsContext';
import { useUser } from '../../../context/UserContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';
import {
    buildPersonalizedMomentRecommendations,
    evaluateMomentDraft,
    detectMomentLanguage,
} from '../services/momentsContentService';

const PRESET_LOCATIONS = [
    { en: 'Home', zh: '家里' },
    { en: 'Office', zh: '办公室' },
    { en: 'Café', zh: '咖啡厅' },
    { en: 'Restaurant', zh: '餐厅' },
    { en: 'Park', zh: '公园' },
    { en: 'Gym', zh: '健身房' },
    { en: 'Shopping Mall', zh: '商场' },
    { en: 'Movie Theater', zh: '电影院' },
    { en: 'Beach', zh: '海边' },
    { en: 'On the move', zh: '路上' },
    { en: 'Library', zh: '图书馆' },
    { en: 'Museum', zh: '博物馆' },
];

const VISIBILITY_OPTIONS = [
    { value: 'public', icon: '🌍', en: 'Everyone', zh: '所有人可见' },
    { value: 'partial', icon: '👥', en: 'Selected friends', zh: '部分好友' },
    { value: 'private', icon: '🔒', en: 'Only me', zh: '仅自己' },
];

// 内容质量指示点
const STATUS_COLORS = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-400',
    tip: 'bg-sky-500',
    idle: 'bg-slate-200',
};

function QualityPill({ item }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white/80 px-3 py-3">
            <span className={cn('mt-1 h-2 w-2 flex-shrink-0 rounded-full', STATUS_COLORS[item.status] || STATUS_COLORS.idle)} />
            <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--color-text-main)]">{item.label}</div>
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--color-text-muted)]">{item.detail}</p>
            </div>
        </div>
    );
}

// 语言混用警告 Banner
function LanguageMixedBanner({ content, language }) {
    const detected = content ? detectMomentLanguage(content) : 'neutral';
    const isMixed = detected === 'mixed';

    if (!isMixed) return null;

    return (
        <div className="flex items-center gap-2 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
            <Type size={13} className="flex-shrink-0" />
            <span>
                {language === 'zh'
                    ? '检测到中英文混用，发布前建议统一语言风格。'
                    : 'Bilingual text detected. Consider using one language for clarity.'}
            </span>
        </div>
    );
}

export default function PostComposer({ isOpen, onClose, initialPrompt = '' }) {
    const { createPost, draft, saveDraft, clearDraft, generateWritingAssist } = useMoments();
    const { userProfile, getDisplayName } = useUser();
    const { t, language, resolvedAiLanguage } = useLanguage();

    const [content, setContent] = useState('');
    const [images, setImages] = useState([]);
    const [isPosting, setIsPosting] = useState(false);
    const [location, setLocation] = useState('');
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [customLocation, setCustomLocation] = useState('');
    const [visibility, setVisibility] = useState('public');
    const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
    const [draftBanner, setDraftBanner] = useState(false);
    const [assistResult, setAssistResult] = useState(null);
    const [isGeneratingAssist, setIsGeneratingAssist] = useState(false);
    const [activeTab, setActiveTab] = useState('write'); // 'write' | 'ai'
    const fileInputRef = useRef(null);
    const draftTimerRef = useRef(null);
    const textareaRef = useRef(null);

    // 恢复草稿 / 应用 initialPrompt
    useEffect(() => {
        if (!isOpen) return;

        if (initialPrompt) {
            setContent(initialPrompt);
            setImages([]);
            setAssistResult(null);
            setActiveTab('write');
            return;
        }

        if (draft && (draft.content || draft.images?.length > 0 || draft.location)) {
            setContent(draft.content || '');
            setImages(draft.images || []);
            setLocation(draft.location || '');
            setVisibility(draft.visibility || 'public');
            setDraftBanner(true);
            setTimeout(() => setDraftBanner(false), 3000);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialPrompt]);

    // 自动保存草稿
    useEffect(() => {
        if (!isOpen) return;
        if (content || images.length > 0 || location) {
            if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
            draftTimerRef.current = setTimeout(() => {
                saveDraft({ content, images, location, visibility });
            }, 600);
        }
        return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
    }, [content, images, isOpen, location, saveDraft, visibility]);

    if (!isOpen) return null;

    const qualityChecks = evaluateMomentDraft(content, resolvedAiLanguage);
    const starterIdeas = buildPersonalizedMomentRecommendations([], language);
    const canPost = content.trim() || images.length > 0;

    // 处理图片选择（含压缩）
    const handleImageSelect = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        files.slice(0, 9 - images.length).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 1400;
                    let { width, height } = img;
                    if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
                    else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
                    setImages(prev => [...prev, dataUrl].slice(0, 9));
                };
                img.src = loadEvent.target.result;
            };
            reader.readAsDataURL(file);
        });
        event.target.value = '';
    };

    const handlePost = () => {
        if (!canPost || isPosting) return;
        setIsPosting(true);
        createPost(content.trim(), images, null, 'user-me', {
            location: location || null,
            visibility,
            visibleTo: null,
            hiddenFrom: null,
            language: resolvedAiLanguage,
            storyTitle: assistResult?.title || null,
            hashtags: assistResult?.hashtags || [],
            aiAssist: assistResult ? { ...assistResult, generatedAt: new Date().toISOString() } : null,
        });
        clearDraft();
        setContent(''); setImages([]); setLocation('');
        setVisibility('public'); setAssistResult(null);
        setIsPosting(false);
        onClose();
    };

    const handleDiscard = () => {
        clearDraft();
        setContent(''); setImages([]); setLocation('');
        setAssistResult(null); setDraftBanner(false);
    };

    const runAssist = async () => {
        setIsGeneratingAssist(true);
        try {
            const result = await generateWritingAssist({ content, location });
            setAssistResult(result);
            setActiveTab('ai');
        } finally {
            setIsGeneratingAssist(false);
        }
    };

    const applyAssistContent = () => {
        if (!assistResult) return;
        const hashtags = (assistResult.hashtags || []).join(' ');
        const combined = `${assistResult.polishedContent}${hashtags ? '\n\n' + hashtags : ''}`.trim();
        setContent(combined);
        setActiveTab('write');
        setTimeout(() => textareaRef.current?.focus(), 100);
    };

    const selectLocation = (item) => {
        setLocation(language === 'zh' ? item.zh : item.en);
        setShowLocationPicker(false);
    };

    const applyCustomLocation = () => {
        if (!customLocation.trim()) return;
        setLocation(customLocation.trim());
        setCustomLocation('');
        setShowLocationPicker(false);
    };

    const getVisibilityLabel = () => {
        const cur = VISIBILITY_OPTIONS.find(o => o.value === visibility);
        return cur ? (language === 'zh' ? cur.zh : cur.en) : '';
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-composer-title"
            className="fixed inset-0 z-50 flex flex-col bg-[rgba(255,251,247,0.97)] backdrop-blur-sm"
        >
            {/* 顶栏 */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 py-3.5 md:px-6">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('close') || '关闭'}
                    className="rounded-full p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-app)]"
                >
                    <X size={22} />
                </button>

                <div className="text-center">
                    <h3 id="post-composer-title" className="text-[16px] font-bold text-[var(--color-text-main)]">
                        {t('new_post') || '发布动态'}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                        {language === 'zh' ? '用一点文字，把今天留住。' : 'Capture today in a few words.'}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handlePost}
                    disabled={isPosting || !canPost}
                    className={cn(
                        'rounded-full px-5 py-2 text-[14px] font-bold transition-all',
                        canPost
                            ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 active:scale-95'
                            : 'bg-[var(--color-bg-app)] text-[var(--color-text-light)]'
                    )}
                >
                    {t('post') || '发布'}
                </button>
            </div>

            {/* 主内容 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
                <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">

                    {/* 左列：编辑区 */}
                    <section className="space-y-4">
                        {/* 草稿恢复提示 */}
                        {draftBanner && (
                            <div className="flex items-center justify-between rounded-2xl bg-[var(--color-primary)]/10 px-4 py-2.5">
                                <span className="text-[13px] font-medium text-[var(--color-primary)]">
                                    {t('draft_restored') || '草稿已恢复'}
                                </span>
                                <button type="button" onClick={handleDiscard} className="text-[12px] text-[var(--color-text-muted)] underline">
                                    {t('discard_draft') || '丢弃'}
                                </button>
                            </div>
                        )}

                        {/* 用户信息 + textarea */}
                        <div className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-bg-white)] shadow-sm">
                            <div className="flex items-center gap-3 border-b border-[var(--color-border-light)] px-4 py-3">
                                {/* 头像 */}
                                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-[12px] bg-[var(--color-primary)]">
                                    {userProfile?.avatar ? (
                                        <img src={userProfile.avatar} alt="me" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center font-bold text-white">
                                            {getDisplayName(language).charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="text-[14px] font-semibold text-[var(--color-text-main)]">
                                        {getDisplayName(language)}
                                    </div>
                                    {/* 可见性选择 */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowVisibilityPicker(v => !v)}
                                            className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-app)] px-2.5 py-0.5 text-[11px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)]"
                                        >
                                            <Eye size={11} />
                                            {getVisibilityLabel()}
                                            <ChevronDown size={10} />
                                        </button>
                                        {showVisibilityPicker && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setShowVisibilityPicker(false)} />
                                                <div className="absolute left-0 top-8 z-20 min-w-[180px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-xl">
                                                    {VISIBILITY_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => { setVisibility(opt.value); setShowVisibilityPicker(false); }}
                                                            className={cn(
                                                                'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                                                visibility === opt.value ? 'bg-[var(--color-primary)]/8' : 'hover:bg-[var(--color-bg-app)]'
                                                            )}
                                                        >
                                                            <span>{opt.icon}</span>
                                                            <span className="flex-1 text-[13px] text-[var(--color-text-main)]">
                                                                {language === 'zh' ? opt.zh : opt.en}
                                                            </span>
                                                            {visibility === opt.value && <Check size={15} className="text-[var(--color-primary)]" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 文本区 */}
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder={t('whats_new') || (language === 'zh' ? '有什么想分享的？记录今天的一个瞬间…' : "What's on your mind? Capture a moment from today...")}
                                className="min-h-[180px] w-full resize-none bg-transparent px-4 py-4 text-[16px] leading-8 outline-none placeholder:text-[var(--color-text-light)]"
                                autoFocus
                            />

                            {/* 语言混杂警告 */}
                            {content && (
                                <div className="px-4 pb-2">
                                    <LanguageMixedBanner content={content} language={language} />
                                </div>
                            )}

                            {/* 图片预览 */}
                            {images.length > 0 && (
                                <div className={cn(
                                    'grid gap-1.5 px-4 pb-4',
                                    images.length === 1 && 'grid-cols-1 max-w-[min(100%,18rem)]',
                                    images.length === 2 && 'grid-cols-2',
                                    images.length >= 3 && 'grid-cols-3'
                                )}>
                                    {images.map((img, i) => (
                                        <div key={i} className="relative aspect-square">
                                            <img src={img} alt="" className="h-full w-full rounded-2xl object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {images.length < 9 && (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                                        >
                                            <ImageIcon size={24} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* 位置标签 */}
                            {location && (
                                <div className="px-4 pb-4">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,157,74,0.12)] px-3 py-1.5 text-[13px] text-[var(--color-primary)]">
                                        <MapPin size={14} />
                                        <span>{location}</span>
                                        <button type="button" onClick={() => setLocation('')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* AI 辅助区 */}
                        <div className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-bg-white)] shadow-sm">
                            {/* Tab 切换 */}
                            <div className="flex border-b border-[var(--color-border)]">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('write')}
                                    className={cn(
                                        'flex-1 py-3 text-[13px] font-semibold transition-colors',
                                        activeTab === 'write'
                                            ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                    )}
                                >
                                    {language === 'zh' ? '快速开始' : 'Quick Start'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('ai')}
                                    className={cn(
                                        'flex flex-1 items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-colors',
                                        activeTab === 'ai'
                                            ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                    )}
                                >
                                    <Sparkles size={13} />
                                    {language === 'zh' ? 'AI 优化' : 'AI Polish'}
                                    {assistResult && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                                </button>
                            </div>

                            <div className="p-4">
                                {activeTab === 'write' ? (
                                    <div className="space-y-2">
                                        <p className="text-[12px] text-[var(--color-text-muted)]">
                                            {language === 'zh' ? '点击一个主题快速填入初稿：' : 'Tap a prompt to start writing:'}
                                        </p>
                                        {starterIdeas.map(item => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => { setContent(item.prompt); setTimeout(() => textareaRef.current?.focus(), 50); }}
                                                className="flex w-full items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-3 text-left transition-all hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5"
                                            >
                                                <Hash size={14} className="mt-0.5 flex-shrink-0 text-[var(--color-primary)]" />
                                                <div>
                                                    <div className="text-[13px] font-semibold text-[var(--color-text-main)]">{item.title}</div>
                                                    <div className="mt-0.5 text-[12px] leading-5 text-[var(--color-text-muted)] line-clamp-2">{item.prompt}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-[14px] font-semibold text-[var(--color-text-main)]">
                                                    {language === 'zh' ? 'AI 帮你润色' : 'AI enhancement'}
                                                </div>
                                                <p className="mt-0.5 text-[12px] leading-5 text-[var(--color-text-muted)]">
                                                    {language === 'zh'
                                                        ? '统一语言风格、补充故事感、优化互动引导。'
                                                        : 'Clean language, add story flow, and invite replies.'}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={runAssist}
                                                disabled={isGeneratingAssist}
                                                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                                            >
                                                <Wand2 size={14} />
                                                {isGeneratingAssist
                                                    ? (language === 'zh' ? '优化中…' : 'Working…')
                                                    : (content.trim()
                                                        ? (language === 'zh' ? 'AI 润色' : 'Polish')
                                                        : (language === 'zh' ? 'AI 起稿' : 'Draft'))}
                                            </button>
                                        </div>

                                        {assistResult && (
                                            <div className="rounded-2xl border border-[rgba(255,157,74,0.20)] bg-[rgba(255,157,74,0.06)] p-4">
                                                <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--color-text-main)]">
                                                    <Lightbulb size={14} className="text-[var(--color-primary)]" />
                                                    {assistResult.title}
                                                </div>
                                                <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-7 text-[var(--color-text-main)]">
                                                    {assistResult.polishedContent}
                                                </p>
                                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                    {(assistResult.hashtags || []).map(tag => (
                                                        <span key={tag} className="rounded-full bg-white/80 px-2.5 py-0.5 text-[12px] font-medium text-[var(--color-primary)]">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={applyAssistContent}
                                                        className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-[13px] font-semibold text-white hover:opacity-90"
                                                    >
                                                        {language === 'zh' ? '应用全文' : 'Apply all'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setContent(prev => `${prev}${prev ? '\n\n' : ''}${(assistResult.hashtags || []).join(' ')}`.trim())}
                                                        className="rounded-full border border-[var(--color-border)] bg-white/80 px-4 py-1.5 text-[13px] font-semibold text-[var(--color-text-main)] hover:bg-white"
                                                    >
                                                        {language === 'zh' ? '仅追加标签' : 'Tags only'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {assistResult?.suggestions?.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="text-[12px] font-semibold text-[var(--color-text-muted)]">
                                                    {language === 'zh' ? 'AI 建议' : 'Writing tips'}
                                                </div>
                                                {assistResult.suggestions.map(tip => (
                                                    <div key={tip} className="flex items-start gap-2 text-[12px] leading-5 text-[var(--color-text-muted)]">
                                                        <Smile size={12} className="mt-0.5 flex-shrink-0 text-[var(--color-primary)]" />
                                                        <span>{tip}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* 右列：质量检查（桌面端） */}
                    <aside className="hidden space-y-4 lg:block">
                        <div className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[linear-gradient(160deg,rgba(255,255,255,0.99),rgba(255,246,238,0.95))] p-4 shadow-sm">
                            <div className="text-[14px] font-bold text-[var(--color-text-main)]">
                                {language === 'zh' ? '发布前检查' : 'Quality Check'}
                            </div>
                            <div className="mt-3 space-y-2.5">
                                {qualityChecks.map(item => (
                                    <QualityPill key={item.id} item={item} />
                                ))}
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-bg-white)] p-4 shadow-sm">
                            <div className="text-[13px] font-semibold text-[var(--color-text-muted)]">
                                {language === 'zh' ? '发布技巧' : 'Tips'}
                            </div>
                            <div className="mt-3 space-y-2 text-[12px] leading-5 text-[var(--color-text-muted)]">
                                <p>💬 {language === 'zh' ? '结尾加一个问句，评论区更容易热起来。' : 'End with a question to spark more replies.'}</p>
                                <p>🎨 {language === 'zh' ? '配一张图，互动率平均高 3 倍。' : 'Posts with images get 3× more engagement.'}</p>
                                <p>📍 {language === 'zh' ? '标注位置给内容加一点现场感。' : 'Location tags add a sense of presence.'}</p>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {/* 底部工具栏 */}
            <div className="flex-shrink-0 border-t border-[var(--color-border)] px-4 py-3 md:px-6">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={images.length >= 9}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium transition-colors',
                            images.length >= 9
                                ? 'text-[var(--color-text-light)]'
                                : 'text-[var(--color-primary)] hover:bg-[var(--color-bg-app)]'
                        )}
                    >
                        <ImageIcon size={18} />
                        <span>{t('add_photos') || '图片'}</span>
                        {images.length > 0 && <span className="text-[var(--color-text-muted)]">({images.length}/9)</span>}
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowLocationPicker(true)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium transition-colors',
                            location ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-app)] hover:text-[var(--color-primary)]'
                        )}
                    >
                        <MapPin size={18} />
                        <span>{location || (t('location') || '位置')}</span>
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                        <span className={cn(
                            'text-[12px]',
                            content.length > 400 ? 'text-amber-500' : 'text-[var(--color-text-muted)]'
                        )}>
                            {content.length}
                        </span>
                    </div>
                </div>
            </div>

            {/* 位置选择器 — portal style fixed overlay */}
            {showLocationPicker && (
                <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--color-bg-white)]">
                    <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5">
                        <button
                            type="button"
                            onClick={() => setShowLocationPicker(false)}
                            className="rounded-full p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-app)]"
                        >
                            <X size={22} />
                        </button>
                        <h3 className="text-[16px] font-bold text-[var(--color-text-main)]">
                            {t('add_location') || '选择位置'}
                        </h3>
                    </div>

                    <div className="border-b border-[var(--color-border)] p-4">
                        <div className="flex gap-2">
                            <input
                                autoFocus
                                type="text"
                                value={customLocation}
                                onChange={e => setCustomLocation(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') applyCustomLocation(); }}
                                placeholder={language === 'zh' ? '输入自定义位置…' : 'Enter a custom location…'}
                                className="flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--color-primary)]/40"
                            />
                            <button
                                type="button"
                                onClick={applyCustomLocation}
                                disabled={!customLocation.trim()}
                                className={cn(
                                    'rounded-2xl px-4 py-2.5 text-[14px] font-semibold transition-all',
                                    customLocation.trim()
                                        ? 'bg-[var(--color-primary)] text-white'
                                        : 'bg-[var(--color-bg-app)] text-[var(--color-text-muted)]'
                                )}
                            >
                                {t('confirm') || '确定'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {PRESET_LOCATIONS.map(item => (
                            <button
                                key={item.en}
                                type="button"
                                onClick={() => selectLocation(item)}
                                className={cn(
                                    'flex w-full items-center gap-3 border-b border-[var(--color-border-light)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-bg-app)]',
                                    location === (language === 'zh' ? item.zh : item.en) && 'bg-[var(--color-primary)]/5'
                                )}
                            >
                                <MapPin size={17} className="text-[var(--color-text-muted)]" />
                                <span className="flex-1 text-[14px] text-[var(--color-text-main)]">
                                    {language === 'zh' ? item.zh : item.en}
                                </span>
                                {location === (language === 'zh' ? item.zh : item.en) && (
                                    <Check size={16} className="text-[var(--color-primary)]" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
