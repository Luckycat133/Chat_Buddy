import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, MoreHorizontal, Sparkles, Image, Download, Bookmark } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';
import { useSocial } from '../../../../context/SocialContext';

export default function ChatHeader({ chat, personas, typingIndicators, presenceMap, moodMap, onOpenBackground, onOpenExport, onOpenBookmarks }) {
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const { getIntimacyLevel, getIntimacy } = useSocial();

    const getHeaderInfo = () => {
        if (!chat) return { name: '', avatar: null, id: null };

        if (chat.participants.length === 2) {
            const otherId = chat.participants.find(p => p !== 'user-me');
            const other = personas.find(p => p.id === otherId);
            const name = language === 'zh' && other ? (other.name_zh || other.name) : (other?.name || chat.name);
            return { name: name, avatar: other?.avatar, id: otherId };
        }
        return {
            name: chat.name,
            avatar: null,
            memberCount: chat.participants.length,
            id: null
        };
    };

    const headerInfo = getHeaderInfo();

    // Get typing AI names
    const typingAIs = typingIndicators?.[chat.id] || [];
    const typingNames = typingAIs
        .map(aiId => {
            const ai = personas.find(p => p.id === aiId);
            return language === 'zh' ? (ai?.name_zh || ai?.name) : ai?.name;
        })
        .filter(Boolean);

    const getStatusText = () => {
        const status = headerInfo.id ? (presenceMap?.[headerInfo.id] || 'offline') : 'online';
        if (language === 'zh') {
            if (status === 'busy') return '忙碌中';
            if (status === 'offline') return '休息中';
            return 'AI 伙伴在线';
        }
        if (status === 'busy') return 'Busy';
        if (status === 'offline') return 'Resting';
        return 'AI companion online';
    };

    return (
        <div className="chat-header glass-strong animate-fade-slide-down">
            {/* Character accent line */}
            <div className="chat-header-accent" />

            <div className="flex items-center gap-3">
                {/* Back Button - Mobile */}
                <button
                    onClick={() => navigate('/')}
                    className="md:hidden chat-action-btn -ml-2"
                    aria-label={t('back') || 'Back'}
                >
                    <ArrowLeft size={22} />
                </button>

                {/* Avatar - Premium style */}
                {headerInfo.avatar && (
                    <div className="relative hidden md:block">
                        <div className="chat-header-avatar">
                            <img
                                src={headerInfo.avatar}
                                alt={headerInfo.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Online indicator */}
                        {presenceMap && headerInfo.id && (
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 
                                rounded-full border-2 border-[var(--color-bg-white)] shadow-sm
                                presence-dot presence-dot--${presenceMap[headerInfo.id] || 'offline'}`}
                                role="status"
                                aria-label={presenceMap[headerInfo.id] || 'offline'}
                            />
                        )}
                    </div>
                )}

                <div>
                    <h2
                        className="chat-header-name group"
                        onClick={() => navigate(`/chat/${chat.id}/details`)}
                    >
                        <span className="group-hover:underline decoration-2 decoration-[var(--color-primary)]/30 underline-offset-2">
                            {headerInfo.name}
                        </span>
                        {/* T06: Mood emoji */}
                        {headerInfo.id && moodMap?.[headerInfo.id] && (
                            <span className="text-sm" title={language === 'zh' ? moodMap[headerInfo.id].label_zh : moodMap[headerInfo.id].label}>
                                {moodMap[headerInfo.id].emoji}
                            </span>
                        )}
                        {/* T06: Affinity badge */}
                        {headerInfo.id && getIntimacy(headerInfo.id) > 0 && (
                            <span
                                className="affinity-badge"
                                style={{ backgroundColor: getIntimacyLevel(headerInfo.id).color }}
                            >
                                {language === 'zh' ? getIntimacyLevel(headerInfo.id).name : getIntimacyLevel(headerInfo.id).name_en}
                            </span>
                        )}
                        {headerInfo.memberCount && (
                            <span className="member-badge">
                                {headerInfo.memberCount}
                            </span>
                        )}
                    </h2>
                    {typingNames.length > 0 ? (
                        <div className="chat-header-typing animate-fade-in">
                            <span className="flex items-center gap-0.5">
                                <span className="typing-dot"></span>
                                <span className="typing-dot" style={{ animationDelay: '0.15s' }}></span>
                                <span className="typing-dot" style={{ animationDelay: '0.3s' }}></span>
                            </span>
                            <span>
                                {typingNames.length === 1
                                    ? `${typingNames[0]} ${t('is_typing')}`
                                    : `${typingNames.length} ${t('people_typing')}`
                                }
                            </span>
                        </div>
                    ) : (
                        <p className="chat-header-status">
                            <Sparkles size={12} className="text-[var(--color-accent-gold)]" />
                            {getStatusText()}
                        </p>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1" role="toolbar" aria-label={t('chat_actions') || 'Chat actions'}>
                <button
                    className="chat-action-btn"
                    onClick={onOpenBackground}
                    title={language === 'zh' ? '聊天背景' : 'Chat Background'}
                    aria-label={language === 'zh' ? '聊天背景' : 'Chat Background'}
                >
                    <Image size={20} />
                </button>
                <button
                    className="chat-action-btn"
                    onClick={onOpenExport}
                    title={language === 'zh' ? '导出聊天记录' : 'Export Chat'}
                    aria-label={language === 'zh' ? '导出聊天记录' : 'Export Chat'}
                >
                    <Download size={20} />
                </button>
                <button
                    className="chat-action-btn"
                    onClick={() => navigate(`/chat/${chat.id}/search`)}
                    aria-label={t('search') || 'Search'}
                >
                    <Search size={20} />
                </button>
                <button
                    className="chat-action-btn"
                    onClick={onOpenBookmarks}
                    aria-label={t('bookmarks_title') || 'Bookmarks'}
                >
                    <Bookmark size={20} />
                </button>
                <button
                    className="chat-action-btn"
                    onClick={() => navigate(`/chat/${chat.id}/details`)}
                    aria-label={t('more') || 'More'}
                >
                    <MoreHorizontal size={20} />
                </button>
            </div>
        </div>
    );
}
