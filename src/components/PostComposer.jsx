import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, MapPin, Eye, ChevronDown, Check } from 'lucide-react';
import { useMoments } from '../context/MomentsContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

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
    { en: 'Travel ✈️', zh: '旅行中 ✈️' },
];

const VISIBILITY_OPTIONS = [
    { value: 'public', icon: '🌍', en: 'Public', zh: '公开' },
    { value: 'partial', icon: '👥', en: 'Selected friends', zh: '部分可见' },
    { value: 'hidden', icon: '🚫', en: 'Hide from...', zh: '不给谁看' },
    { value: 'private', icon: '🔒', en: 'Only me', zh: '仅自己可见' },
];

export default function PostComposer({ isOpen, onClose }) {
    const { createPost } = useMoments();
    const { userProfile, getDisplayName } = useUser();
    const { t, language } = useLanguage();

    const [content, setContent] = useState('');
    const [images, setImages] = useState([]);
    const [isPosting, setIsPosting] = useState(false);
    const [location, setLocation] = useState('');
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [customLocation, setCustomLocation] = useState('');
    const [visibility, setVisibility] = useState('public');
    const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
    const fileInputRef = useRef(null);

    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const remaining = 9 - images.length;
        const filesToProcess = files.slice(0, remaining);

        filesToProcess.forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 800;
                    let { width, height } = img;

                    if (width > height && width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    setImages(prev => [...prev, resizedDataUrl].slice(0, 9));
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        e.target.value = '';
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handlePost = async () => {
        if (!content.trim() && images.length === 0) return;

        setIsPosting(true);

        createPost(content.trim(), images, null, 'user-me', {
            location: location || null,
            visibility,
            visibleTo: null,
            hiddenFrom: null
        });

        // Reset and close
        setContent('');
        setImages([]);
        setLocation('');
        setVisibility('public');
        setIsPosting(false);
        onClose();
    };

    const selectLocation = (loc) => {
        setLocation(language === 'zh' ? loc.zh : loc.en);
        setShowLocationPicker(false);
    };

    const handleCustomLocation = () => {
        if (customLocation.trim()) {
            setLocation(customLocation.trim());
            setCustomLocation('');
            setShowLocationPicker(false);
        }
    };

    const getVisibilityLabel = () => {
        const opt = VISIBILITY_OPTIONS.find(o => o.value === visibility);
        return opt ? (language === 'zh' ? opt.zh : opt.en) : '';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <button
                    onClick={onClose}
                    className="text-[var(--color-text-muted)]"
                >
                    <X size={24} />
                </button>
                <h3 className="font-medium text-[17px]">{t('new_post') || 'New Moment'}</h3>
                <button
                    onClick={handlePost}
                    disabled={isPosting || (!content.trim() && images.length === 0)}
                    className={cn(
                        "px-4 py-1.5 rounded-full font-medium text-[14px] transition-all",
                        content.trim() || images.length > 0
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]"
                    )}
                >
                    {t('post') || 'Post'}
                </button>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--color-primary)]">
                    {userProfile.avatar ? (
                        <img src={userProfile.avatar} alt="You" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold">
                            {getDisplayName(language).charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="font-medium text-[var(--color-text-main)]">
                        {getDisplayName(language)}
                    </span>
                    {/* Visibility Selector */}
                    <button
                        onClick={() => setShowVisibilityPicker(!showVisibilityPicker)}
                        className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] mt-0.5"
                    >
                        <Eye size={12} />
                        <span>{getVisibilityLabel()}</span>
                        <ChevronDown size={12} />
                    </button>
                </div>
            </div>

            {/* Visibility Picker Dropdown */}
            {showVisibilityPicker && (
                <div className="mx-4 mb-2 bg-[var(--color-bg-app)] rounded-lg overflow-hidden border border-[var(--color-border)]">
                    {VISIBILITY_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                setVisibility(opt.value);
                                setShowVisibilityPicker(false);
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                                visibility === opt.value ? "bg-[var(--color-primary)]/10" : "hover:bg-white"
                            )}
                        >
                            <span className="text-[18px]">{opt.icon}</span>
                            <span className="flex-1 text-[14px]">
                                {language === 'zh' ? opt.zh : opt.en}
                            </span>
                            {visibility === opt.value && (
                                <Check size={18} className="text-[var(--color-primary)]" />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('whats_new') || "What's on your mind?"}
                    className="w-full h-40 resize-none outline-none text-[16px] placeholder:text-[var(--color-text-light)]"
                    autoFocus
                />

                {/* Image Grid Preview */}
                {images.length > 0 && (
                    <div className={cn(
                        "grid gap-2 mt-4",
                        images.length === 1 && "grid-cols-1",
                        images.length === 2 && "grid-cols-2",
                        images.length >= 3 && "grid-cols-3"
                    )}>
                        {images.map((img, index) => (
                            <div key={index} className="relative aspect-square">
                                <img
                                    src={img}
                                    alt=""
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                    onClick={() => removeImage(index)}
                                    className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Location Display */}
                {location && (
                    <div className="flex items-center gap-2 mt-4 text-[var(--color-primary)]">
                        <MapPin size={16} />
                        <span className="text-[14px]">{location}</span>
                        <button
                            onClick={() => setLocation('')}
                            className="ml-auto text-[var(--color-text-muted)]"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Location Picker Modal */}
            {showLocationPicker && (
                <div className="absolute inset-0 bg-white z-10 flex flex-col">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                        <button onClick={() => setShowLocationPicker(false)} className="text-[var(--color-text-muted)]">
                            <X size={24} />
                        </button>
                        <h3 className="font-medium text-[17px]">{t('add_location') || 'Add Location'}</h3>
                        <div className="w-6" />
                    </div>

                    {/* Custom Location Input */}
                    <div className="p-4 border-b border-[var(--color-border)]">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={customLocation}
                                onChange={(e) => setCustomLocation(e.target.value)}
                                placeholder={language === 'zh' ? '输入自定义位置...' : 'Enter custom location...'}
                                className="flex-1 px-3 py-2 bg-[var(--color-bg-app)] rounded-lg text-[14px] outline-none"
                            />
                            <button
                                onClick={handleCustomLocation}
                                disabled={!customLocation.trim()}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-[14px] font-medium",
                                    customLocation.trim()
                                        ? "bg-[var(--color-primary)] text-white"
                                        : "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]"
                                )}
                            >
                                {t('confirm') || 'OK'}
                            </button>
                        </div>
                    </div>

                    {/* Preset Locations */}
                    <div className="flex-1 overflow-y-auto">
                        {PRESET_LOCATIONS.map((loc, index) => (
                            <button
                                key={index}
                                onClick={() => selectLocation(loc)}
                                className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-app)]"
                            >
                                <MapPin size={18} className="text-[var(--color-text-muted)]" />
                                <span className="text-[14px]">{language === 'zh' ? loc.zh : loc.en}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom Actions */}
            <div className="border-t border-[var(--color-border)] px-4 py-3 flex gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= 9}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                        images.length >= 9
                            ? "text-[var(--color-text-light)]"
                            : "text-[var(--color-primary)] hover:bg-[var(--color-bg-app)]"
                    )}
                >
                    <ImageIcon size={20} />
                    <span className="text-[14px]">
                        {t('add_photos') || 'Photos'} {images.length > 0 && `(${images.length}/9)`}
                    </span>
                </button>

                <button
                    onClick={() => setShowLocationPicker(true)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                        location
                            ? "text-[var(--color-primary)]"
                            : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-app)]"
                    )}
                >
                    <MapPin size={20} />
                    <span className="text-[14px]">{t('location') || 'Location'}</span>
                </button>
            </div>
        </div>
    );
}
