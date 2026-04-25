import React, { useState } from 'react';
import { X, Star, Clock, Heart } from 'lucide-react';
import { useSticker } from '../context/StickerContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

export default function StickerPicker({ aiId, onSelect }) {
    const { stickerPacks, getAIStickers, getFavorites, getRecentlyUsed, addRecentlyUsed, addFavorite, removeFavorite, isFavorite } = useSticker();
    const { language } = useLanguage();
    const [activeTab, setActiveTab] = useState('recent');
    const [longPressSticker, setLongPressSticker] = useState(null);

    const aiStickers = aiId ? getAIStickers(aiId) : [];
    const favorites = getFavorites();
    const recentlyUsed = getRecentlyUsed();

    const handleSelect = (sticker, packId) => {
        addRecentlyUsed(packId, sticker.id, sticker.emoji);
        onSelect?.(sticker.emoji);
    };

    const handleLongPress = (sticker, packId) => {
        setLongPressSticker({ sticker, packId });
    };

    const handleToggleFavorite = () => {
        if (!longPressSticker) return;
        const { sticker, packId } = longPressSticker;
        if (isFavorite(packId, sticker.id)) {
            removeFavorite(packId, sticker.id);
        } else {
            addFavorite(packId, sticker.id);
        }
        setLongPressSticker(null);
    };

    const tabs = [
        { id: 'recent', icon: Clock, name: '最近', name_en: 'Recent' },
        { id: 'favorites', icon: Star, name: '收藏', name_en: 'Favorites' },
        ...(aiId ? [{ id: 'ai', icon: Heart, name: 'AI专属', name_en: 'AI Special' }] : []),
        ...stickerPacks.map(p => ({ id: p.id, emoji: p.stickers[0]?.emoji, name: p.name, name_en: p.name_en }))
    ];

    const getCurrentStickers = () => {
        if (activeTab === 'recent') return recentlyUsed.map(r => ({ ...r, packId: r.packId }));
        if (activeTab === 'favorites') return favorites.map(f => ({ ...f, packId: f.packId }));
        if (activeTab === 'ai') return aiStickers.map(s => ({ ...s, packId: 'ai' }));
        const pack = stickerPacks.find(p => p.id === activeTab);
        return pack ? pack.stickers.map(s => ({ ...s, packId: pack.id })) : [];
    };

    const currentStickers = getCurrentStickers();

    return (
        <div
            className="bg-[var(--color-bg-white)] rounded-xl shadow-xl border border-[var(--color-border)] overflow-hidden w-80"
            onClick={e => e.stopPropagation()}
        >
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-[var(--color-border)] px-2 py-1 hide-scrollbar">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex-shrink-0 px-3 py-2 text-lg transition-all rounded-lg mx-0.5",
                                activeTab === tab.id
                                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-app)]"
                            )}
                        >
                            {Icon ? <Icon size={20} /> : tab.emoji}
                        </button>
                    );
                })}
            </div>

            {/* Stickers Grid */}
            <div className="h-48 overflow-y-auto p-2">
                {currentStickers.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                        {language === 'zh' ? '暂无表情' : 'No stickers'}
                    </div>
                ) : (
                    <div className="grid grid-cols-6 gap-1">
                        {currentStickers.map((sticker, index) => (
                            <button
                                key={`${sticker.packId}-${sticker.id || index}`}
                                onClick={() => handleSelect(sticker, sticker.packId)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleLongPress(sticker, sticker.packId);
                                }}
                                className="w-10 h-10 flex items-center justify-center text-2xl rounded-lg hover:bg-[var(--color-bg-app)] transition-colors relative"
                            >
                                {sticker.emoji}
                                {isFavorite(sticker.packId, sticker.id) && (
                                    <Star size={8} className="absolute bottom-0.5 right-0.5 text-yellow-500 fill-yellow-500" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Long Press Menu */}
            {longPressSticker && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center" onClick={() => setLongPressSticker(null)}>
                    <div className="bg-[var(--color-bg-white)] rounded-lg shadow-xl p-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="text-4xl mb-2">{longPressSticker.sticker.emoji}</div>
                        <button
                            onClick={handleToggleFavorite}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-app)] rounded-lg hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] transition-colors w-full justify-center"
                        >
                            <Star size={16} className={isFavorite(longPressSticker.packId, longPressSticker.sticker.id) ? 'fill-current' : ''} />
                            {isFavorite(longPressSticker.packId, longPressSticker.sticker.id)
                                ? (language === 'zh' ? '取消收藏' : 'Remove')
                                : (language === 'zh' ? '添加收藏' : 'Add to favorites')
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
