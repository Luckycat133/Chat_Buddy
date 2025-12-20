import React, { useState, useMemo } from 'react';
import { X, Search, MessageSquare, ChevronRight } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

export default function MessageSearchPanel({ onClose, onSelectMessage }) {
    const { chats, personas } = useChat();
    const { t, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');

    // Search through all messages
    const searchResults = useMemo(() => {
        if (!searchTerm.trim() || searchTerm.length < 2) return [];

        const results = [];
        const term = searchTerm.toLowerCase();

        chats.forEach(chat => {
            chat.messages.forEach(msg => {
                if (msg.content?.toLowerCase().includes(term)) {
                    const sender = msg.senderId === 'user-me'
                        ? { name: language === 'zh' ? '我' : 'Me' }
                        : personas.find(p => p.id === msg.senderId);

                    results.push({
                        chatId: chat.id,
                        chatName: chat.name || getChatName(chat),
                        messageId: msg.id,
                        content: msg.content,
                        senderName: sender ? (language === 'zh' ? sender.name_zh || sender.name : sender.name) : 'Unknown',
                        timestamp: msg.timestamp
                    });
                }
            });
        });

        // Sort by timestamp, newest first
        return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);
    }, [searchTerm, chats, personas, language]);

    const getChatName = (chat) => {
        const otherId = chat.participants.find(p => p !== 'user-me');
        const persona = personas.find(p => p.id === otherId);
        return persona ? (language === 'zh' ? persona.name_zh || persona.name : persona.name) : 'Chat';
    };

    const highlightMatch = (text, term) => {
        if (!term) return text;
        const regex = new RegExp(`(${term})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) =>
            part.toLowerCase() === term.toLowerCase()
                ? <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{part}</mark>
                : part
        );
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / 86400000);

        if (days === 0) {
            return date.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else if (days === 1) {
            return language === 'zh' ? '昨天' : 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' });
        } else {
            return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
                month: 'short',
                day: 'numeric'
            });
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
                <button onClick={onClose} className="text-[var(--color-text-muted)]">
                    <X size={24} />
                </button>

                <div className="flex-1 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={language === 'zh' ? '搜索聊天记录...' : 'Search messages...'}
                        autoFocus
                        className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-app)] rounded-lg text-[15px] outline-none focus:ring-2 ring-[var(--color-primary)]/30"
                    />
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
                {searchTerm.length < 2 ? (
                    <div className="p-8 text-center text-[var(--color-text-muted)]">
                        <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                        <p>{language === 'zh' ? '输入关键词搜索' : 'Enter keywords to search'}</p>
                        <p className="text-sm mt-1">{language === 'zh' ? '至少2个字符' : 'At least 2 characters'}</p>
                    </div>
                ) : searchResults.length === 0 ? (
                    <div className="p-8 text-center text-[var(--color-text-muted)]">
                        <Search size={48} className="mx-auto mb-4 opacity-50" />
                        <p>{language === 'zh' ? '未找到结果' : 'No results found'}</p>
                    </div>
                ) : (
                    <>
                        <div className="px-4 py-2 bg-[var(--color-bg-app)] text-sm text-[var(--color-text-muted)]">
                            {language === 'zh' ? `找到 ${searchResults.length} 条结果` : `${searchResults.length} results found`}
                        </div>
                        {searchResults.map((result, index) => (
                            <button
                                key={`${result.chatId}-${result.messageId}`}
                                onClick={() => {
                                    onSelectMessage?.(result.chatId, result.messageId);
                                    onClose?.();
                                }}
                                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[var(--color-bg-app)] transition-colors border-b border-[var(--color-border-light)]"
                            >
                                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white flex-shrink-0">
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
                                        {highlightMatch(result.content, searchTerm)}
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
