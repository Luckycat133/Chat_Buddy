import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Star, MessageCircle, Edit2, Users, ChevronRight } from 'lucide-react';
import { useFriend } from '../context/FriendContext';
import { useChat } from '../features/chat/context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

export default function FriendDetail({ friend, onClose }) {
    const navigate = useNavigate();
    const { groups, getFriendMeta, toggleStar, setRemark, setFriendGroup, getDisplayName } = useFriend();
    const { chats, createChat } = useChat();
    const { t, language } = useLanguage();

    const meta = getFriendMeta(friend.id);
    const [remarkInput, setRemarkInput] = useState(meta.remark || '');
    const [showGroupPicker, setShowGroupPicker] = useState(false);

    const displayName = getDisplayName(friend, language);
    const originalName = language === 'zh' ? (friend.name_zh || friend.name) : friend.name;
    const currentGroup = groups.find(g => g.id === meta.groupId);

    // Find existing chat with this friend
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <button onClick={onClose} className="text-[var(--color-text-muted)]">
                        <X size={24} />
                    </button>
                    <h3 className="font-medium text-[17px]">{t('friend_detail') || 'Friend Detail'}</h3>
                    <div className="w-6" />
                </div>

                {/* Profile Section */}
                <div className="p-6 flex flex-col items-center border-b border-[var(--color-border)]">
                    <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg mb-4">
                        <img src={friend.avatar} alt={displayName} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-xl font-bold text-[var(--color-text-main)]">{displayName}</h2>
                    {meta.remark && (
                        <p className="text-[var(--color-text-muted)] text-sm mt-1">({originalName})</p>
                    )}
                    <p className="text-[var(--color-text-muted)] text-sm mt-2">
                        {language === 'zh' ? friend.personality_zh : friend.personality}
                    </p>

                    {/* Star Button */}
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
                </div>

                {/* Actions */}
                <div className="p-4 space-y-3">
                    {/* Remark Input */}
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
                                className="flex-1 bg-white px-3 py-2 rounded-lg text-[15px] outline-none border border-[var(--color-border)]"
                            />
                            <span className="text-[var(--color-text-light)] text-sm">{remarkInput.length}/20</span>
                        </div>
                    </div>

                    {/* Group Selector */}
                    <div className="bg-[var(--color-bg-app)] rounded-lg p-3">
                        <label className="text-[var(--color-text-muted)] text-sm mb-2 block">
                            {t('move_to_group') || 'Move to Group'}
                        </label>
                        <button
                            onClick={() => setShowGroupPicker(!showGroupPicker)}
                            className="w-full bg-white px-3 py-2 rounded-lg flex items-center justify-between border border-[var(--color-border)]"
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

                        {/* Group Picker Dropdown */}
                        {showGroupPicker && (
                            <div className="mt-2 bg-white rounded-lg border border-[var(--color-border)] overflow-hidden">
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

                    {/* Start Chat Button */}
                    <button
                        onClick={handleStartChat}
                        className="w-full py-3 bg-[var(--color-primary)] text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-[var(--color-primary-hover)] transition-all"
                    >
                        <MessageCircle size={20} />
                        {existingChat ? (t('view_chat') || 'View Chat') : (t('start_chat') || 'Start Chat')}
                    </button>
                </div>
            </div>
        </div>
    );
}
