import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Star, MessageCircle, Edit2, Users, ChevronRight, Clock } from 'lucide-react';
import { useFriend } from '../context/FriendContext';
import { useChat } from '../features/chat/context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { useSocial } from '../context/SocialContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { cn } from '../utils/cn';
import StatusBadge, { StatusDot } from './StatusSelector';
import { STATUS_CONFIG } from '../core/presence/PresenceService';

export default function FriendDetail({ friend, onClose }) {
    const navigate = useNavigate();
    const { groups, getFriendMeta, toggleStar, setRemark, setFriendGroup, getDisplayName, getSignature, getRecentActivity } = useFriend();
    const { chats, createChat, presenceMap } = useChat();
    const { t, language } = useLanguage();
    const { getIntimacy, getIntimacyLevel } = useSocial();

    const trapRef = useFocusTrap(true);
    const meta = getFriendMeta(friend.id);
    const [remarkInput, setRemarkInput] = useState(meta.remark || '');
    const [showGroupPicker, setShowGroupPicker] = useState(false);

    const displayName = getDisplayName(friend, language);
    const originalName = language === 'zh' ? (friend.name_zh || friend.name) : friend.name;
    const currentGroup = groups.find(g => g.id === meta.groupId);
    const signature = getSignature(friend.id, language);
    const recentActivity = getRecentActivity(friend.id, language);
    const currentStatus = presenceMap?.[friend.id] || 'online';
    const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.online;

    const existingChat = chats.find(c =>
        c.participants.length === 2 &&
        c.participants.includes(friend.id) &&
        c.participants.includes('user-me')
    );

    const handleSaveRemark = () => {
        setRemark(friend.id, remarkInput);
    };

    const handleStartChat = () => {
        if (existingChat) {
            navigate(`/chat/${existingChat.id}`);
        } else {
            const chatId = createChat(displayName, [friend.id]);
            navigate(`/chat/${chatId}`);
        }
        onClose();
    };

    const handleGroupSelect = (groupId) => {
        setFriendGroup(friend.id, groupId);
        setShowGroupPicker(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" role="presentation" onClick={onClose}>
            <div
                ref={trapRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="friend-detail-title"
                className="bg-[var(--color-bg-white)] rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <button onClick={onClose} className="text-[var(--color-text-muted)]" aria-label="Close">
                        <X size={24} />
                    </button>
                    <h3 id="friend-detail-title" className="font-medium text-[17px]">{t('friend_detail') || 'Friend Detail'}</h3>
                    <div className="w-6" />
                </div>

                <div className="p-6 flex flex-col items-center border-b border-[var(--color-border)]">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
                            <img src={friend.avatar} alt={displayName} className="w-full h-full object-cover" />
                        </div>
                        <div
                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center"
                            style={{ backgroundColor: statusConfig.color }}
                        >
                            <span className="text-white text-[8px] font-bold">{statusConfig.icon}</span>
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-[var(--color-text-main)] mt-3">{displayName}</h2>
                    {meta.remark && (
                        <p className="text-[var(--color-text-muted)] text-sm mt-1">({originalName})</p>
                    )}
                    <div className="mt-2">
                        <StatusBadge status={currentStatus} language={language} />
                    </div>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-3 text-center italic max-w-xs">
                        "{signature}"
                    </p>
                    {recentActivity && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-muted)]">
                            <Clock size={12} />
                            <span>{recentActivity.timeAgo}</span>
                            <span className="text-[var(--color-text-light)]">{recentActivity.text}</span>
                        </div>
                    )}
                    <p className="text-[var(--color-text-muted)] text-sm mt-3">
                        {language === 'zh' ? friend.personality_zh : friend.personality}
                    </p>

                    <button
                        onClick={() => toggleStar(friend.id)}
                        className={cn(
                            "mt-4 px-4 py-2 rounded-full flex items-center gap-2 font-medium transition-all",
                            meta.starred
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]"
                        )}
                    >
                        <Star size={18} className={meta.starred ? "fill-yellow-500" : ""} />
                        {meta.starred ? (t('unstar_friend') || 'Unstar') : (t('star_friend') || 'Star')}
                    </button>

                    {/* T06: Affinity Meter */}
                    {(() => {
                        const intimacy = getIntimacy(friend.id);
                        const level = getIntimacyLevel(friend.id);
                        return (
                            <div className="mt-4 w-full max-w-xs">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-medium text-[var(--color-text-muted)]">
                                        {t('affinity') || (language === 'zh' ? '\u4EB2\u5BC6\u5EA6' : 'Affinity')}
                                    </span>
                                    <span
                                        className="px-2 py-0.5 text-[10px] rounded-full font-semibold text-white"
                                        style={{ backgroundColor: level.color }}
                                    >
                                        {language === 'zh' ? level.name : level.name_en}
                                    </span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-[var(--color-bg-app)] overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${intimacy}%`,
                                            backgroundColor: level.color
                                        }}
                                    />
                                </div>
                                <p className="text-[10px] text-[var(--color-text-light)] mt-1 text-right">
                                    {intimacy}/100
                                </p>
                            </div>
                        );
                    })()}
                </div>

                <div className="p-4 space-y-3 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <div className="bg-[var(--color-bg-app)] rounded-lg p-3">
                        <label className="text-[var(--color-text-muted)] text-sm mb-2 block">
                            {t('remark') || 'Remark'}
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={remarkInput}
                                onChange={(e) => setRemarkInput(e.target.value)}
                                onBlur={handleSaveRemark}
                                placeholder={t('remark_placeholder') || 'Set a remark name'}
                                maxLength={20}
                                className="flex-1 bg-[var(--color-bg-white)] px-3 py-2 rounded-lg text-[15px] outline-none border border-[var(--color-border)]"
                            />
                            <span className="text-[var(--color-text-light)] text-sm">{remarkInput.length}/20</span>
                        </div>
                    </div>

                    <div className="bg-[var(--color-bg-app)] rounded-lg p-3">
                        <label className="text-[var(--color-text-muted)] text-sm mb-2 block">
                            {t('move_to_group') || 'Move to Group'}
                        </label>
                        <button
                            onClick={() => setShowGroupPicker(!showGroupPicker)}
                            className="w-full bg-[var(--color-bg-white)] px-3 py-2 rounded-lg flex items-center justify-between border border-[var(--color-border)]"
                        >
                            <span className="flex items-center gap-2">
                                {currentGroup ? (
                                    <>
                                        <span>{currentGroup.icon}</span>
                                        <span>{language === 'zh' ? currentGroup.name : currentGroup.name_en}</span>
                                    </>
                                ) : (
                                    <span className="text-[var(--color-text-muted)]">{t('ungrouped') || 'Ungrouped'}</span>
                                )}
                            </span>
                            <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
                        </button>

                        {showGroupPicker && (
                            <div className="mt-2 bg-[var(--color-bg-white)] rounded-lg border border-[var(--color-border)] overflow-hidden">
                                <button
                                    onClick={() => handleGroupSelect(null)}
                                    className={cn(
                                        "w-full px-3 py-2 text-left flex items-center gap-2 border-b border-[var(--color-border-light)]",
                                        !meta.groupId && "bg-[var(--color-primary-light)]"
                                    )}
                                >
                                    <Users size={16} />
                                    <span>{t('ungrouped') || 'Ungrouped'}</span>
                                </button>
                                {groups.map(group => (
                                    <button
                                        key={group.id}
                                        onClick={() => handleGroupSelect(group.id)}
                                        className={cn(
                                            "w-full px-3 py-2 text-left flex items-center gap-2 border-b border-[var(--color-border-light)] last:border-b-0",
                                            meta.groupId === group.id && "bg-[var(--color-primary-light)]"
                                        )}
                                    >
                                        <span>{group.icon}</span>
                                        <span>{language === 'zh' ? group.name : group.name_en}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="sticky bottom-0 bg-[var(--color-bg-white)] pt-3">
                        <button
                            onClick={handleStartChat}
                            className="w-full py-3 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-[var(--color-primary-hover)] transition-all"
                        >
                            <MessageCircle size={20} />
                            {existingChat ? (t('view_chat') || 'View Chat') : (t('start_chat') || 'Start Chat')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
