/**
 * Dashboard - Bento Grid style homepage with modular widgets
 * 
 * Provides an at-a-glance view of recent chats, moments, check-in status,
 * and quick access to AI assistants, replacing or complementing the chat list.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    MessageSquare,
    Users,
    Camera,
    CalendarCheck,
    Trophy,
    Sparkles,
    ChevronRight,
    Bot,
    Gift,
    TrendingUp,
    Clock
} from 'lucide-react';
import { ResponsiveBentoGrid, BentoCard } from '../components/BentoGrid';

import { useChat } from '../features/chat/context/ChatContext';
import { useLanguage } from '../context/LanguageContext';

export default function Dashboard() {
    const navigate = useNavigate();
    const { chats, personas } = useChat();
    const { t, language } = useLanguage();
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Get recent chats (last 5)
    const recentChats = [...chats]
        .sort((a, b) => {
            const aTime = a.messages?.[a.messages.length - 1]?.timestamp || 0;
            const bTime = b.messages?.[b.messages.length - 1]?.timestamp || 0;
            return new Date(bTime) - new Date(aTime);
        })
        .slice(0, 5);

    // Get greeting based on time
    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 6) return t('greeting_late_night');
        if (hour < 12) return t('greeting_morning');
        if (hour < 18) return t('greeting_afternoon');
        return t('greeting_evening');
    };

    // Get persona for chat display
    const getPersona = (id) => personas.find(p => p.id === id);

    return (
        <div className="page-container custom-scrollbar">
            {/* Ambient Background Glow */}
            <div className="page-ambient-glow" />

            <div className="page-content space-y-6">
                {/* Header */}
                <header className="page-header animate-fade-slide-down">
                    <div className="page-header-icon">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <h1 className="page-header-title">
                            {getGreeting()} ✨
                        </h1>
                        <p className="page-header-desc">
                            {currentTime.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>
                    </div>
                </header>

            {/* Bento Grid Layout */}
            <ResponsiveBentoGrid>
                {/* Recent Chats - Large Card */}
                <BentoCard
                    size="lg"
                    title={t('recent_chats')}
                    subtitle={t('conversations_count', { count: recentChats.length })}
                    icon={MessageSquare}
                    onClick={() => navigate('/')}
                    glowColor="var(--color-primary-glow)"
                >
                    <div className="space-y-2 mt-2">
                        {recentChats.slice(0, 4).map((chat) => {
                            const persona = getPersona(chat.participants?.find(p => p !== 'user-me'));
                            const lastMsg = chat.messages?.[chat.messages.length - 1];

                            return (
                                <Link
                                    key={chat.id}
                                    to={`/chat/${chat.id}`}
                                    className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-bg-hover)] transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                                        {persona?.avatar ? (
                                            <img src={persona.avatar} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-[var(--gradient-aurora)] flex items-center justify-center text-white text-xs font-bold">
                                                {chat.name?.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[var(--color-text-main)] truncate">
                                            {language === 'zh' ? (persona?.name_zh || chat.name) : chat.name}
                                        </p>
                                        <p className="text-xs text-[var(--color-text-muted)] truncate">
                                            {lastMsg?.content?.slice(0, 30)}...
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            );
                        })}
                    </div>
                </BentoCard>

                {/* Daily Check-in Card */}
                <BentoCard
                    size="sm"
                    title={t('daily_checkin')}
                    icon={CalendarCheck}
                    gradient="linear-gradient(135deg, #FF9B7A 0%, #FF7E9D 100%)"
                    onClick={() => navigate('/achievements')}
                >
                    <div className="text-center mt-2">
                        <div className="text-3xl mb-1">🎁</div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {t('tap_to_checkin')}
                        </p>
                    </div>
                </BentoCard>

                {/* AI Agents Quick Access */}
                <BentoCard
                    size="sm"
                    title={t('ai_agents')}
                    icon={Bot}
                    onClick={() => navigate('/agents')}
                    glowColor="var(--color-accent-lavender)"
                >
                    <div className="text-center mt-2">
                        <div className="text-3xl mb-1">🤖</div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {t('smart_tasks')}
                        </p>
                    </div>
                </BentoCard>

                {/* Moments Preview - Medium Card */}
                <BentoCard
                    size="md"
                    title={t('moments')}
                    subtitle={t('view_latest')}
                    icon={Camera}
                    onClick={() => navigate('/moments')}
                >
                    <div className="flex items-center gap-2 mt-2">
                        {personas.slice(0, 5).map((persona, i) => (
                            <div
                                key={persona.id}
                                className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm -ml-2 first:ml-0"
                                style={{ zIndex: 5 - i }}
                            >
                                {persona.avatar ? (
                                    <img src={persona.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[var(--gradient-aurora)] flex items-center justify-center text-white text-xs font-bold">
                                        {persona.name?.charAt(0)}
                                    </div>
                                )}
                            </div>
                        ))}
                        <span className="text-xs text-[var(--color-text-muted)] ml-2">
                            {t('new_posts_count', { count: '' })}
                        </span>
                    </div>
                </BentoCard>

                {/* Friends Card */}
                <BentoCard
                    size="sm"
                    title={t('friends')}
                    subtitle={t('ai_companions_count', { count: personas.length })}
                    icon={Users}
                    onClick={() => navigate('/friends')}
                >
                    <div className="flex flex-wrap gap-1 mt-2">
                        {personas.slice(0, 6).map((persona) => (
                            <div key={persona.id} className="w-6 h-6 rounded-full overflow-hidden">
                                {persona.avatar ? (
                                    <img src={persona.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[var(--gradient-aurora)]" />
                                )}
                            </div>
                        ))}
                    </div>
                </BentoCard>

                {/* Achievements Progress */}
                <BentoCard
                    size="sm"
                    title={t('achievements')}
                    icon={Trophy}
                    onClick={() => navigate('/achievements')}
                    gradient="linear-gradient(135deg, #FFD666 0%, #FF9B7A 100%)"
                >
                    <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[var(--color-text-muted)]">
                                {t('progress')}
                            </span>
                            <span className="font-medium text-[var(--color-primary)]">
                                45%
                            </span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-bg-active)] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full"
                                style={{ width: '45%', background: 'var(--gradient-aurora)' }}
                            />
                        </div>
                    </div>
                </BentoCard>

                {/* Today's Recommended Character - Medium Card */}
                <BentoCard
                    size="md"
                    title={t('todays_pick')}
                    subtitle={t('chat_with_them')}
                    icon={Sparkles}
                    gradient="linear-gradient(135deg, var(--color-accent-mint) 0%, var(--color-accent-sky) 100%)"
                >
                    {personas[0] && (
                        <Link
                            to={`/chat/${chats.find(c => c.participants?.includes(personas[0].id))?.id || ''}`}
                            className="flex items-center gap-3 mt-2 p-2 rounded-[var(--radius-md)] bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/30 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md">
                                {personas[0].avatar ? (
                                    <img src={personas[0].avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[var(--gradient-aurora)]" />
                                )}
                            </div>
                            <div>
                                <p className="font-semibold text-[var(--color-text-main)]">
                                    {language === 'zh' ? (personas[0].name_zh || personas[0].name) : personas[0].name}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {personas[0].tagline || t('tap_to_chat')}
                                </p>
                            </div>
                        </Link>
                    )}
                </BentoCard>

                {/* Quick Stats */}
                <BentoCard
                    size="tall"
                    title={t('stats')}
                    icon={TrendingUp}
                >
                    <div className="space-y-4 mt-2">
                        <StatItem
                            label={t('messages_stat')}
                            value={chats.reduce((acc, c) => acc + (c.messages?.length || 0), 0)}
                            icon={MessageSquare}
                        />
                        <StatItem
                            label={t('chats_stat')}
                            value={chats.length}
                            icon={Users}
                        />
                        <StatItem
                            label={t('streak_stat')}
                            value="7"
                            suffix={t('days_unit')}
                            icon={Clock}
                        />
                    </div>
                </BentoCard>
            </ResponsiveBentoGrid>
            </div>
        </div>
    );
}

// Helper component for stats display
// eslint-disable-next-line no-unused-vars
function StatItem({ label, value, suffix = '', icon: Icon }) {
    return (
        <div className="dashboard-stat">
            <div className="dashboard-stat-icon">
                <Icon size={16} />
            </div>
            <div>
                <p className="dashboard-stat-value">
                    {value}{suffix && <span>{suffix}</span>}
                </p>
                <p className="dashboard-stat-label">{label}</p>
            </div>
        </div>
    );
}
