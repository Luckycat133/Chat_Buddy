import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, MoreHorizontal, Sparkles, Image } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';

export default function ChatHeader({ chat, personas, typingIndicators, onOpenBackground }) {
    const navigate = useNavigate();
    const { t, language } = useLanguage();

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

    return (
        <div className="px-4 py-3 glass-strong flex items-center justify-between 
            border-b border-[var(--color-border-light)] sticky top-0 z-30 
            animate-fade-slide-down">
            {/* Character accent line — falls back to aurora gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] opacity-50"
                style={{ background: 'var(--character-gradient, var(--gradient-aurora))' }} />

            <div className="flex items-center gap-3">
                {/* Back Button - Mobile */}
                <button
                    onClick={() => navigate('/')}
                    className="md:hidden p-2 -ml-2 rounded-xl hover:bg-[var(--color-bg-hover)] 
                        text-[var(--color-text-main)] transition-all duration-200 active:scale-95"
                >
                    <ArrowLeft size={22} />
                </button>

                {/* Avatar - Premium style */}
                {headerInfo.avatar && (
                    <div className="relative hidden md:block">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm
                            ring-2 ring-[var(--character-primary,var(--color-border))] transition-all duration-300 hover:shadow-md hover:scale-105">
                            <img
                                src={headerInfo.avatar}
                                alt={headerInfo.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Online indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 
                            bg-[var(--color-success)] rounded-full border-2 border-[var(--color-bg-white)] shadow-sm" />
                    </div>
                )}

                <div>
                    <h2
                        className="font-semibold text-[var(--color-text-main)] text-[17px] 
                            cursor-pointer flex items-center gap-2 hover:text-[var(--color-primary)] 
                            transition-colors group"
                        onClick={() => navigate(`/chat/${chat.id}/details`)}
                    >
                        <span className="group-hover:underline decoration-2 decoration-[var(--color-primary)]/30 underline-offset-2">
                            {headerInfo.name}
                        </span>
                        {headerInfo.memberCount && (
                            <span className="px-2.5 py-1 text-xs rounded-full font-medium
                                shadow-inner border border-[var(--color-border-light)]"
                                style={{ background: 'var(--gradient-aurora-soft)' }}>
                                {headerInfo.memberCount}
                            </span>
                        )}
                    </h2>
                    {typingNames.length > 0 ? (
                        <div className="text-xs font-medium
                            flex items-center gap-1.5 animate-fade-in mt-0.5"
                            style={{ color: 'var(--character-primary, var(--color-primary))' }}>
                            <span className="flex items-center gap-0.5">
                                <span className="typing-dot" style={{ width: '4px', height: '4px' }}></span>
                                <span className="typing-dot" style={{ width: '4px', height: '4px', animationDelay: '0.15s' }}></span>
                                <span className="typing-dot" style={{ width: '4px', height: '4px', animationDelay: '0.3s' }}></span>
                            </span>
                            <span>
                                {typingNames.length === 1
                                    ? `${typingNames[0]} ${t('is_typing')}`
                                    : `${typingNames.length} ${t('people_typing')}`
                                }
                            </span>
                        </div>
                    ) : (
                        <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                            <Sparkles size={12} className="text-[var(--color-accent-gold)]" />
                            {language === 'zh' ? 'AI 伙伴在线' : 'AI companion online'}
                        </p>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
                <button
                    className="p-2.5 rounded-xl hover:bg-[var(--color-bg-hover)] 
                        text-[var(--color-text-muted)] hover:text-[var(--color-primary)]
                        transition-all duration-200 active:scale-95"
                    onClick={onOpenBackground}
                    title={language === 'zh' ? '聊天背景' : 'Chat Background'}
                >
                    <Image size={20} />
                </button>
                <button
                    className="p-2.5 rounded-xl hover:bg-[var(--color-bg-hover)] 
                        text-[var(--color-text-muted)] hover:text-[var(--color-primary)]
                        transition-all duration-200 active:scale-95"
                    onClick={() => navigate(`/chat/${chat.id}/search`)}
                >
                    <Search size={20} />
                </button>
                <button
                    className="p-2.5 rounded-xl hover:bg-[var(--color-bg-hover)] 
                        text-[var(--color-text-muted)] hover:text-[var(--color-primary)]
                        transition-all duration-200 active:scale-95"
                    onClick={() => navigate(`/chat/${chat.id}/details`)}
                >
                    <MoreHorizontal size={20} />
                </button>
            </div>
        </div>
    );
}
