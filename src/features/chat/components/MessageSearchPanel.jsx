import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Search, MessageSquare, ChevronRight } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { cn } from '../../../utils/cn';

export default function MessageSearchPanel({ onClose, onSelectMessage, currentChatId }) {
    const { chats, personas } = useChat();
    const { t, language } = useLanguage();
    const trapRef = useFocusTrap(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [searchScope, setSearchScope] = useState(currentChatId ? 'current' : 'all'); // 'all' or 'current'
    const [fileType, setFileType] = useState('all'); // 'all', 'text', 'image', 'file', 'audio'

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const getChatName = useCallback((chat) => {
        if (!chat || !chat.participants) return 'Chat';
        const otherId = chat.participants.find(p => p !== 'user-me');
        const persona = personas?.find(p => p.id === otherId);
        return persona ? (language === 'zh' ? persona.name_zh || persona.name : persona.name) : 'Chat';
    }, [personas, language]);

    // Search through all messages
    const searchResults = useMemo(() => {
        if (!debouncedTerm.trim() || debouncedTerm.length < 2) return [];
        if (!chats || !personas) return [];

        const results = [];
        const term = debouncedTerm.toLowerCase();

        const chatsToSearch = searchScope === 'current' && currentChatId
            ? chats.filter(c => c.id === currentChatId)
            : chats;

        chatsToSearch.forEach(chat => {
            if (!chat || !chat.messages) return;

            chat.messages.forEach(msg => {
                let matchesType = true;
                const content = String(msg.content || '');

                // Filter by type
                if (fileType === 'image') {
                    matchesType = content.includes('[IMG:');
                } else if (fileType === 'file') {
                    matchesType = content.includes('[FILE]');
                } else if (fileType === 'audio') {
                    matchesType = content.includes('[VOICE:');
                } else if (fileType === 'text') {
                    matchesType = !content.includes('[IMG:') && !content.includes('[FILE]') && !content.includes('[VOICE:');
                }

                if (!matchesType) return;

                let contentToMatch = content;
                if (content.includes('[FILE]')) {
                    contentToMatch = content.replace('[FILE]', '').trim();
                } else if (content.includes('[IMG:')) {
                    contentToMatch = "Image";
                }

                if (contentToMatch.toLowerCase().includes(term)) {
                    const sender = msg.senderId === 'user-me'
                        ? { name: language === 'zh' ? '我' : 'Me' }
                        : personas.find(p => p.id === msg.senderId);

                    results.push({
                        chatId: chat.id,
                        chatName: chat.name || getChatName(chat),
                        messageId: msg.id,
                        content: content,
                        senderName: sender ? (language === 'zh' ? sender.name_zh || sender.name : sender.name) : 'Unknown',
                        timestamp: msg.timestamp
                    });
                }
            });
        });

        // Sort by timestamp, newest first
        return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);
    }, [debouncedTerm, chats, personas, language, searchScope, currentChatId, fileType, getChatName]);

    const highlightMatch = (text, term) => {
        if (!term || !text) return text;
        try {
            // Escape special regex characters
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedTerm})`, 'gi');
            const parts = text.split(regex);
            return parts.map((part, i) =>
                part.toLowerCase() === term.toLowerCase()
                    ? <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{part}</mark>
                    : part
            );
        } catch (e) {
            console.error("Search highlight error:", e);
            return text;
        }
    };

    const formatTime = (timestamp) => {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';

            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / 86400000);

            if (days === 0) {
                return date.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } else if (days === 1) {
                return t('search_yesterday');
            } else if (days < 7) {
                return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' });
            } else {
                return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            }
        } catch (e) {
            console.warn('[MessageSearch] Date formatting failed:', e?.message);
            return '';
        }
    };

    return (
        <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-search-title"
            className="fixed inset-0 z-50 bg-[var(--color-bg-white)] flex flex-col"
        >
            {/* Header */}
            <h2 id="message-search-title" className="sr-only">
                {t('search_messages_title')}
            </h2>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
                <button onClick={onClose} className="text-[var(--color-text-muted)]" aria-label="Close">
                    <X size={24} />
                </button>

                <div className="flex-1 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('search_messages_placeholder')}
                        autoFocus
                        className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-app)] rounded-lg text-[15px] outline-none focus:ring-2 ring-[var(--color-primary)]/30"
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="px-4 py-2 bg-[var(--color-bg-white)] border-b border-[var(--color-border-light)] flex flex-wrap gap-2">
                {currentChatId && (
                    <div className="flex bg-[var(--color-bg-app)] rounded-lg p-0.5">
                        <button
                            onClick={() => setSearchScope('current')}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                searchScope === 'current' ? "bg-[var(--color-bg-white)] shadow-sm text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                            )}
                        >
                            {t('search_current_chat')}
                        </button>
                        <button
                            onClick={() => setSearchScope('all')}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                searchScope === 'all' ? "bg-[var(--color-bg-white)] shadow-sm text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                            )}
                        >
                            {t('search_all_chats')}
                        </button>
                    </div>
                )}

                <div className="flex bg-[var(--color-bg-app)] rounded-lg p-0.5 overflow-x-auto no-scrollbar">
                    {['all', 'text', 'image', 'file', 'audio'].map(type => (
                        <button
                            key={type}
                            onClick={() => setFileType(type)}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                fileType === type ? "bg-[var(--color-bg-white)] shadow-sm text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                            )}
                        >
                            {type === 'all' ? t('search_type_all') :
                                type === 'text' ? t('search_type_text') :
                                    type === 'image' ? t('search_type_image') :
                                        type === 'file' ? t('search_type_file') :
                                            t('search_type_audio')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
                {searchTerm.length < 2 ? (
                    <div className="p-8 text-center text-[var(--color-text-muted)]">
                        <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                        <p>{t('search_enter_keywords')}</p>
                        <p className="text-sm mt-1">{t('search_min_chars')}</p>
                    </div>
                ) : searchResults.length === 0 ? (
                    <div className="p-8 text-center text-[var(--color-text-muted)]">
                        <Search size={48} className="mx-auto mb-4 opacity-50" />
                        <p>{t('search_no_results')}</p>
                    </div>
                ) : (
                    <>
                        <div className="px-4 py-2 bg-[var(--color-bg-app)] text-sm text-[var(--color-text-muted)]">
                            {t('search_results_count', { count: searchResults.length })}
                        </div>
                        {searchResults.map((result) => (
                            <button
                                key={`${result.chatId}-${result.messageId}`}
                                onClick={() => {
                                    onSelectMessage?.(result.chatId, result.messageId);
                                    onClose?.();
                                }}
                                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[var(--color-bg-app)] transition-colors border-b border-[var(--color-border-light)]"
                            >
                                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-on-primary)] flex-shrink-0">
                                    <MessageSquare size={18} />
                                </div>

                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-[var(--color-text-main)] text-[15px]">
                                            {result.chatName}
                                        </span>
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                            {formatTime(result.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--color-primary)] mt-0.5">
                                        {result.senderName}
                                    </p>
                                    <p className="text-sm text-[var(--color-text-main)] mt-1 line-clamp-2">
                                        {highlightMatch(result.content, debouncedTerm)}
                                    </p>
                                </div>

                                <ChevronRight size={20} className="text-[var(--color-text-muted)] flex-shrink-0 mt-2" />
                            </button>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
