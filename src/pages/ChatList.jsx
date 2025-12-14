import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';
import { formatChatListTime } from '../utils/formatTime';

export default function ChatList() {
    const { chats, personas, typingIndicators } = useChat();
    const { t, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const location = useLocation();

    const getChatMetadata = (chat) => {
        let displayAvatar = chat.avatar;
        let displayName = chat.name;

        if (chat.participants.length > 0) {
            const aiId = chat.participants.find(p => p !== 'user-me');
            const ai = personas.find(p => p.id === aiId);

            if (ai) {
                if (!displayAvatar) displayAvatar = ai.avatar;
                const isDM = chat.participants.length === 2;
                if (isDM) {
                    displayName = language === 'zh' ? (ai.name_zh || ai.name) : ai.name;
                }
            }
        }
        return { name: displayName || t('unknown_chat'), avatar: displayAvatar };
    };

    const filteredChats = chats.filter(chat => {
        const meta = getChatMetadata(chat);
        return meta.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-white)] w-full md:w-[280px] flex-shrink-0 border-r border-[var(--color-border)]">
            {/* Search Header */}
            <div className="p-2 bg-[var(--color-bg-app)]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#B2B2B2]" size={14} />
                    <input
                        type="text"
                        placeholder={t('search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[var(--color-bg-white)] border-none rounded py-1.5 pl-8 pr-3 text-sm text-[var(--color-text-main)] placeholder:text-[#B2B2B2] focus:outline-none"
                    />
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {filteredChats.map((chat) => {
                    const meta = getChatMetadata(chat);
                    const lastMsg = chat.lastMessage;
                    const time = lastMsg ? formatChatListTime(lastMsg.timestamp, language) : '';
                    const isActive = location.pathname === `/chat/${chat.id}`;

                    // Check if anyone is typing in this chat
                    const typingAIs = typingIndicators?.[chat.id] || [];
                    const isTyping = typingAIs.length > 0;

                    return (
                        <Link
                            key={chat.id}
                            to={`/chat/${chat.id}`}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border-light)] transition-colors",
                                isActive
                                    ? "bg-[#C9C9C9]"
                                    : "bg-[var(--color-bg-white)] hover:bg-[#F5F5F5] active:bg-[#EBEBEB]"
                            )}
                        >
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-[4px] overflow-hidden flex-shrink-0 bg-[#E0E0E0] relative">
                                {meta.avatar ? (
                                    <img src={meta.avatar} alt="avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-medium">
                                        {meta.name.charAt(0)}
                                    </div>
                                )}
                                {/* Online indicator */}
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-normal text-[15px] text-[var(--color-text-main)] truncate">
                                        {meta.name}
                                    </h3>
                                    <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0 ml-2">{time}</span>
                                </div>
                                <p className={cn(
                                    "text-[13px] truncate mt-0.5",
                                    isTyping ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                                )}>
                                    {isTyping
                                        ? (language === 'zh' ? '正在输入...' : 'Typing...')
                                        : (lastMsg ? lastMsg.content : t('no_messages'))
                                    }
                                </p>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
