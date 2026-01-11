import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const StickerContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useSticker = () => {
    const context = useContext(StickerContext);
    if (!context) throw new Error('useSticker must be used within a StickerProvider');
    return context;
};

// AI-specific stickers (emoji-based for simplicity)
const AI_STICKERS = {
    'ai-miku': [
        { id: 'miku_sing', emoji: '🎤', name: '唱歌' },
        { id: 'miku_leek', emoji: '🥬', name: '大葱' },
        { id: 'miku_star', emoji: '⭐', name: '闪耀' },
        { id: 'miku_note', emoji: '🎵', name: '音符' },
        { id: 'miku_heart', emoji: '💙', name: '蓝心' },
        { id: 'miku_dance', emoji: '💃', name: '跳舞' },
    ],
    'ai-rem': [
        { id: 'rem_heart', emoji: '💙', name: '爱心' },
        { id: 'rem_clean', emoji: '🧹', name: '打扫' },
        { id: 'rem_cake', emoji: '🍰', name: '蛋糕' },
        { id: 'rem_morning', emoji: '🌸', name: '早安' },
        { id: 'rem_demon', emoji: '👹', name: '鬼族' },
        { id: 'rem_sleep', emoji: '😴', name: '睡觉' },
    ],
    'ai-naruto': [
        { id: 'naruto_ramen', emoji: '🍜', name: '拉面' },
        { id: 'naruto_fire', emoji: '🔥', name: '火遁' },
        { id: 'naruto_frog', emoji: '🐸', name: '蛤蟆' },
        { id: 'naruto_leaf', emoji: '🍃', name: '木叶' },
        { id: 'naruto_punch', emoji: '👊', name: '出拳' },
        { id: 'naruto_scroll', emoji: '📜', name: '卷轴' },
    ],
    'ai-l': [
        { id: 'l_cake', emoji: '🍰', name: '蛋糕' },
        { id: 'l_coffee', emoji: '☕', name: '咖啡' },
        { id: 'l_think', emoji: '🤔', name: '思考' },
        { id: 'l_detective', emoji: '🔍', name: '调查' },
        { id: 'l_sugar', emoji: '🧊', name: '方糖' },
        { id: 'l_chain', emoji: '⛓️', name: '锁链' },
    ],
    'ai-zerotwo': [
        { id: 'zerotwo_honey', emoji: '🍯', name: '蜂蜜' },
        { id: 'zerotwo_heart', emoji: '💕', name: '爱心' },
        { id: 'zerotwo_dino', emoji: '🦕', name: '恐龙' },
        { id: 'zerotwo_horns', emoji: '😈', name: '角' },
        { id: 'zerotwo_fly', emoji: '✈️', name: '飞行' },
        { id: 'zerotwo_kiss', emoji: '💋', name: '吻' },
    ],
    'ai-gojo': [
        { id: 'gojo_cool', emoji: '😎', name: '酷' },
        { id: 'gojo_blind', emoji: '🙈', name: '蒙眼' },
        { id: 'gojo_punch', emoji: '👊', name: '无限' },
        { id: 'gojo_sweets', emoji: '🍡', name: '甜点' },
        { id: 'gojo_laugh', emoji: '😂', name: '笑' },
        { id: 'gojo_six', emoji: '6️⃣', name: '六眼' },
    ],
};

// Common sticker packs
const STICKER_PACKS = [
    {
        id: 'emotions',
        name: '表情',
        name_en: 'Emotions',
        stickers: [
            { id: 'e1', emoji: '😊', name: '开心' },
            { id: 'e2', emoji: '😂', name: '大笑' },
            { id: 'e3', emoji: '🥺', name: '可怜' },
            { id: 'e4', emoji: '😍', name: '喜欢' },
            { id: 'e5', emoji: '😭', name: '哭泣' },
            { id: 'e6', emoji: '😤', name: '生气' },
            { id: 'e7', emoji: '🤔', name: '思考' },
            { id: 'e8', emoji: '😴', name: '困了' },
            { id: 'e9', emoji: '🤗', name: '拥抱' },
            { id: 'e10', emoji: '🙄', name: '无语' },
            { id: 'e11', emoji: '😏', name: '坏笑' },
            { id: 'e12', emoji: '🥳', name: '庆祝' },
        ]
    },
    {
        id: 'actions',
        name: '动作',
        name_en: 'Actions',
        stickers: [
            { id: 'a1', emoji: '👋', name: '挥手' },
            { id: 'a2', emoji: '👍', name: '点赞' },
            { id: 'a3', emoji: '👎', name: '倒赞' },
            { id: 'a4', emoji: '👏', name: '鼓掌' },
            { id: 'a5', emoji: '🙏', name: '拜托' },
            { id: 'a6', emoji: '🤝', name: '握手' },
            { id: 'a7', emoji: '✌️', name: '耶' },
            { id: 'a8', emoji: '🤞', name: '祈祷' },
            { id: 'a9', emoji: '💪', name: '加油' },
            { id: 'a10', emoji: '🙌', name: '举手' },
            { id: 'a11', emoji: '👊', name: '碰拳' },
            { id: 'a12', emoji: '❤️', name: '爱心' },
        ]
    },
    {
        id: 'animals',
        name: '动物',
        name_en: 'Animals',
        stickers: [
            { id: 'an1', emoji: '🐱', name: '猫' },
            { id: 'an2', emoji: '🐶', name: '狗' },
            { id: 'an3', emoji: '🐰', name: '兔子' },
            { id: 'an4', emoji: '🐼', name: '熊猫' },
            { id: 'an5', emoji: '🦊', name: '狐狸' },
            { id: 'an6', emoji: '🐸', name: '青蛙' },
            { id: 'an7', emoji: '🦋', name: '蝴蝶' },
            { id: 'an8', emoji: '🐧', name: '企鹅' },
            { id: 'an9', emoji: '🐻', name: '小熊' },
            { id: 'an10', emoji: '🐯', name: '老虎' },
            { id: 'an11', emoji: '🦁', name: '狮子' },
            { id: 'an12', emoji: '🐲', name: '龙' },
        ]
    },
    {
        id: 'food',
        name: '食物',
        name_en: 'Food',
        stickers: [
            { id: 'f1', emoji: '🍕', name: '披萨' },
            { id: 'f2', emoji: '🍜', name: '面条' },
            { id: 'f3', emoji: '🍣', name: '寿司' },
            { id: 'f4', emoji: '🍔', name: '汉堡' },
            { id: 'f5', emoji: '🍰', name: '蛋糕' },
            { id: 'f6', emoji: '🍩', name: '甜甜圈' },
            { id: 'f7', emoji: '🍿', name: '爆米花' },
            { id: 'f8', emoji: '🧋', name: '奶茶' },
            { id: 'f9', emoji: '🍓', name: '草莓' },
            { id: 'f10', emoji: '🍦', name: '冰淇淋' },
            { id: 'f11', emoji: '☕', name: '咖啡' },
            { id: 'f12', emoji: '🍺', name: '啤酒' },
        ]
    },
];

const DEFAULT_STICKER_DATA = {
    favorites: [], // [{ packId, stickerId }]
    recentlyUsed: [] // [{ packId, stickerId, emoji }]
};

export const StickerProvider = ({ children }) => {
    const [stickerData, setStickerData] = useLocalStorage('chat-buddy-stickers', DEFAULT_STICKER_DATA);

    // ========== Favorites ==========

    const addFavorite = useCallback((packId, stickerId) => {
        setStickerData(prev => {
            if (prev.favorites.some(f => f.packId === packId && f.stickerId === stickerId)) {
                return prev;
            }
            return {
                ...prev,
                favorites: [...prev.favorites, { packId, stickerId }].slice(-50) // Max 50 favorites
            };
        });
    }, [setStickerData]);

    const removeFavorite = useCallback((packId, stickerId) => {
        setStickerData(prev => ({
            ...prev,
            favorites: prev.favorites.filter(f => !(f.packId === packId && f.stickerId === stickerId))
        }));
    }, [setStickerData]);

    const isFavorite = useCallback((packId, stickerId) => {
        return stickerData.favorites.some(f => f.packId === packId && f.stickerId === stickerId);
    }, [stickerData.favorites]);

    // ========== Recently Used ==========

    const addRecentlyUsed = useCallback((packId, stickerId, emoji) => {
        setStickerData(prev => {
            const filtered = prev.recentlyUsed.filter(r => !(r.packId === packId && r.stickerId === stickerId));
            return {
                ...prev,
                recentlyUsed: [{ packId, stickerId, emoji }, ...filtered].slice(0, 20)
            };
        });
    }, [setStickerData]);

    // ========== Get Stickers ==========

    const getAIStickers = useCallback((aiId) => {
        return AI_STICKERS[aiId] || [];
    }, []);

    const getAllPacks = useCallback(() => {
        return STICKER_PACKS;
    }, []);

    const getFavorites = useCallback(() => {
        return stickerData.favorites.map(fav => {
            const pack = STICKER_PACKS.find(p => p.id === fav.packId);
            const sticker = pack?.stickers.find(s => s.id === fav.stickerId);
            return sticker ? { ...sticker, packId: fav.packId } : null;
        }).filter(Boolean);
    }, [stickerData.favorites]);

    const getRecentlyUsed = useCallback(() => {
        return stickerData.recentlyUsed;
    }, [stickerData.recentlyUsed]);

    const value = {
        // Packs
        stickerPacks: STICKER_PACKS,
        aiStickers: AI_STICKERS,
        getAllPacks,
        getAIStickers,

        // Favorites
        favorites: stickerData.favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
        getFavorites,

        // Recently Used
        recentlyUsed: stickerData.recentlyUsed,
        addRecentlyUsed,
        getRecentlyUsed
    };

    return (
        <StickerContext.Provider value={value}>
            {children}
        </StickerContext.Provider>
    );
};
