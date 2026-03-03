/**
 * T10: FriendInteractionLog
 * Timeline of all interaction milestones with a specific friend.
 */
import React from 'react';
import { X, Clock, MessageCircle, Gift, Eye, Heart, MessageSquare, AtSign, History } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFriend } from '../context/FriendContext';
import { cn } from '../utils/cn';

const ACTIVITY_ICONS = {
    VIEWED_MOMENT: Eye,
    SENT_GIFT: Gift,
    CHATTED: MessageCircle,
    LIKED_MOMENT: Heart,
    COMMENTED: MessageSquare,
    MENTIONED: AtSign,
};

const ACTIVITY_COLORS = {
    VIEWED_MOMENT: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30',
    SENT_GIFT: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30',
    CHATTED: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30',
    LIKED_MOMENT: 'bg-red-100 text-red-500 dark:bg-red-900/30',
    COMMENTED: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30',
    MENTIONED: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30',
};

function formatTimestamp(iso, language) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (language === 'zh') {
        if (mins < 1) return '刚刚';
        if (mins < 60) return `${mins}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ACTIVITY_LABELS_EN = {
    VIEWED_MOMENT: 'Viewed your moment',
    SENT_GIFT: 'Sent you a gift',
    CHATTED: 'Had a conversation',
    LIKED_MOMENT: 'Liked your moment',
    COMMENTED: 'Commented on your post',
    MENTIONED: 'Mentioned you',
};
const ACTIVITY_LABELS_ZH = {
    VIEWED_MOMENT: '查看了你的动态',
    SENT_GIFT: '送了你一份礼物',
    CHATTED: '和你进行了对话',
    LIKED_MOMENT: '赞了你的动态',
    COMMENTED: '评论了你的帖子',
    MENTIONED: '提到了你',
};

export default function FriendInteractionLog({ friend, onClose }) {
    const { t, language } = useLanguage();
    const { interactions } = useFriend();

    const friendInteractions = interactions[friend?.id] || [];

    return (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm glass-crystal rounded-[var(--radius-2xl)] shadow-floating flex flex-col max-h-[80vh] overflow-hidden animate-scale-spring">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        {friend?.avatar ? (
                            <img src={friend.avatar} alt={friend.name} className="w-9 h-9 rounded-[var(--radius-lg)] object-cover" />
                        ) : (
                            <div className="w-9 h-9 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent-coral)] flex items-center justify-center">
                                <History size={18} className="text-white" />
                            </div>
                        )}
                        <div>
                            <h2 className="font-display font-bold text-[var(--color-text-main)]">
                                {language === 'zh' ? (friend?.name_zh || friend?.name) : friend?.name}
                            </h2>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {t('interaction_log_title')} · {friendInteractions.length} {t('interaction_log_events')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Timeline */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
                    {friendInteractions.length === 0 ? (
                        <div className="text-center py-10">
                            <Clock size={40} className="mx-auto text-[var(--color-text-muted)] opacity-30 mb-3" />
                            <p className="text-sm text-[var(--color-text-muted)]">{t('interaction_log_empty')}</p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('interaction_log_empty_hint')}</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Vertical line */}
                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--color-border)]" />

                            <div className="space-y-4 pl-10">
                                {friendInteractions.map((interaction, i) => {
                                    const Icon = ACTIVITY_ICONS[interaction.type] || Clock;
                                    const colorCls = ACTIVITY_COLORS[interaction.type] || 'bg-gray-100 text-gray-500';
                                    const label = language === 'zh'
                                        ? ACTIVITY_LABELS_ZH[interaction.type] || interaction.type
                                        : ACTIVITY_LABELS_EN[interaction.type] || interaction.type;

                                    return (
                                        <div key={i} className="relative flex items-start gap-3">
                                            {/* Timeline dot */}
                                            <div className={cn(
                                                'absolute -left-7 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 border-[var(--color-bg-app)]',
                                                colorCls
                                            )}>
                                                <Icon size={11} />
                                            </div>
                                            <div className="flex-1 min-w-0 pb-1">
                                                <div className="p-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-white)]">
                                                    <p className="text-xs font-semibold text-[var(--color-text-main)]">{label}</p>
                                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                                                        {formatTimestamp(interaction.timestamp, language)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
