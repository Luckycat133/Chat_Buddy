/**
 * Dashboard - Bento Grid style homepage with draggable modular widgets
 *
 * Provides an at-a-glance view of recent chats, moments, check-in status,
 * and quick access to AI assistants, with customizable widget layout.
 */

import React, { useState, useEffect, useMemo } from 'react';
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
    TrendingUp,
    Clock,
    GripVertical,
    RotateCcw,
    Gift
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BentoCard } from '../components/BentoGrid';

import { useChat } from '../features/chat/context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

// Default widget order - Balanced for 3-column layout
const DEFAULT_WIDGET_ORDER = [
    'recent-chats',
    'stats',
    'moments',
    'checkin',
    'todays-pick',
    'agents',
    'friends',
    'achievements'
];

// Widget size configuration
const WIDGET_SIZES = {
    'recent-chats': 'lg',
    'checkin': 'sm',
    'agents': 'sm',
    'moments': 'md',
    'friends': 'sm',
    'achievements': 'sm',
    'todays-pick': 'md',
    'stats': 'tall'
};

/**
 * Sortable wrapper for BentoCard
 */
function SortableWidget({ id, children, className }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative group",
                isDragging && "opacity-50",
                className
            )}
        >
            {/* Drag handle */}
            <div
                {...attributes}
                {...listeners}
                className={cn(
                    "absolute top-2 right-2 z-20 p-1.5 rounded-lg cursor-grab",
                    "bg-[var(--color-bg-white)]/80 shadow-sm border border-[var(--color-border)]",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    "hover:bg-[var(--color-bg-hover)] active:cursor-grabbing"
                )}
                title="Drag to reorder"
            >
                <GripVertical size={14} className="text-[var(--color-text-muted)]" />
            </div>
            {children}
        </div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { chats, personas } = useChat();
    const { t, language } = useLanguage();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [widgetOrder, setWidgetOrder] = useState(() => {
        // Load saved order from localStorage
        const saved = localStorage.getItem('chat-buddy-dashboard-widgets');
        return saved ? JSON.parse(saved) : DEFAULT_WIDGET_ORDER;
    });

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Save order when changed
    useEffect(() => {
        localStorage.setItem('chat-buddy-dashboard-widgets', JSON.stringify(widgetOrder));
    }, [widgetOrder]);

    // Sensors for drag and drop
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Handle drag end
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setWidgetOrder((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Reset to default order
    const resetLayout = () => {
        setWidgetOrder(DEFAULT_WIDGET_ORDER);
    };

    // Get recent chats (last 5)
    const recentChats = useMemo(() => {
        return [...chats]
            .sort((a, b) => {
                const aTime = a.messages?.[a.messages.length - 1]?.timestamp || 0;
                const bTime = b.messages?.[b.messages.length - 1]?.timestamp || 0;
                return new Date(bTime) - new Date(aTime);
            })
            .slice(0, 5);
    }, [chats]);

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

    // Widget renderers
    const widgets = {
        'recent-chats': (
            <BentoCard
                size="lg"
                title={t('recent_chats')}
                subtitle={t('conversations_count', { count: recentChats.length })}
                icon={MessageSquare}
                onClick={() => navigate('/')}
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
                                        <div className="w-full h-full bg-[var(--gradient-aurora)] flex items-center justify-center text-[var(--color-on-primary)] text-xs font-bold">
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
        ),
        'checkin': (
            <BentoCard
                size="sm"
                title={t('daily_checkin')}
                icon={CalendarCheck}
                onClick={() => navigate('/achievements')}
            >
                <div className="text-center mt-2 flex flex-col items-center">
                    <div className="mb-2 p-3 bg-[var(--color-primary-glow)] rounded-full text-[var(--color-primary)]">
                        <Gift size={24} />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                        {t('tap_to_checkin')}
                    </p>
                </div>
            </BentoCard>
        ),
        'agents': (
            <BentoCard
                size="sm"
                title={t('ai_agents')}
                icon={Bot}
                onClick={() => navigate('/agents')}
            >
                <div className="text-center mt-2 flex flex-col items-center">
                    <div className="mb-2 p-3 bg-[var(--color-primary-glow)] rounded-full text-[var(--color-primary)]">
                        <Bot size={24} />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                        {t('smart_tasks')}
                    </p>
                </div>
            </BentoCard>
        ),
        'moments': (
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
                                <div className="w-full h-full bg-[var(--gradient-aurora)] flex items-center justify-center text-[var(--color-on-primary)] text-xs font-bold">
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
        ),
        'friends': (
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
        ),
        'achievements': (
            <BentoCard
                size="sm"
                title={t('achievements')}
                icon={Trophy}
                onClick={() => navigate('/achievements')}
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
        ),
        'todays-pick': (
            <BentoCard
                size="md"
                title={t('todays_pick')}
                subtitle={t('chat_with_them')}
                icon={Sparkles}
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
        ),
        'stats': (
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
        )
    };

    const isDefaultOrder = JSON.stringify(widgetOrder) === JSON.stringify(DEFAULT_WIDGET_ORDER);

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
                    <div className="flex-1">
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
                    {/* Reset Layout Button */}
                    {!isDefaultOrder && (
                        <button
                            onClick={resetLayout}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]
                                hover:bg-[var(--color-bg-hover)] transition-all"
                            title={t('reset_layout')}
                        >
                            <RotateCcw size={14} />
                            {t('reset_layout')}
                        </button>
                    )}
                </header>

                {/* Draggable Bento Grid */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={widgetOrder}>
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 auto-rows-[minmax(110px,auto)]">
                            {widgetOrder.map((widgetId) => (
                                <SortableWidget
                                    key={widgetId}
                                    id={widgetId}
                                    className={cn(
                                        // Size classes — reduced for 3-col panel layout
                                        WIDGET_SIZES[widgetId] === 'lg' && 'col-span-2 row-span-2',
                                        WIDGET_SIZES[widgetId] === 'md' && 'col-span-2',
                                        WIDGET_SIZES[widgetId] === 'tall' && 'md:row-span-2',
                                        WIDGET_SIZES[widgetId] === 'sm' && 'col-span-1 row-span-1',
                                    )}
                                >
                                    {widgets[widgetId]}
                                </SortableWidget>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}

// Helper component for stats display
function StatItem({ label, value, suffix = '', icon: _Icon }) {
    return (
        <div className="dashboard-stat">
            <div className="dashboard-stat-icon">
                <_Icon size={16} />
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
