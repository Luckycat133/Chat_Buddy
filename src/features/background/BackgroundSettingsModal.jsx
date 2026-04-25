import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Upload, Sliders, Check, Zap, Download, FolderOpen, Video } from 'lucide-react';
import { useBackground } from './BackgroundContext';
import { BACKGROUND_THEMES, BACKGROUND_THEMES_ANIMATED } from './themes';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLanguage } from '../../context/LanguageContext';
import BackgroundShareService from './services/BackgroundShareService';

// Extract motion.div so ESLint recognises the import as used
const MotionDiv = motion.div;

const TABS = [
    { id: 'presets', labelKey: 'background_tab_presets', icon: Image },
    { id: 'dynamic', labelKey: 'background_tab_dynamic', icon: Zap },
    { id: 'custom', labelKey: 'background_tab_custom', icon: Upload },
    { id: 'adjust', labelKey: 'background_tab_adjust', icon: Sliders },
];

const CATEGORIES = [
    { id: 'EXCLUSIVE', label: '✨ 精选' },
    { id: 'DREAMY', label: '🌙 梦幻' },
    { id: 'SURREAL', label: '🌌 超现实' },
    { id: 'IP', label: '🎬 热门IP' },
    { id: 'CHARACTERS', label: '👤 角色' },
    { id: 'NATURE', label: '🍀 自然' },
    { id: 'SPACE', label: '🚀 星空' },
    { id: 'MINIMALIST', label: '🎨 简约' },
    { id: 'GAME', label: '游戏' },
    { id: 'MOVIE', label: '电影' },
    { id: 'NOVEL', label: '小说' },
    { id: 'ART', label: '艺术' },
];

export default function BackgroundSettingsModal({ isOpen, onClose, chatId, personaId }) {
    const { getBackgroundForChat, setBackgroundForChat, globalTheme, setGlobalTheme, saveCustomImage } = useBackground();
    const { t } = useLanguage();
    const trapRef = useFocusTrap(isOpen);
    const [activeTab, setActiveTab] = useState('presets');
    const [activeCategory, setActiveCategory] = useState('EXCLUSIVE');
    const [uploadStatus, setUploadStatus] = useState(null); // null | 'compressing' | 'error' | string
    const [videoUrl, setVideoUrl] = useState('');
    const importInputRef = useRef(null);

    const isGlobal = !chatId;
    const currentConfig = isGlobal ? globalTheme : getBackgroundForChat(chatId, personaId);

    const handleUpdate = (newConfig) => {
        if (isGlobal) {
            setGlobalTheme(newConfig);
        } else {
            setBackgroundForChat(chatId, newConfig);
        }
    };

    const handleThemeSelect = (theme) => {
        // Preset image themes
        handleUpdate({
            ...currentConfig,
            type: 'preset',
            value: theme.url,
        });
    };

    const handleAnimatedSelect = (theme) => {
        handleUpdate({
            ...currentConfig,
            type: 'animated',
            value: theme.id,
            animationType: theme.animationType,
            colors: theme.colors,
        });
    };

    const handleAdjustmentChange = (key, value) => {
        handleUpdate({ ...currentConfig, [key]: value });
    };

    const handleVideoApply = () => {
        if (!videoUrl.trim()) return;
        handleUpdate({
            ...currentConfig,
            type: 'video',
            value: videoUrl.trim(),
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        if (file.size > 10 * 1024 * 1024) {
            setUploadStatus('error-large');
            return;
        }

        setUploadStatus('compressing');

        try {
            const base64 = await compressImage(file);
            const imageId = await saveCustomImage(base64);
            handleUpdate({
                ...currentConfig,
                type: 'custom',
                value: imageId,
            });
            setUploadStatus('done');
            setTimeout(() => setUploadStatus(null), 2000);
        } catch (err) {
            console.error('[BackgroundSettings] Upload failed:', err);
            setUploadStatus('error');
        }
    };

    const handleExport = () => {
        BackgroundShareService.exportConfig(currentConfig);
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        try {
            const jsonStr = await file.text();
            const config = await BackgroundShareService.importConfig(jsonStr);
            handleUpdate(config);
        } catch (_err) {
            alert(t('background_import_error'));
        }
    };

    const currentThemes = BACKGROUND_THEMES[activeCategory] || [];
    const animatedThemes = BACKGROUND_THEMES_ANIMATED.ANIMATED || [];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="presentation">
            <AnimatePresence>
                {isOpen && (
                    <MotionDiv
                        ref={trapRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="bg-settings-title"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-[var(--color-bg-white)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
                            <h2 id="bg-settings-title" className="text-xl font-bold text-[var(--color-text-main)]">
                                {t('background_settings')}
                            </h2>
                            <div className="flex items-center gap-2">
                                {/* Export button */}
                                <button
                                    onClick={handleExport}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                    title={t('background_export')}
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('background_export')}</span>
                                </button>
                                {/* Import button */}
                                <button
                                    onClick={() => importInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                    title={t('background_import')}
                                >
                                    <FolderOpen className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('background_import')}</span>
                                </button>
                                <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                                <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors" aria-label="Close">
                                    <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                                </button>
                            </div>
                        </div>

                        {/* Content Layout */}
                        <div className="flex flex-1 overflow-hidden">
                            {/* Sidebar Tabs */}
                            <div className="bg-settings-sidebar w-48 border-r border-[var(--color-border-light)] bg-[var(--color-bg-app)] flex flex-col">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full text-left px-4 py-3 flex items-center space-x-3 transition-colors ${activeTab === tab.id
                                            ? 'bg-[var(--color-primary-active)]/10 text-[var(--color-primary)] border-r-2 border-[var(--color-primary)]'
                                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                                            }`}
                                    >
                                        <tab.icon className="w-5 h-5" />
                                        <span className="bg-settings-tab-label font-medium">{t(tab.labelKey)}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Main Area */}
                            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-gray-900/50">

                                {/* PRESETS TAB */}
                                {activeTab === 'presets' && (
                                    <div className="space-y-6">
                                        <div className="flex space-x-2 overflow-x-auto pb-2">
                                            {CATEGORIES.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setActiveCategory(cat.id)}
                                                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat.id
                                                        ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-md'
                                                        : 'bg-[var(--color-bg-white)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)]'
                                                        }`}
                                                >
                                                    {cat.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {currentThemes.map(theme => (
                                                <button
                                                    key={theme.id}
                                                    onClick={() => handleThemeSelect(theme)}
                                                    className="group relative aspect-video rounded-xl overflow-hidden border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    style={{
                                                        borderColor: currentConfig.value === theme.url ? '#3b82f6' : 'transparent'
                                                    }}
                                                >
                                                    <img src={theme.preview} alt={theme.name} className="w-full h-full object-cover" loading="lazy" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-white font-medium text-sm text-center px-2">{theme.name}</span>
                                                    </div>
                                                    {currentConfig.value === theme.url && (
                                                        <div className="absolute top-2 right-2 bg-[var(--color-primary)] text-[var(--color-on-primary)] p-1 rounded-full shadow-lg">
                                                            <Check className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* DYNAMIC TAB */}
                                {activeTab === 'dynamic' && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {animatedThemes.map(theme => {
                                                const isSelected = currentConfig.type === 'animated' && currentConfig.value === theme.id;
                                                const [c0, c1] = theme.colors;
                                                return (
                                                    <button
                                                        key={theme.id}
                                                        onClick={() => handleAnimatedSelect(theme)}
                                                        className={`group relative aspect-video rounded-xl overflow-hidden border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isSelected ? 'border-blue-500' : 'border-transparent'}`}
                                                    >
                                                        {/* Mini preview using gradient */}
                                                        <div
                                                            className="w-full h-full"
                                                            style={{
                                                                background: `linear-gradient(135deg, ${c0}, ${c1 || c0})`,
                                                                backgroundSize: '200% 200%',
                                                                animation: 'aurora-shift 4s ease infinite',
                                                            }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center">
                                                            <Zap className="w-6 h-6 text-white mb-1 opacity-80" />
                                                            <span className="text-white font-medium text-sm text-center px-2">{theme.name}</span>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="absolute top-2 right-2 bg-[var(--color-primary)] text-[var(--color-on-primary)] p-1 rounded-full shadow-lg">
                                                                <Check className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* CUSTOM TAB */}
                                {activeTab === 'custom' && (
                                    <div className="flex flex-col items-center justify-center min-h-full space-y-6">
                                        {/* Image Upload */}
                                        <div className="w-full max-w-md border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-800">
                                            <Upload className="w-12 h-12 text-gray-400 mb-4" />
                                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                                {t('background_upload_title')}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                                {t('background_upload_desc')}
                                            </p>
                                            {uploadStatus === 'compressing' && (
                                                <p className="text-sm text-[var(--color-primary)] mb-3">{t('background_upload_compressing')}</p>
                                            )}
                                            {uploadStatus === 'error-large' && (
                                                <p className="text-sm text-[var(--color-danger)] mb-3">{t('background_upload_too_large')}</p>
                                            )}
                                            {uploadStatus === 'done' && (
                                                <p className="text-sm text-[var(--color-success)] mb-3 flex items-center gap-1">
                                                    <Check className="w-4 h-4" /> Applied!
                                                </p>
                                            )}
                                            <label className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] rounded-lg font-medium cursor-pointer transition-colors shadow-sm">
                                                {t('background_upload_choose')}
                                                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                            </label>
                                        </div>

                                        {/* Video URL input */}
                                        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-3">
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                <Video className="w-4 h-4" />
                                                {t('background_video_url')}
                                            </div>
                                            <input
                                                type="url"
                                                value={videoUrl}
                                                onChange={(e) => setVideoUrl(e.target.value)}
                                                placeholder={t('background_video_url_placeholder')}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <button
                                                onClick={handleVideoApply}
                                                disabled={!videoUrl.trim()}
                                                className="w-full py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40 text-[var(--color-on-primary)] rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Apply Video
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ADJUST TAB */}
                                {activeTab === 'adjust' && (
                                    <div className="max-w-xl mx-auto space-y-6 py-4">
                                        {/* Visual effects card */}
                                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                                            <h3 className="text-lg font-medium mb-6 flex items-center">
                                                <Sliders className="w-5 h-5 mr-2 text-[var(--color-primary)]" />
                                                {t('background_visual_effects')}
                                            </h3>

                                            {/* Blur */}
                                            <div className="space-y-2 mb-6">
                                                <div className="flex justify-between">
                                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('background_blur')}</label>
                                                    <span className="text-sm text-gray-500">{currentConfig.blur || 0}px</span>
                                                </div>
                                                <input
                                                    type="range" min="0" max="20"
                                                    value={currentConfig.blur || 0}
                                                    onChange={(e) => handleAdjustmentChange('blur', parseInt(e.target.value))}
                                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                            </div>

                                            {/* Opacity */}
                                            <div className="space-y-2 mb-6">
                                                <div className="flex justify-between">
                                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('background_opacity')}</label>
                                                    <span className="text-sm text-gray-500">{Math.round((currentConfig.opacity ?? 1) * 100)}%</span>
                                                </div>
                                                <input
                                                    type="range" min="0" max="1" step="0.05"
                                                    value={currentConfig.opacity ?? 1}
                                                    onChange={(e) => handleAdjustmentChange('opacity', parseFloat(e.target.value))}
                                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                            </div>

                                            {/* Parallax */}
                                            <div className="space-y-2 mb-6">
                                                <div className="flex justify-between">
                                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('background_parallax_intensity')}</label>
                                                    <span className="text-sm text-gray-500">{currentConfig.parallax || 0}</span>
                                                </div>
                                                <input
                                                    type="range" min="0" max="100"
                                                    value={currentConfig.parallax || 0}
                                                    onChange={(e) => handleAdjustmentChange('parallax', parseInt(e.target.value))}
                                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                            </div>

                                            {/* Overlay Color */}
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('background_overlay')}</label>
                                                    <p className="text-xs text-gray-400 mt-0.5">{t('background_overlay_hint')}</p>
                                                </div>
                                                <div className="flex space-x-3">
                                                    {['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(255,255,255,0.2)'].map((color, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleAdjustmentChange('overlayColor', color)}
                                                            className={`w-10 h-10 rounded-full border-2 ${currentConfig.overlayColor === color ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 dark:border-gray-600'}`}
                                                            style={{ backgroundColor: color === 'rgba(0,0,0,0)' ? '#fff' : color }}
                                                            title={color}
                                                        >
                                                            {color === 'rgba(0,0,0,0)' && <div className="w-full h-0.5 bg-red-500 rotate-45 transform origin-center translate-y-4" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Time-based switching card */}
                                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                                            <h3 className="text-lg font-medium mb-4 flex items-center">
                                                <span className="mr-2">🕐</span>
                                                {t('background_time_switching')}
                                            </h3>

                                            <div className="flex items-center justify-between mb-4">
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    {t('background_auto_switch')}
                                                </label>
                                                <button
                                                    onClick={() => handleAdjustmentChange('autoSwitch', !currentConfig.autoSwitch)}
                                                    className={`relative w-12 h-6 rounded-full transition-colors ${currentConfig.autoSwitch ? 'bg-[var(--color-primary)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                                                >
                                                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${currentConfig.autoSwitch ? 'translate-x-7' : 'translate-x-1'}`} />
                                                </button>
                                            </div>

                                            {currentConfig.autoSwitch && (
                                                <div className="space-y-3 mt-4 pl-1">
                                                    <div>
                                                        <label className="text-xs text-gray-500 mb-1 block">{t('background_day_mode')} (6:00–18:00)</label>
                                                        <input
                                                            type="text"
                                                            value={currentConfig.dayValue || ''}
                                                            onChange={(e) => handleAdjustmentChange('dayValue', e.target.value)}
                                                            placeholder="Image URL or preset ID"
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-500 mb-1 block">{t('background_night_mode')} (18:00–6:00)</label>
                                                        <input
                                                            type="text"
                                                            value={currentConfig.nightValue || ''}
                                                            onChange={(e) => handleAdjustmentChange('nightValue', e.target.value)}
                                                            placeholder="Image URL or preset ID"
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Canvas image compression ──────────────────────────────── */
async function compressImage(file, maxW = 1920, maxH = 1080, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new window.Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxW || height > maxH) {
                    const ratio = Math.min(maxW / width, maxH / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = ev.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
