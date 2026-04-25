import React, { useState, useRef } from 'react';
import { X, Plus, Upload, Check, Sparkles, Palette, User, Heart, MessageCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

/**
 * Phase 4: Character Creator Modal
 * Allows users to create custom AI personas
 * Features: name (EN/ZH), personality, interests, speaking style, avatar upload, theme color
 */

// Speaking style presets
const SPEAKING_STYLES = [
    { id: 'casual', name: 'Casual', name_zh: '随性', desc: 'Relaxed and friendly', desc_zh: '轻松友好' },
    { id: 'formal', name: 'Formal', name_zh: '正式', desc: 'Polite and professional', desc_zh: '礼貌专业' },
    { id: 'witty', name: 'Witty', name_zh: '机智', desc: 'Clever with humor', desc_zh: '聪明幽默' },
    { id: 'warm', name: 'Warm', name_zh: '温暖', desc: 'Caring and empathetic', desc_zh: '关心体贴' },
    { id: 'energetic', name: 'Energetic', name_zh: '活力', desc: 'Enthusiastic and lively', desc_zh: '热情活泼' },
    { id: 'mysterious', name: 'Mysterious', name_zh: '神秘', desc: 'Intriguing and deep', desc_zh: '引人入胜' },
];

// Theme color presets
const THEME_COLORS = [
    { id: 'rose', name: 'Rose', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300', primary: '#e11d48' },
    { id: 'blue', name: 'Ocean', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', primary: '#2563eb' },
    { id: 'green', name: 'Forest', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', primary: '#16a34a' },
    { id: 'purple', name: 'Lavender', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', primary: '#9333ea' },
    { id: 'orange', name: 'Sunset', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', primary: '#ea580c' },
    { id: 'teal', name: 'Teal', bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300', primary: '#0d9488' },
    { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', primary: '#4f46e5' },
    { id: 'amber', name: 'Amber', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', primary: '#d97706' },
];

// Preset avatars for characters
const PRESET_AVATARS = [
    '/avatars/default_abstract.png',
    '/avatars/default_watercolor_splash.png',
    '/avatars/default_clay.png',
    '/avatars/default_robot.png',
    '/avatars/default_cyberpunk.png',
    '/avatars/default_minimalist.png',
];

export default function CharacterCreatorModal({ isOpen, onClose, onCreate }) {
    const { t, language } = useLanguage();
    const fileInputRef = useRef(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        name_zh: '',
        personality: '',
        personality_zh: '',
        interests: [],
        interests_zh: [],
        style: 'casual',
        avatar: PRESET_AVATARS[0],
        themeColor: 'purple',
    });

    const [currentStep, setCurrentStep] = useState(1);
    const [interestInput, setInterestInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;

    const totalSteps = 4;

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const addInterest = () => {
        if (!interestInput.trim()) return;
        setFormData(prev => ({
            ...prev,
            interests: [...prev.interests, interestInput.trim()]
        }));
        setInterestInput('');
    };

    const removeInterest = (index) => {
        setFormData(prev => ({
            ...prev,
            interests: prev.interests.filter((_, i) => i !== index)
        }));
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert(t('unsupported_file_type') || 'Please select an image file');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert(t('file_too_large') || 'File too large (max 2MB)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Resize to 200x200
                const canvas = document.createElement('canvas');
                canvas.width = 200;
                canvas.height = 200;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 200, 200);
                setFormData(prev => ({ ...prev, avatar: canvas.toDataURL('image/jpeg', 0.85) }));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const generateSystemPrompt = () => {
        const styleName = SPEAKING_STYLES.find(s => s.id === formData.style);
        const styleDesc = language === 'zh' ? styleName?.desc_zh : styleName?.desc;

        return `You are ${formData.name}${formData.name_zh ? ` (${formData.name_zh})` : ''}.

Personality: ${formData.personality || 'Friendly and engaging'}
${formData.personality_zh ? `性格: ${formData.personality_zh}` : ''}

Speaking Style: ${styleDesc || 'Casual and friendly'}
${formData.interests.length > 0 ? `Interests: ${formData.interests.join(', ')}` : ''}
${formData.interests_zh.length > 0 ? `兴趣: ${formData.interests_zh.join('、')}` : ''}

Guidelines:
- Stay in character at all times
- Be natural and conversational
- Show enthusiasm for your interests when relevant
- Use emojis occasionally to express emotions
- Keep responses concise but engaging`;
    };

    const handleCreate = async () => {
        setIsGenerating(true);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const themeColor = THEME_COLORS.find(c => c.id === formData.themeColor) || THEME_COLORS[3];

        const newPersona = {
            id: `custom-${Date.now()}`,
            name: formData.name || 'Custom Character',
            name_zh: formData.name_zh || formData.name,
            avatar: formData.avatar,
            personality: formData.personality || 'Friendly and engaging',
            personality_zh: formData.personality_zh || formData.personality,
            interests: formData.interests.length > 0 ? formData.interests : ['Chatting', 'Helping'],
            interests_zh: formData.interests_zh.length > 0 ? formData.interests_zh : ['聊天', '帮助'],
            style: generateSystemPrompt(),
            color: `${themeColor.bg} ${themeColor.text}`,
            defaultBackgroundId: 'default',
            responseDelay: { min: 1500, max: 3000 },
            readDelay: { min: 500, max: 1500 },
            typingSpeed: 'normal',
            schedule: {
                timezone: 'Asia/Shanghai',
                sleep: { start: 0, end: 7 },
                busy: []
            },
            agentType: 'social-companion',
            // Mark as custom character
            isCustom: true,
            createdAt: new Date().toISOString()
        };

        onCreate(newPersona);
        setIsGenerating(false);
        onClose();

        // Reset form
        setFormData({
            name: '',
            name_zh: '',
            personality: '',
            personality_zh: '',
            interests: [],
            interests_zh: [],
            style: 'casual',
            avatar: PRESET_AVATARS[0],
            themeColor: 'purple',
        });
        setCurrentStep(1);
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return formData.name.trim().length > 0;
            case 2:
                return formData.personality.trim().length > 0;
            case 3:
                return true;
            case 4:
                return true;
            default:
                return false;
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                                <User size={28} className="text-[var(--color-primary)]" />
                            </div>
                            <h4 className="font-medium text-lg">
                                {t('basic_info')}
                            </h4>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {t('give_character_name')}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    {t('english_name')} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    placeholder={t('name_placeholder_en')}
                                    className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-white)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    {t('chinese_name_optional')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.name_zh}
                                    onChange={(e) => handleInputChange('name_zh', e.target.value)}
                                    placeholder={t('name_placeholder_zh')}
                                    className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-white)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                                <Sparkles size={28} className="text-[var(--color-primary)]" />
                            </div>
                            <h4 className="font-medium text-lg">
                                {t('personality_interests')}
                            </h4>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {t('define_personality')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    {t('personality_desc')} *
                                </label>
                                <textarea
                                    value={formData.personality}
                                    onChange={(e) => handleInputChange('personality', e.target.value)}
                                    placeholder={t('personality_placeholder')}
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-white)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    {t('interests')}
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={interestInput}
                                        onChange={(e) => setInterestInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                                        placeholder={t('add_interest')}
                                        className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-white)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                                    />
                                    <button
                                        onClick={addInterest}
                                        className="px-3 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)] transition-colors"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.interests.map((interest, idx) => (
                                        <span
                                            key={idx}
                                            onClick={() => removeInterest(idx)}
                                            className="px-3 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm cursor-pointer hover:bg-[var(--color-primary)]/20 transition-colors"
                                        >
                                            {interest} ×
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    {t('speaking_style')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {SPEAKING_STYLES.map((style) => (
                                        <button
                                            key={style.id}
                                            onClick={() => handleInputChange('style', style.id)}
                                            className={cn(
                                                "p-3 rounded-lg border text-left transition-all",
                                                formData.style === style.id
                                                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                                                    : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
                                            )}
                                        >
                                            <div className="font-medium text-sm">
                                                {language === 'zh' ? style.name_zh : style.name}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-muted)]">
                                                {language === 'zh' ? style.desc_zh : style.desc}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                                <MessageCircle size={28} className="text-[var(--color-primary)]" />
                            </div>
                            <h4 className="font-medium text-lg">
                                {t('choose_avatar')}
                            </h4>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {t('select_avatar_for_character')}
                            </p>
                        </div>

                        {/* Avatar Preview */}
                        <div className="flex justify-center mb-4">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[var(--color-primary)] shadow-lg">
                                    <img
                                        src={formData.avatar}
                                        alt="Avatar preview"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preset Avatars */}
                        <div className="grid grid-cols-3 gap-3">
                            {PRESET_AVATARS.map((avatar, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleInputChange('avatar', avatar)}
                                    className={cn(
                                        "aspect-square rounded-lg overflow-hidden border-2 transition-all",
                                        formData.avatar === avatar
                                            ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
                                            : "border-transparent hover:border-[var(--color-border)]"
                                    )}
                                >
                                    <img src={avatar} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>

                        {/* Upload Button */}
                        <div className="pt-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 rounded-lg border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all flex items-center justify-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            >
                                <Upload size={18} />
                                {t('upload_custom_avatar')}
                            </button>
                        </div>
                    </div>
                );

            case 4: {
                const selectedColor = THEME_COLORS.find(c => c.id === formData.themeColor);
                return (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                                <Palette size={28} className="text-[var(--color-primary)]" />
                            </div>
                            <h4 className="font-medium text-lg">
                                {t('theme_color')}
                            </h4>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {t('choose_theme_color')}
                            </p>
                        </div>

                        {/* Color Grid */}
                        <div className="grid grid-cols-4 gap-3">
                            {THEME_COLORS.map((color) => (
                                <button
                                    key={color.id}
                                    onClick={() => handleInputChange('themeColor', color.id)}
                                    className={cn(
                                        "aspect-square rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1",
                                        color.bg,
                                        formData.themeColor === color.id
                                            ? `border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20`
                                            : "border-transparent hover:border-[var(--color-border)]"
                                    )}
                                >
                                    <div
                                        className="w-6 h-6 rounded-full"
                                        style={{ backgroundColor: color.primary }}
                                    />
                                    <span className={cn("text-xs font-medium", color.text)}>
                                        {color.name}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Preview Card */}
                        <div className="mt-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-active)]">
                            <div className="text-xs text-[var(--color-text-muted)] mb-2">
                                {t('preview')}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full overflow-hidden">
                                    <img src={formData.avatar} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium">{formData.name || t('unnamed')}</div>
                                    <div className={cn("text-xs px-2 py-0.5 rounded-full inline-block mt-1", selectedColor?.bg, selectedColor?.text)}>
                                        {SPEAKING_STYLES.find(s => s.id === formData.style)?.name}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="character-creator-title"
                className="bg-[var(--color-bg-white)] rounded-2xl w-[90%] max-w-md max-h-[90vh] overflow-hidden animate-scale-in shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <button
                        onClick={onClose}
                        aria-label={t('close')}
                        className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                        <X size={20} className="text-[var(--color-text-muted)]" />
                    </button>
                    <h3 id="character-creator-title" className="font-semibold text-[17px]">
                        {t('create_custom_character')}
                    </h3>
                    <div className="w-10" />
                </div>

                {/* Progress Bar */}
                <div className="flex px-4 pt-4 gap-1">
                    {Array.from({ length: totalSteps }).map((_, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "h-1 flex-1 rounded-full transition-colors",
                                idx < currentStep ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
                            )}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {renderStep()}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                    <button
                        onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                        disabled={currentStep === 1}
                        className="px-4 py-2 rounded-lg font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        {t('back')}
                    </button>

                    {currentStep < totalSteps ? (
                        <button
                            onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
                            disabled={!canProceed()}
                            className="px-6 py-2 rounded-lg font-medium bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('next')}
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            disabled={isGenerating}
                            className="px-6 py-2 rounded-lg font-medium bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('creating')}
                                </>
                            ) : (
                                <>
                                    <Check size={18} />
                                    {t('create_character')}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
