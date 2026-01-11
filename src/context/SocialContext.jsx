import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const SocialContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useSocial = () => {
    const context = useContext(SocialContext);
    if (!context) throw new Error('useSocial must be used within a SocialProvider');
    return context;
};

// Default social data
const DEFAULT_SOCIAL_DATA = {
    intimacy: {}, // { personaId: number (0-100) }
    achievements: [], // [{ id, name, unlockedAt, personaId? }]
    checkIns: [], // [{ date: 'YYYY-MM-DD', points }]
    points: 0,
    gifts: [], // [{ id, recipientId, giftType, sentAt }]
    streakDays: 0,
    lastCheckIn: null
};

// Achievement definitions
const ACHIEVEMENTS = [
    { id: 'first_chat', name: '初次对话', name_en: 'First Chat', desc: '和AI开始第一次对话', points: 10 },
    { id: 'chat_master', name: '聊天达人', name_en: 'Chat Master', desc: '发送100条消息', points: 50 },
    { id: 'group_creator', name: '群聊创建者', name_en: 'Group Creator', desc: '创建第一个群聊', points: 20 },
    { id: 'early_bird', name: '早起的鸟', name_en: 'Early Bird', desc: '早上6点前签到', points: 30 },
    { id: 'night_owl', name: '夜猫子', name_en: 'Night Owl', desc: '凌晨12点后聊天', points: 30 },
    { id: 'streak_7', name: '周连续签到', name_en: '7 Day Streak', desc: '连续签到7天', points: 100 },
    { id: 'streak_30', name: '月连续签到', name_en: '30 Day Streak', desc: '连续签到30天', points: 500 },
    { id: 'best_friend', name: '最佳好友', name_en: 'Best Friend', desc: '与一个AI亲密度达到100', points: 200 },
    { id: 'gift_giver', name: '送礼达人', name_en: 'Gift Giver', desc: '送出10个礼物', points: 50 },
    { id: 'social_butterfly', name: '社交达人', name_en: 'Social Butterfly', desc: '和5个不同的AI聊天', points: 80 },
    { id: 'moment_star', name: '朋友圈之星', name_en: 'Moment Star', desc: '发布10条动态', points: 60 },
];

// Gift definitions
const GIFTS = [
    { id: 'flower', name: '鲜花', name_en: 'Flower', emoji: '🌹', intimacyBoost: 5, cost: 10 },
    { id: 'cake', name: '蛋糕', name_en: 'Cake', emoji: '🎂', intimacyBoost: 10, cost: 20 },
    { id: 'heart', name: '爱心', name_en: 'Heart', emoji: '❤️', intimacyBoost: 15, cost: 30 },
    { id: 'star', name: '星星', name_en: 'Star', emoji: '⭐', intimacyBoost: 20, cost: 50 },
    { id: 'diamond', name: '钻石', name_en: 'Diamond', emoji: '💎', intimacyBoost: 50, cost: 100 },
    { id: 'crown', name: '皇冠', name_en: 'Crown', emoji: '👑', intimacyBoost: 100, cost: 200 },
];

export const SocialProvider = ({ children }) => {
    const [socialData, setSocialData] = useLocalStorage('chat-buddy-social', DEFAULT_SOCIAL_DATA);

    // ========== Intimacy System ==========

    const getIntimacy = useCallback((personaId) => {
        return socialData.intimacy[personaId] || 0;
    }, [socialData.intimacy]);

    const addIntimacy = useCallback((personaId, amount = 1) => {
        setSocialData(prev => ({
            ...prev,
            intimacy: {
                ...prev.intimacy,
                [personaId]: Math.min(100, (prev.intimacy[personaId] || 0) + amount)
            }
        }));
    }, [setSocialData]);

    const getIntimacyLevel = useCallback((personaId) => {
        const intimacy = getIntimacy(personaId);
        if (intimacy >= 80) return { level: 5, name: '挚友', name_en: 'Soulmate', color: '#FFD700' };
        if (intimacy >= 60) return { level: 4, name: '密友', name_en: 'Close Friend', color: '#FF69B4' };
        if (intimacy >= 40) return { level: 3, name: '好友', name_en: 'Good Friend', color: '#4ECDC4' };
        if (intimacy >= 20) return { level: 2, name: '朋友', name_en: 'Friend', color: '#87CEEB' };
        return { level: 1, name: '相识', name_en: 'Acquaintance', color: '#C0C0C0' };
    }, [getIntimacy]);

    // ========== Achievement System ==========

    const unlockAchievement = useCallback((achievementId, personaId = null) => {
        if (socialData.achievements.some(a => a.id === achievementId)) return false;

        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!achievement) return false;

        setSocialData(prev => ({
            ...prev,
            achievements: [...prev.achievements, {
                id: achievementId,
                personaId,
                unlockedAt: new Date().toISOString()
            }],
            points: prev.points + achievement.points
        }));

        return achievement;
    }, [socialData.achievements, setSocialData]);

    const hasAchievement = useCallback((achievementId) => {
        return socialData.achievements.some(a => a.id === achievementId);
    }, [socialData.achievements]);

    const getAchievements = useCallback(() => {
        return ACHIEVEMENTS.map(a => ({
            ...a,
            unlocked: socialData.achievements.some(ua => ua.id === a.id),
            unlockedAt: socialData.achievements.find(ua => ua.id === a.id)?.unlockedAt
        }));
    }, [socialData.achievements]);

    // ========== Daily Check-in ==========

    const checkIn = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];

        // Already checked in today
        if (socialData.lastCheckIn === today) {
            return { success: false, reason: 'already_checked_in' };
        }

        // Calculate streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = socialData.lastCheckIn === yesterdayStr
            ? socialData.streakDays + 1
            : 1;

        // Base points + streak bonus
        const basePoints = 10;
        const streakBonus = Math.min(newStreak * 2, 20);
        const totalPoints = basePoints + streakBonus;

        setSocialData(prev => ({
            ...prev,
            checkIns: [...prev.checkIns, { date: today, points: totalPoints }],
            points: prev.points + totalPoints,
            streakDays: newStreak,
            lastCheckIn: today
        }));

        // Check streak achievements
        if (newStreak >= 7) unlockAchievement('streak_7');
        if (newStreak >= 30) unlockAchievement('streak_30');

        // Check early bird achievement
        const hour = new Date().getHours();
        if (hour < 6) unlockAchievement('early_bird');

        return { success: true, points: totalPoints, streak: newStreak };
    }, [socialData, setSocialData, unlockAchievement]);

    const hasCheckedInToday = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];
        return socialData.lastCheckIn === today;
    }, [socialData.lastCheckIn]);

    // ========== Gift System ==========

    const sendGift = useCallback((recipientId, giftId) => {
        const gift = GIFTS.find(g => g.id === giftId);
        if (!gift) return { success: false, reason: 'invalid_gift' };
        if (socialData.points < gift.cost) return { success: false, reason: 'insufficient_points' };

        setSocialData(prev => ({
            ...prev,
            points: prev.points - gift.cost,
            gifts: [...prev.gifts, {
                id: giftId,
                recipientId,
                sentAt: new Date().toISOString()
            }]
        }));

        // Increase intimacy
        addIntimacy(recipientId, gift.intimacyBoost);

        // Check gift achievement
        const totalGifts = socialData.gifts.length + 1;
        if (totalGifts >= 10) unlockAchievement('gift_giver');

        return { success: true, gift, newIntimacy: getIntimacy(recipientId) + gift.intimacyBoost };
    }, [socialData, setSocialData, addIntimacy, getIntimacy, unlockAchievement]);

    const getGiftHistory = useCallback((recipientId = null) => {
        if (recipientId) {
            return socialData.gifts.filter(g => g.recipientId === recipientId);
        }
        return socialData.gifts;
    }, [socialData.gifts]);

    // ========== Points ==========

    const addPoints = useCallback((amount) => {
        setSocialData(prev => ({
            ...prev,
            points: prev.points + amount
        }));
    }, [setSocialData]);

    const value = {
        // Data
        socialData,
        points: socialData.points,
        streakDays: socialData.streakDays,

        // Intimacy
        getIntimacy,
        addIntimacy,
        getIntimacyLevel,

        // Achievements
        achievements: ACHIEVEMENTS,
        unlockAchievement,
        hasAchievement,
        getAchievements,

        // Check-in
        checkIn,
        hasCheckedInToday,

        // Gifts
        gifts: GIFTS,
        sendGift,
        getGiftHistory,

        // Points
        addPoints
    };

    return (
        <SocialContext.Provider value={value}>
            {children}
        </SocialContext.Provider>
    );
};
