import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Pin, Circle, Trash2, X } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';
import { formatChatListTime } from '../utils/formatTime';

export default function ChatList() {
    const { chats, personas, typingIndicators, pinChat, markChatUnread, deleteChat } = useChat();
    const { t, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const location = useLocation();

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null); // { chatId, x, y }

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

    const filteredChats = chats
        .filter(chat => {
            const meta = getChatMetadata(chat);
            return meta.name.toLowerCase().includes(searchTerm.toLowerCase());
        })
        // Sort: pinned first, then by last message time
        .sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const aTime = a.lastMessage?.timestamp || a.createdAt;
            const bTime = b.lastMessage?.timestamp || b.createdAt;
            return new Date(bTime) - new Date(aTime);
        });

    const handleContextMenu = (e, chatId) => {
        e.preventDefault();
        setContextMenu({ chatId, x: e.clientX, y: e.clientY });
    };

    const closeContextMenu = () => setContextMenu(null);

    const handlePin = (chatId) => {
        const chat = chats.find(c => c.id === chatId);
        pinChat(chatId, !chat?.isPinned);
        closeContextMenu();
    };

    const handleMarkUnread = (chatId) => {
        const chat = chats.find(c => c.id === chatId);
        markChatUnread(chatId, !chat?.isUnread);
        closeContextMenu();
    };

    const handleDelete = (chatId) => {
        if (window.confirm(t('confirm_delete'))) {
            deleteChat(chatId);
        }
        closeContextMenu();
    };

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-white)] w-full md:w-[280px] flex-shrink-0 border-r border-[var(--color-border)]" onClick={closeContextMenu}>
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
                            onContextMenu={(e) => handleContextMenu(e, chat.id)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border-light)] transition-colors",
                                isActive
                                    ? "bg-[#C9C9C9]"
                                    : chat.isPinned
                                        ? "bg-[#F0F0F0] hover:bg-[#E8E8E8]"
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
                                    <h3 className="font-normal text-[15px] text-[var(--color-text-main)] truncate flex items-center gap-1">
                                        {chat.isPinned && <Pin size={12} className="text-[var(--color-text-muted)]" />}
                                        {meta.name}
                                    </h3>
                                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                        {chat.isUnread && <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />}
                                        <span className="text-xs text-[var(--color-text-muted)]">{time}</span>
                                    </div>
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

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px] animate-scale-in"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => handlePin(contextMenu.chatId)}
                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 text-gray-700"
                    >
                        <Pin size={16} />
                        {chats.find(c => c.id === contextMenu.chatId)?.isPinned
                            ? (language === 'zh' ? '取消置顶' : 'Unpin')
                            : (language === 'zh' ? '置顶' : 'Pin')}
                    </button>
                    <button
                        onClick={() => handleMarkUnread(contextMenu.chatId)}
                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 text-gray-700"
                    >
                        <Circle size={16} />
                        {chats.find(c => c.id === contextMenu.chatId)?.isUnread
                            ? (language === 'zh' ? '标为已读' : 'Mark as Read')
                            : (language === 'zh' ? '标为未读' : 'Mark as Unread')}
                    </button>
                    <button
                        onClick={() => handleDelete(contextMenu.chatId)}
                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-red-50 text-red-500"
                    >
                        <Trash2 size={16} />
                        {language === 'zh' ? '删除' : 'Delete'}
                    </button>
                </div>
            )}
        </div>
    );
}
