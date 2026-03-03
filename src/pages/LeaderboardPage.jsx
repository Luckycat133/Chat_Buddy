/**
 * T10: Leaderboard Page
 * Opt-in rankings: intimacy, points, streaks, achievements.
 */
import React, { useState, useMemo } from 'react';
import { Trophy, Heart, Star, Calendar, Crown, Medal } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useSocial } from '../context/SocialContext';
import { INITIAL_PERSONAS } from '../data/personas';
import { getAllTaskAgents } from '../data/taskAgents';
import { cn } from '../utils/cn';

const ALL_FRIENDS = [...INITIAL_PERSONAS, ...getAllTaskAgents()];

const TABS = [
    { id: 'intimacy', icon: Heart, labelEn: 'Intimacy', labelZh: '亲密度', color: 'from-pink-400 to-rose-500' },
    { id: 'points', icon: Trophy, labelEn: 'Points', labelZh: '积分', color: 'from-amber-400 to-orange-500' },
    { id: 'streak', icon: Calendar, labelEn: 'Streak', labelZh: '连续签到', color: 'from-blue-400 to-indigo-500' },
    { id: 'achievements', icon: Star, labelEn: 'Achievements', labelZh: '成就', color: 'from-emerald-400 to-teal-500' },
];

const RANK_BADGES = [
    { icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' },
    { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
];

function RankBadge({ rank }) {
    if (rank < 3) {
        const cfg = RANK_BADGES[rank];
        const Icon = cfg.icon;
        return (
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center', cfg.bg)}>
                <Icon size={14} className={cfg.color} />
            </div>
        );
    }
    return (
        <div className="w-7 h-7 rounded-full bg-[var(--color-bg-hover)] flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--color-text-muted)]">#{rank + 1}</span>
        </div>
    );
}

export default function LeaderboardPage() {
    const { t, language } = useLanguage();
    const { getIntimacy, getIntimacyLevel, points, streakDays, getAchievements } = useSocial();
    const [activeTab, setActiveTab] = useState('intimacy');

    const rankedList = useMemo(() => {
        return ALL_FRIENDS.map(f => {
            const intimacy = getIntimacy(f.id);
            const intimacyLevel = getIntimacyLevel(f.id);
            return {
                ...f,
                intimacy,
                intimacyLevel,
                displayName: language === 'zh' ? (f.name_zh || f.name) : f.name,
            };
        }).sort((a, b) => {
            if (activeTab === 'intimacy') return b.intimacy - a.intimacy;
            return 0;
        });
    }, [activeTab, getIntimacy, getIntimacyLevel, language]);

    const achievements = useMemo(() => getAchievements?.() || [], [getAchievements]);
    const unlockedCount = achievements.filter(a => a.unlockedAt).length;

    const activeTabCfg = TABS.find(t => t.id === activeTab);

    return (
        <div className="page-container custom-scrollbar">
            <div className="page-ambient-glow" />
            <div className="page-content space-y-6">
                {/* Header */}
                <div className="page-header animate-fade-slide-down">
                    <div className="page-header-icon bg-gradient-to-br from-yellow-400 to-orange-500">
                        <Trophy size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="page-header-title">{t('leaderboard_title')}</h1>
                        <p className="page-header-desc">{t('leaderboard_desc')}</p>
                    </div>
                </div>

                {/* User Stats Summary */}
                <div className="grid grid-cols-3 gap-3 animate-fade-slide-up" style={{ animationDelay: '100ms' }}>
                    {[
                        { icon: '💎', label: t('total_points'), value: points },
                        { icon: '🔥', label: t('streak_stat'), value: streakDays },
                        { icon: '🏆', label: t('achievements'), value: `${unlockedCount}/${achievements.length}` },
                    ].map(stat => (
                        <div key={stat.label} className="glass-crystal rounded-[var(--radius-xl)] p-3 text-center">
                            <div className="text-xl mb-0.5">{stat.icon}</div>
                            <div className="text-lg font-display font-bold text-[var(--color-text-main)]">{stat.value}</div>
                            <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar animate-fade-slide-up" style={{ animationDelay: '150ms' }}>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all',
                                    isActive
                                        ? `bg-gradient-to-r ${tab.color} text-white shadow-sm`
                                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
                                )}
                            >
                                <Icon size={13} />
                                {language === 'zh' ? tab.labelZh : tab.labelEn}
                            </button>
                        );
                    })}
                </div>

                {/* Leaderboard List */}
                <div className="space-y-2 animate-fade-slide-up" style={{ animationDelay: '200ms' }}>
                    {activeTab === 'intimacy' && rankedList.map((friend, i) => (
                        <div
                            key={friend.id}
                            className={cn(
                                'flex items-center gap-3 p-3.5 rounded-[var(--radius-xl)] border transition-all',
                                i < 3
                                    ? 'border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 glass'
                                    : 'border-[var(--color-border)] bg-[var(--color-bg-white)]'
                            )}
                        >
                            <RankBadge rank={i} />
                            {friend.avatar ? (
                                <img src={friend.avatar} alt={friend.displayName} className="w-10 h-10 rounded-[var(--radius-lg)] object-cover" />
                            ) : (
                                <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent-coral)] flex items-center justify-center text-white font-bold">
                                    {friend.displayName.charAt(0)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-[var(--color-text-main)]">{friend.displayName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex-1 h-1.5 rounded-full bg-[var(--color-bg-hover)] overflow-hidden max-w-[120px]">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-500 transition-all"
                                            style={{ width: `${friend.intimacy}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-[var(--color-text-muted)]">
                                        {friend.intimacy}/100
                                    </span>
                                </div>
                                <p className="text-[10px] mt-0.5" style={{ color: friend.intimacyLevel.color }}>
                                    {language === 'zh' ? friend.intimacyLevel.name : friend.intimacyLevel.name_en}
                                </p>
                            </div>
                            <div className="text-lg font-display font-bold text-[var(--color-text-main)]">
                                {friend.intimacy}
                            </div>
                        </div>
                    ))}

                    {activeTab === 'points' && (
                        <div className="glass-crystal rounded-[var(--radius-xl)] p-8 text-center">
                            <Trophy size={48} className="mx-auto text-amber-400 mb-3" />
                            <p className="text-2xl font-display font-bold text-[var(--color-text-main)]">{points}</p>
                            <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('total_points_earned')}</p>
                        </div>
                    )}

                    {activeTab === 'streak' && (
                        <div className="glass-crystal rounded-[var(--radius-xl)] p-8 text-center">
                            <div className="text-5xl mb-3">🔥</div>
                            <p className="text-2xl font-display font-bold text-[var(--color-text-main)]">{streakDays}</p>
                            <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('streak_days')}</p>
                        </div>
                    )}

                    {activeTab === 'achievements' && (
                        <div className="space-y-2">
                            {achievements.filter(a => a.unlockedAt).map((ach, i) => (
                                <div key={i} className="flex items-center gap-3 p-3.5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-white)]">
                                    <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl">
                                        🏆
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-[var(--color-text-main)]">
                                            {language === 'zh' ? ach.name : ach.name_en}
                                        </p>
                                        <p className="text-xs text-[var(--color-text-muted)]">{ach.desc}</p>
                                    </div>
                                    <span className="text-xs font-bold text-amber-500">+{ach.points}pt</span>
                                </div>
                            ))}
                            {achievements.filter(a => a.unlockedAt).length === 0 && (
                                <div className="text-center py-8">
                                    <Star size={40} className="mx-auto text-[var(--color-text-muted)] opacity-30 mb-3" />
                                    <p className="text-sm text-[var(--color-text-muted)]">{t('no_achievements_yet')}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
