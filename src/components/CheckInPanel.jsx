import React, { useState, useMemo } from 'react';
import { X, Gift, Calendar, Flame, Trophy } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { useLanguage } from '../context/LanguageContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { cn } from '../utils/cn';

export default function CheckInPanel({ onClose }) {
    const { checkIn, hasCheckedInToday, streakDays, points, getAchievements } = useSocial();
    const { t, language } = useLanguage();
    const [checkInResult, setCheckInResult] = useState(null);
    const [showAnimation, setShowAnimation] = useState(false);

    const trapRef = useFocusTrap(true);
    const hasChecked = hasCheckedInToday();

    // Compute recently unlocked achievements directly (avoids setState in useEffect)
    const recentAchievements = useMemo(() => {
        const achievements = getAchievements().filter(a => a.unlocked);
        const today = new Date().toISOString().split('T')[0];
        return achievements.filter(a =>
            a.unlockedAt && a.unlockedAt.startsWith(today)
        );
    }, [getAchievements]);

    const handleCheckIn = () => {
        const result = checkIn();
        setCheckInResult(result);
        if (result.success) {
            setShowAnimation(true);
            setTimeout(() => setShowAnimation(false), 2000);
        }
    };

    // Generate calendar for current week
    const getWeekDays = () => {
        const days = [];
        const today = new Date();
        const dayOfWeek = today.getDay();

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - dayOfWeek + i);
            const isToday = i === dayOfWeek;
            const isPast = i < dayOfWeek;

            days.push({
                day: ['日', '一', '二', '三', '四', '五', '六'][i],
                day_en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
                date: date.getDate(),
                isToday,
                isPast,
                checked: isPast || (isToday && hasChecked)
            });
        }
        return days;
    };

    const weekDays = getWeekDays();

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="presentation" onClick={onClose}>
            <div
                ref={trapRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="checkin-panel-title"
                className="bg-[var(--color-bg-white)] rounded-xl w-full max-w-sm overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)] to-orange-400" />
                    {showAnimation && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-6xl animate-bounce">🎉</div>
                        </div>
                    )}
                    <div className="relative p-4 text-white">
                        <div className="flex items-center justify-between">
                            <h3 id="checkin-panel-title" className="font-bold text-lg">
                                {t('daily_checkin')}
                            </h3>
                            <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Streak */}
                        <div className="flex items-center gap-2 mt-4">
                            <Flame className="text-yellow-300" size={24} />
                            <span className="text-xl font-bold">{streakDays}</span>
                            <span>{t('streak_checkin_label')}</span>
                        </div>

                        {/* Points */}
                        <div className="flex items-center gap-2 mt-2">
                            <Trophy className="text-yellow-300" size={20} />
                            <span>{t('total_points')}:</span>
                            <span className="font-bold">{points}</span>
                        </div>
                    </div>
                </div>

                {/* Week Calendar */}
                <div className="p-4 bg-[var(--color-bg-app)]">
                    <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((day, index) => (
                            <div key={index} className="text-center">
                                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                                    {language === 'zh' ? day.day : day.day_en}
                                </p>
                                <div className={cn(
                                    "w-10 h-10 mx-auto rounded-full flex items-center justify-center text-sm font-medium transition-all",
                                    day.isToday && !day.checked && "ring-2 ring-[var(--color-primary)] ring-offset-2",
                                    day.checked
                                        ? "bg-[var(--color-primary)] text-white"
                                        : day.isPast
                                            ? "bg-[var(--color-bg-active)] text-[var(--color-text-light)]"
                                            : "bg-[var(--color-bg-white)] text-[var(--color-text-main)]"
                                )}>
                                    {day.checked ? '✓' : day.date}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Check In Result */}
                {checkInResult?.success && (
                    <div className="px-4 py-3 bg-green-50 text-green-700 text-center">
                        <p className="font-medium">
                            🎉 {t('checkin_success')}
                        </p>
                        <p className="text-sm">
                            {t('plus_points', { points: checkInResult.points })}
                            {checkInResult.streak > 1 && (
                                <span className="ml-2">
                                    🔥 {checkInResult.streak} {t('streak_label')}
                                </span>
                            )}
                        </p>
                    </div>
                )}

                {/* Recent Achievements */}
                {recentAchievements.length > 0 && (
                    <div className="px-4 py-3 border-t border-[var(--color-border)]">
                        <p className="text-sm font-medium mb-2">
                            🏆 {t('today_achievements')}
                        </p>
                        {recentAchievements.map(a => (
                            <div key={a.id} className="text-sm text-[var(--color-primary)]">
                                ✨ {language === 'zh' ? a.name : a.name_en}
                            </div>
                        ))}
                    </div>
                )}

                {/* Check In Button */}
                <div className="p-4">
                    <button
                        onClick={handleCheckIn}
                        disabled={hasChecked}
                        className={cn(
                            "w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                            hasChecked
                                ? "bg-[var(--color-bg-active)] text-[var(--color-text-light)] cursor-not-allowed"
                                : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                        )}
                    >
                        <Calendar size={20} />
                        {hasChecked ? t('already_checked_in') : t('check_in_now')}
                    </button>
                </div>
            </div>
        </div>
    );
}
