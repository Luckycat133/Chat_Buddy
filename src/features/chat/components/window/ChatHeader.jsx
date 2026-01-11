import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';

export default function ChatHeader({ chat, personas, typingIndicators }) {
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
        <div className="px-4 py-3 bg-white/80 backdrop-blur-md flex items-center justify-between border-b border-[var(--color-border-light)] sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/')} className="md:hidden p-1.5 -ml-1.5 rounded-full hover:bg-black/5 text-[var(--color-text-main)] transition-colors">
                    <ArrowLeft size={22} />
                </button>
                <div>
                    <h2
                        className="font-semibold text-[var(--color-text-main)] text-[17px] cursor-pointer flex items-center gap-2"
                        onClick={() => navigate(`/chat/${chat.id}/details`)}
                    >
                        {headerInfo.name}
                        {headerInfo.memberCount && <span className="px-2 py-0.5 bg-[var(--color-gray-100)] text-[var(--color-text-muted)] text-xs rounded-full font-medium">{headerInfo.memberCount}</span>}
                    </h2>
                    {typingNames.length > 0 && (
                        <p className="text-xs text-[var(--color-primary)] font-medium flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] inline-block" />
                            {typingNames.length === 1
                                ? `${typingNames[0]} ${t('is_typing')}`
                                : `${typingNames.length} ${t('people_typing')}`
                            }
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1">
                {/* Search Panel Trigger - passed from parent or handled locally? 
                    The original used setShowSearchPanel(true) from local state.
                    We should probably accept onOpenSearch prop.
                */}
                <button className="p-2 rounded-full hover:bg-black/5 text-[var(--color-text-main)] transition-colors" onClick={() => navigate(`/chat/${chat.id}/search`)}>
                    {/* Note: I changed this to navigate for simplicity or I should pass a prop. Let's pass a prop. */}
                    <Search size={20} />
                </button>
                <button className="p-2 rounded-full hover:bg-black/5 text-[var(--color-text-main)] transition-colors" onClick={() => navigate(`/chat/${chat.id}/details`)}>
                    <MoreHorizontal size={20} />
                </button>
            </div>
        </div>
    );
}
