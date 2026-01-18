import React, { useState, useMemo, useCallback, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Pin, Circle, Trash2, MessageSquarePlus, Sparkles, X } from 'lucide-react';
import { useChat } from './context/ChatContext';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';
import { formatChatListTime } from '../../utils/formatTime';

// ========== Memoized Chat List Item (iOS 26 Card Style) ==========
const ChatListItem = memo(function ChatListItem({
    chat,
    meta,
    isActive,
    isTyping,
    time,
    language,
    t,
    onContextMenu,
    index
}) {
    return (
        <Link
            to={`/chat/${chat.id}`}
            onContextMenu={(e) => onContextMenu(e, chat.id)}
            className={cn(
                "flex items-center gap-4 p-3 rounded-[var(--radius-lg)] transition-all duration-400 group relative",
                "border border-transparent",
                isActive
                    ? "bg-white shadow-glow scale-[1.02] ring-2 ring-[var(--color-primary)]/10"
                    : "bg-white/40 hover:bg-white/80 hover:shadow-md hover:scale-[1.01]"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
        >
            {/* Active Indicator - Glowing Dot instead of line */}
            {isActive && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-[var(--color-primary)] opacity-0" />
            )}

            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className={cn(
                    "w-14 h-14 rounded-[var(--radius-md)] overflow-hidden transition-all duration-400",
                    isActive ? "shadow-md" : "shadow-sm"
                )}>
                    {meta.avatar ? (
                        <img src={meta.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold animate-aurora"
                            style={{ background: 'var(--gradient-aurora)' }}>
                            {meta.name.charAt(0)}
                        </div>
                    )}
                </div>
                {/* Online Dot (if social) */}
                {meta.type === 'social' && (
                    <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-[var(--color-success)] rounded-full 
                        border-2 border-white shadow-sm" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1">
                    <h3 className={cn(
                        "font-bold text-[15px] truncate flex items-center gap-1.5 transition-colors",
                        isActive ? "text-[var(--color-primary-active)]" : "text-[var(--color-text-main)]"
                    )}>
                        {chat.isPinned && (
                            <Pin size={12} className="text-[var(--color-primary)] fill-current rotate-45" />
                        )}
                        <span className="truncate">{meta.name}</span>
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {chat.isUnread && (
                            <div className="w-2.5 h-2.5 rounded-full animate-pulse"
                                style={{ background: 'var(--gradient-aurora)' }} />
                        )}
                        <span className="text-xs font-medium text-[var(--color-text-muted)] opacity-80">{time}</span>
                    </div>
                </div>
                <p className={cn(
                    "text-[13px] truncate transition-colors font-medium",
                    isTyping ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] opacity-80"
                )}>
                    {isTyping ? (
                        <span className="flex items-center gap-1">
                            {language === 'zh' ? '正在输入...' : 'Typing...'}
                        </span>
                    ) : (chat.lastMessage ? chat.lastMessage.content : t('no_messages'))}
                </p>
            </div>
        </Link>
    );
});

// ========== Empty State Component ==========
function EmptyState({ language, onCreateChat }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 animate-fade-slide-up">
            {/* Floating animated icon */}
            <div className="relative mb-8">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-40"
                    style={{ background: 'var(--gradient-aurora)' }} />
                <div className="relative w-28 h-28 rounded-full flex items-center justify-center animate-float"
                    style={{ background: 'var(--gradient-aurora-soft)' }}>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                        style={{ background: 'var(--gradient-aurora)' }}>
                        <Sparkles size={36} className="text-white" />
                    </div>
                </div>
            </div>

            <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2 text-center font-display">
                {language === 'zh' ? '开始你的AI伙伴之旅' : 'Start Your AI Adventure'}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] text-center max-w-xs mb-8 leading-relaxed">
                {language === 'zh'
                    ? '与独特的AI角色成为朋友，享受有趣的对话体验！'
                    : 'Make friends with unique AI characters and enjoy fun conversations!'}
            </p>

            <button
                onClick={onCreateChat}
                className="btn-primary flex items-center gap-2 px-6 py-3 text-[15px]"
            >
                <MessageSquarePlus size={20} />
                {language === 'zh' ? '开始聊天' : 'Start Chatting'}
            </button>
        </div>
    );
}

// ========== Context Menu Item Helper ==========
function ContextMenuItem({ icon, label, onClick, active, colorClass = "text-[var(--color-primary)]" }) {
    return (
        <button
            onClick={onClick}
            className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 
                hover:bg-[var(--color-bg-hover)] text-[var(--color-text-main)] transition-colors group"
        >
            <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                active ? "bg-[var(--color-bg-active)]" : "bg-gray-50 group-hover:bg-white"
            )}>
                <span className={cn(active ? colorClass : "text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]")}>
                    {icon}
                </span>
            </div>
            <span className="font-medium">{label}</span>
        </button>
    );
}


// ========== Main ChatList Component ==========
export default function ChatList() {
    const { chats, personas, typingIndicators, pinChat, markChatUnread, deleteChat } = useChat();
    const { t, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

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
                // EXCLUDE TASK AGENTS from main list per user request
                if (meta.type === 'task') return false;

                const matchesSearch = meta.name.toLowerCase().includes(searchTerm.toLowerCase());
                // activeTab logic simpler now since we only have 'all' effectively for non-task
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


    const handleCreateChat = useCallback(() => {
        navigate('/friends');
    }, [navigate]);

    return (
        <div className="flex flex-col h-full w-full md:w-[360px] flex-shrink-0 relative z-10 
            md:py-4 md:pl-4 overflow-hidden" onClick={closeContextMenu}>

            {/* Search Header - Floating Glass Pill */}
            <div className="px-2 mb-2 z-20">
                <div className="glass-crystal rounded-[var(--radius-xl)] p-2 shadow-floating transition-all duration-300">
                    <div className={cn(
                        "relative flex items-center transition-all duration-300",
                        searchFocused && "scale-[1.01]"
                    )}>
                        <Search className={cn(
                            "absolute left-4 transition-colors duration-300",
                            searchFocused ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                        )} size={20} />
                        <input
                            type="text"
                            placeholder={t('search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                            className="w-full bg-transparent border-none py-3 pl-12 pr-4 text-[15px]
                                text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]
                                focus:outline-none font-medium"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 p-1 rounded-full hover:bg-[var(--color-bg-hover)] 
                                    text-[var(--color-text-muted)] transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs - Inside the Glass Shell */}
                    <div className="flex gap-2 mt-2 px-1 pb-1 overflow-x-auto scrollbar-hide">
                        {['all', 'social', 'task'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 whitespace-nowrap",
                                    activeTab === tab
                                        ? "text-white shadow-glow"
                                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
                                )}
                                style={activeTab === tab ? {
                                    background: 'var(--gradient-aurora)',
                                } : {}}
                            >
                                {tab === 'all' && t('all_chats')}
                                {tab === 'social' && t('social_companions')}
                                {tab === 'task' && t('task_agents')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chat List - Floating Cards Container */}
            <div className="flex-1 overflow-y-auto px-2 space-y-3 pb-32 md:pb-4 custom-scrollbar">
                {filteredChats.length === 0 ? (
                    <EmptyState language={language} onCreateChat={handleCreateChat} />
                ) : (
                    filteredChats.map(({ chat, meta }, index) => {
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
                                index={index}
                            />
                        );
                    })
                )}
            </div>

            {/* Context Menu - Floating Crystal */}
            {contextMenu && (
                <div
                    className="fixed z-50 glass-crystal rounded-[var(--radius-lg)] shadow-floating py-2 min-w-[200px] 
                        animate-scale-spring origin-top-left overflow-hidden ring-1 ring-white/60"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <ContextMenuItem
                        icon={<Pin size={16} />}
                        label={chats.find(c => c.id === contextMenu.chatId)?.isPinned ? t('unpin') : t('pin')}
                        active={chats.find(c => c.id === contextMenu.chatId)?.isPinned}
                        onClick={() => handlePin(contextMenu.chatId)}
                    />
                    <ContextMenuItem
                        icon={<Circle size={16} />}
                        label={chats.find(c => c.id === contextMenu.chatId)?.isUnread ? t('mark_read') : t('mark_unread')}
                        active={chats.find(c => c.id === contextMenu.chatId)?.isUnread}
                        colorClass="text-[var(--color-accent-sky)]"
                        onClick={() => handleMarkUnread(contextMenu.chatId)}
                    />

                    <div className="h-px bg-[var(--color-border)] my-1 mx-3 opacity-50" />

                    <ContextMenuItem
                        icon={<Trash2 size={16} />}
                        label={t('delete')}
                        colorClass="text-[var(--color-danger)]"
                        onClick={() => handleDelete(contextMenu.chatId)}
                    />
                </div>
            )}
        </div>
    );
}
