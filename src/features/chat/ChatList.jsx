import React, { useState, useMemo, useCallback, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Pin, Circle, Trash2, X } from 'lucide-react';
import { useChat } from './context/ChatContext';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';
import { formatChatListTime } from '../../utils/formatTime';

// ========== Memoized Chat List Item ==========
const ChatListItem = memo(function ChatListItem({
    chat,
    meta,
    isActive,
    isTyping,
    time,
    language,
    t,
    onContextMenu
}) {
    return (
        <Link
            to={`/chat/${chat.id}`}
            onContextMenu={(e) => onContextMenu(e, chat.id)}
            className={cn(
                "flex items-center gap-3.5 px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                isActive
                    ? "bg-[var(--color-primary-softer)] shadow-sm"
                    : chat.isPinned
                        ? "bg-[var(--color-bg-app)]/50 hover:bg-[var(--color-bg-app)]"
                        : "hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-bg-active)]"
            )}
        >
            {/* Active Indicator Line */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-[var(--color-primary)] rounded-r-full" />
            )}

            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className={cn(
                    "w-12 h-12 rounded-xl overflow-hidden shadow-sm transition-transform duration-300",
                    isActive ? "ring-2 ring-[var(--color-primary-light)] scale-105" : "group-hover:scale-105"
                )}>
                    {meta.avatar ? (
                        <img src={meta.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-active)] flex items-center justify-center text-white text-lg font-bold">
                            {meta.name.charAt(0)}
                        </div>
                    )}
                </div>
                {/* Online indicator */}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={cn(
                        "font-medium text-[15px] truncate flex items-center gap-1.5 transition-colors",
                        isActive ? "text-[var(--color-primary-active)]" : "text-[var(--color-text-main)]"
                    )}>
                        {chat.isPinned && <Pin size={12} className="text-[var(--color-primary)] fill-current rotate-45" />}
                        {meta.name}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {chat.isUnread && <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] shadow-glow animate-pulse" />}
                        <span className={cn(
                            "text-xs",
                            isActive ? "text-[var(--color-primary)] font-medium" : "text-[var(--color-text-muted)]"
                        )}>{time}</span>
                    </div>
                </div>
                <p className={cn(
                    "text-[13px] truncate transition-colors",
                    isTyping ? "text-[var(--color-primary)] font-medium" : (isActive ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]")
                )}>
                    {isTyping
                        ? (language === 'zh' ? '正在输入...' : 'Typing...')
                        : (chat.lastMessage ? chat.lastMessage.content : t('no_messages'))
                    }
                </p>
            </div>
        </Link>
    );
});

// ========== Main ChatList Component ==========
export default function ChatList() {
    const { chats, personas, typingIndicators, pinChat, markChatUnread, deleteChat, setChatCategory } = useChat();
    const { t, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const location = useLocation();

    const [activeTab, setActiveTab] = useState('all'); // 'all', 'social', 'task'

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null); // { chatId, x, y }

    // Memoize getChatMetadata to avoid recalculation
    const getChatMetadata = useCallback((chat) => {
        let displayAvatar = chat.avatar;
        let displayName = chat.name;
        let type = 'social'; // default type

        if (chat.participants.length > 0) {
            const aiId = chat.participants.find(p => p !== 'user-me');
            const ai = personas.find(p => p.id === aiId);

            if (ai) {
                if (!displayAvatar) displayAvatar = ai.avatar;
                const isDM = chat.participants.length === 2;
                if (isDM) {
                    displayName = language === 'zh' ? (ai.name_zh || ai.name) : ai.name;
                }
                // Determine type based on AI agent type
                type = ai.agentType === 'task-specialist' ? 'task' : 'social';
            }
        }
        return { name: displayName || t('unknown_chat'), avatar: displayAvatar, type };
    }, [personas, language, t]);

    // Memoize filtered and sorted chats
    const filteredChats = useMemo(() => {
        return chats
            .map(chat => ({ chat, meta: getChatMetadata(chat) }))
            .filter(({ meta }) => {
                const matchesSearch = meta.name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesTab = activeTab === 'all' || meta.type === activeTab;
                return matchesSearch && matchesTab;
            })
            .sort((a, b) => {
                if (a.chat.isPinned && !b.chat.isPinned) return -1;
                if (!a.chat.isPinned && b.chat.isPinned) return 1;
                const aTime = a.chat.lastMessage?.timestamp || a.chat.createdAt;
                const bTime = b.chat.lastMessage?.timestamp || b.chat.createdAt;
                return new Date(bTime) - new Date(aTime);
            });
    }, [chats, getChatMetadata, searchTerm, activeTab]);

    // Memoize event handlers
    const handleContextMenu = useCallback((e, chatId) => {
        e.preventDefault();
        setContextMenu({ chatId, x: e.clientX, y: e.clientY });
    }, []);

    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    const handlePin = useCallback((chatId) => {
        const chat = chats.find(c => c.id === chatId);
        pinChat(chatId, !chat?.isPinned);
        closeContextMenu();
    }, [chats, pinChat, closeContextMenu]);

    const handleMarkUnread = useCallback((chatId) => {
        const chat = chats.find(c => c.id === chatId);
        markChatUnread(chatId, !chat?.isUnread);
        closeContextMenu();
    }, [chats, markChatUnread, closeContextMenu]);

    const handleDelete = useCallback((chatId) => {
        if (window.confirm(t('confirm_delete'))) {
            deleteChat(chatId);
        }
        closeContextMenu();
    }, [deleteChat, t, closeContextMenu]);

    const handleSetCategory = useCallback((chatId, category) => {
        setChatCategory(chatId, category);
        closeContextMenu();
    }, [setChatCategory, closeContextMenu]);

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-white)] w-full md:w-[320px] flex-shrink-0 border-r border-[var(--color-border)] relative z-10" onClick={closeContextMenu}>
            {/* Search Header */}
            <div className="p-4 bg-white/50 backdrop-blur-sm sticky top-0 z-10 border-b border-[var(--color-border-light)] space-y-3">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] transition-colors group-focus-within:text-[var(--color-primary)]" size={16} />
                    <input
                        type="text"
                        placeholder={t('search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[var(--color-bg-app)] border border-transparent rounded-xl py-2 pl-9 pr-3 text-sm text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:bg-white focus:border-[var(--color-primary-light)] focus:shadow-sm transition-all"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex p-1 bg-[var(--color-bg-app)] rounded-lg">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                            activeTab === 'all'
                                ? "bg-white text-[var(--color-primary)] shadow-sm"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                        )}
                    >
                        {t('all_personas')}
                    </button>
                    <button
                        onClick={() => setActiveTab('social')}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                            activeTab === 'social'
                                ? "bg-white text-[var(--color-primary)] shadow-sm"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                        )}
                    >
                        {t('social_companions')}
                    </button>
                    <button
                        onClick={() => setActiveTab('task')}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                            activeTab === 'task'
                                ? "bg-white text-[var(--color-primary)] shadow-sm"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                        )}
                    >
                        {t('task_agents')}
                    </button>
                </div>
            </div>


            {/* Chat List */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {filteredChats.map(({ chat, meta }) => {
                    const lastMsg = chat.lastMessage;
                    const time = lastMsg ? formatChatListTime(lastMsg.timestamp, language) : '';
                    const isActive = location.pathname === `/chat/${chat.id}`;
                    const typingAIs = typingIndicators?.[chat.id] || [];
                    const isTyping = typingAIs.length > 0;

                    return (
                        <ChatListItem
                            key={chat.id}
                            chat={chat}
                            meta={meta}
                            isActive={isActive}
                            isTyping={isTyping}
                            time={time}
                            language={language}
                            t={t}
                            onContextMenu={handleContextMenu}
                        />
                    );
                })}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white/90 backdrop-blur-xl rounded-xl shadow-float border border-white/20 py-1.5 min-w-[160px] animate-scale-in origin-top-left overflow-hidden ring-1 ring-black/5"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => handlePin(contextMenu.chatId)}
                        className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-[var(--color-primary-softer)] text-[var(--color-text-main)] transition-colors"
                    >
                        <Pin size={16} className={chats.find(c => c.id === contextMenu.chatId)?.isPinned ? "fill-current" : ""} />
                        {chats.find(c => c.id === contextMenu.chatId)?.isPinned
                            ? (language === 'zh' ? '取消置顶' : 'Unpin')
                            : (language === 'zh' ? '置顶' : 'Pin')}
                    </button>
                    <button
                        onClick={() => handleMarkUnread(contextMenu.chatId)}
                        className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-[var(--color-primary-softer)] text-[var(--color-text-main)] transition-colors"
                    >
                        <Circle size={16} />
                        {chats.find(c => c.id === contextMenu.chatId)?.isUnread
                            ? (language === 'zh' ? '标为已读' : 'Mark as Read')
                            : (language === 'zh' ? '标为未读' : 'Mark as Unread')}
                    </button>

                    {/* Category Submenu */}
                    <div className="h-px bg-gray-100 my-1 mx-2" />
                    <div className="px-4 py-1.5 text-xs text-[var(--color-text-muted)] font-medium">
                        {language === 'zh' ? '设置分类' : 'Set Category'}
                    </div>
                    <button
                        onClick={() => handleSetCategory(contextMenu.chatId, 'social')}
                        className="w-full px-8 py-1.5 text-left text-sm hover:bg-[var(--color-primary-softer)] text-[var(--color-text-main)]"
                    >
                        {t('social_companions')}
                    </button>
                    <button
                        onClick={() => handleSetCategory(contextMenu.chatId, 'task')}
                        className="w-full px-8 py-1.5 text-left text-sm hover:bg-[var(--color-primary-softer)] text-[var(--color-text-main)]"
                    >
                        {t('task_agents')}
                    </button>

                    <div className="h-px bg-gray-100 my-1 mx-2" />
                    <button
                        onClick={() => handleDelete(contextMenu.chatId)}
                        className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-red-50 text-[var(--color-danger)] transition-colors"
                    >
                        <Trash2 size={16} />
                        {language === 'zh' ? '删除' : 'Delete'}
                    </button>
                </div>
            )}
        </div>
    );
}
