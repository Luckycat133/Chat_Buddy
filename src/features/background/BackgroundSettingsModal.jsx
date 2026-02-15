import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X, Image, Upload, Sliders, Check } from 'lucide-react';
import { useBackground } from './BackgroundContext';
import { BACKGROUND_THEMES } from './themes';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const TABS = [
    { id: 'presets', label: '主题库', icon: Image },
    { id: 'custom', label: '上传', icon: Upload },
    { id: 'adjust', label: '调节', icon: Sliders },
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
    const { getBackgroundForChat, setBackgroundForChat, globalTheme, setGlobalTheme } = useBackground();
    const trapRef = useFocusTrap(isOpen);
    const [activeTab, setActiveTab] = useState('presets');
    const [activeCategory, setActiveCategory] = useState('EXCLUSIVE');

    // If chatId is present, we are editing a specific chat.
    // Otherwise, we are editing the GLOBAL theme.
    const isGlobal = !chatId;

    // Get current config: specific chat config OR global theme
    const currentConfig = isGlobal ? globalTheme : getBackgroundForChat(chatId, personaId);

    const handleUpdate = (newConfig) => {
        if (isGlobal) {
            setGlobalTheme(newConfig);
        } else {
            setBackgroundForChat(chatId, newConfig);
        }
    };

    const handleThemeSelect = (theme) => {
        handleUpdate({
            ...currentConfig,
            type: 'preset',
            value: theme.url,
        });
    };

    const handleAdjustmentChange = (key, value) => {
        handleUpdate({
            ...currentConfig,
            [key]: value
        });
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleUpdate({
                    ...currentConfig,
                    type: 'custom',
                    value: reader.result
                });
            };
            reader.readAsDataURL(file);
        }
    };

    // Derived state for category themes
    const currentThemes = BACKGROUND_THEMES[activeCategory] || [];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="presentation">
            <motion.div
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
                    <h2 id="bg-settings-title" className="text-xl font-bold text-[var(--color-text-main)]">背景设置</h2>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors" aria-label="Close">
                        <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                    </button>
                </div>

                {/* Content Layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-48 border-r border-[var(--color-border-light)] bg-[var(--color-bg-app)] flex flex-col">
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
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Main Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-gray-900/50">

                        {/* PRESETS TAB */}
                        {activeTab === 'presets' && (
                            <div className="space-y-6">
                                {/* Category Pills */}
                                <div className="flex space-x-2 overflow-x-auto pb-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setActiveCategory(cat.id)}
                                            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat.id
                                                ? 'bg-[var(--color-primary)] text-white shadow-md'
                                                : 'bg-[var(--color-bg-white)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)]'
                                                }`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Grid */}
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
                                                <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}



                        {/* CUSTOM TAB */}
                        {activeTab === 'custom' && (
                            <div className="flex flex-col items-center justify-center h-full space-y-6">
                                <div className="w-full max-w-md border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-800">
                                    <Upload className="w-12 h-12 text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">上传自定义图片</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                        支持 JPG, PNG 格式<br />建议分辨率 1920x1080 以上
                                    </p>
                                    <label className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-pointer transition-colors shadow-lg">
                                        选择文件
                                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* ADJUST TAB */}
                        {activeTab === 'adjust' && (
                            <div className="max-w-xl mx-auto space-y-8 py-8">
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-medium mb-6 flex items-center">
                                        <Sliders className="w-5 h-5 mr-2 text-blue-500" />
                                        视觉效果调节
                                    </h3>

                                    {/* Blur Control */}
                                    <div className="space-y-4 mb-8">
                                        <div className="flex justify-between">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">背景模糊</label>
                                            <span className="text-sm text-gray-500">{currentConfig.blur}px</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="20"
                                            value={currentConfig.blur || 0}
                                            onChange={(e) => handleAdjustmentChange('blur', parseInt(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>

                                    {/* Opacity Control */}
                                    <div className="space-y-4 mb-8">
                                        <div className="flex justify-between">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">透明度</label>
                                            <span className="text-sm text-gray-500">{Math.round((currentConfig.opacity || 1) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={currentConfig.opacity === undefined ? 1 : currentConfig.opacity}
                                            onChange={(e) => handleAdjustmentChange('opacity', parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>

                                    {/* Overlay Color (Simple preset selection for now) */}
                                    <div className="space-y-4">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">遮罩颜色 (提高文字可读性)</label>
                                        <div className="flex space-x-3">
                                            {['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(255,255,255,0.2)'].map((color, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleAdjustmentChange('overlayColor', color)}
                                                    className={`w-10 h-10 rounded-full border-2 ${currentConfig.overlayColor === color ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 dark:border-gray-600'
                                                        }`}
                                                    style={{ backgroundColor: color === 'rgba(0,0,0,0)' ? '#fff' : color }}
                                                    title={color}
                                                >
                                                    {color === 'rgba(0,0,0,0)' && <div className="w-full h-0.5 bg-red-500 rotate-45 transform origin-center translate-y-4"></div>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
