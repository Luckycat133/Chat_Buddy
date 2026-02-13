import React, { useState } from 'react';
import { ArrowLeft, Trophy, Lock, Star, Gift, Flame, MessageSquare, Users, Camera, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSocial } from '../context/SocialContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

export default function AchievementsPage() {
    const navigate = useNavigate();
    const { getAchievements, points, streakDays } = useSocial();
    const { t, language } = useLanguage();
    const [selectedCategory, setSelectedCategory] = useState('all');

    const achievements = getAchievements();
    const unlockedCount = achievements.filter(a => a.unlocked).length;

    const categories = [
        { id: 'all', key: 'cat_all', icon: Trophy },
        { id: 'social', key: 'cat_social', icon: MessageSquare },
        { id: 'streak', key: 'cat_streak', icon: Flame },
        { id: 'gift', key: 'cat_gifts', icon: Gift },
    ];

    const getCategoryForAchievement = (id) => {
        if (id.includes('streak') || id.includes('early') || id.includes('night')) return 'streak';
        if (id.includes('gift')) return 'gift';
        return 'social';
    };

    const filteredAchievements = selectedCategory === 'all'
        ? achievements
        : achievements.filter(a => getCategoryForAchievement(a.id) === selectedCategory);

    const getAchievementIcon = (id) => {
        if (id.includes('chat')) return MessageSquare;
        if (id.includes('group') || id.includes('friend')) return Users;
        if (id.includes('streak') || id.includes('early') || id.includes('night')) return Flame;
        if (id.includes('gift')) return Gift;
        if (id.includes('moment')) return Camera;
        return Trophy;
    };

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-hidden flex flex-col pb-16 md:pb-0">
            {/* Header */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-orange-500 to-[var(--color-primary)]" />
                <div className="relative p-4">
                    <div className="flex items-center gap-3 mb-6">
                        <button onClick={() => navigate(-1)} className="text-white">
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-xl font-bold text-white">
                            {t('achievement_system')}
                        </h1>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 text-center text-white">
                        <div className="bg-white/20 rounded-xl p-3">
                            <Trophy className="mx-auto mb-1" size={24} />
                            <p className="text-2xl font-bold">{unlockedCount}/{achievements.length}</p>
                            <p className="text-xs opacity-80">{t('unlocked')}</p>
                        </div>
                        <div className="bg-white/20 rounded-xl p-3">
                            <Star className="mx-auto mb-1" size={24} />
                            <p className="text-2xl font-bold">{points}</p>
                            <p className="text-xs opacity-80">{t('total_points')}</p>
                        </div>
                        <div className="bg-white/20 rounded-xl p-3">
                            <Flame className="mx-auto mb-1" size={24} />
                            <p className="text-2xl font-bold">{streakDays}</p>
                            <p className="text-xs opacity-80">{t('streak_days')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories */}
            <div className="flex overflow-x-auto px-4 py-3 gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-white)]">
                {categories.map(cat => {
                    const Icon = cat.icon;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={cn(
                                "flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                                selectedCategory === cat.id
                                    ? "bg-[var(--color-primary)] text-white"
                                    : "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]"
                            )}
                        >
                            <Icon size={16} />
                            {t(cat.key)}
                        </button>
                    );
                })}
            </div>

            {/* Achievements List */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid gap-3">
                    {filteredAchievements.map(achievement => {
                        const Icon = getAchievementIcon(achievement.id);
                        return (
                            <div
                                key={achievement.id}
                                className={cn(
                                    "p-4 rounded-xl flex items-center gap-4 transition-all",
                                    achievement.unlocked
                                        ? "bg-[var(--color-bg-white)] shadow-sm"
                                        : "bg-[var(--color-bg-active)] opacity-60"
                                )}
                            >
                                {/* Icon */}
                                <div className={cn(
                                    "w-14 h-14 rounded-xl flex items-center justify-center",
                                    achievement.unlocked
                                        ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                                        : "bg-[var(--color-bg-active)]"
                                )}>
                                    {achievement.unlocked ? (
                                        <Icon size={28} className="text-white" />
                                    ) : (
                                        <Lock size={24} className="text-[var(--color-text-muted)]" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <h3 className={cn(
                                        "font-medium text-[15px]",
                                        achievement.unlocked ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"
                                    )}>
                                        {language === 'zh' ? achievement.name : achievement.name_en}
                                    </h3>
                                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                                        {achievement.desc}
                                    </p>
                                    {achievement.unlocked && achievement.unlockedAt && (
                                        <p className="text-xs text-[var(--color-primary)] mt-1">
                                            ✓ {new Date(achievement.unlockedAt).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>

                                {/* Points */}
                                <div className={cn(
                                    "text-center",
                                    achievement.unlocked ? "text-[var(--color-primary)]" : "text-[var(--color-text-light)]"
                                )}>
                                    <p className="text-lg font-bold">+{achievement.points}</p>
                                    <p className="text-xs">{t('pts')}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
