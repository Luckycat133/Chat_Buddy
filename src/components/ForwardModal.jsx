import React, { useState } from 'react';
import { X, Send, Search, Check } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useFriend } from '../context/FriendContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

export default function ForwardModal({ message, onClose, onForward }) {
    const { chats, personas } = useChat();
    const { getDisplayName } = useFriend();
    const { t, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChats, setSelectedChats] = useState([]);

    // Filter chats based on search
    const filteredChats = chats.filter(chat => {
        const chatName = chat.name || '';
        const matches = chatName.toLowerCase().includes(searchTerm.toLowerCase());

        // Also check participant names
        const participantMatches = chat.participants.some(pId => {
            if (pId === 'user-me') return false;
            const persona = personas.find(p => p.id === pId);
            if (!persona) return false;
            const name = language === 'zh' ? (persona.name_zh || persona.name) : persona.name;
            return name.toLowerCase().includes(searchTerm.toLowerCase());
        });

        return matches || participantMatches;
    });

    const toggleChat = (chatId) => {
        setSelectedChats(prev =>
            prev.includes(chatId)
                ? prev.filter(id => id !== chatId)
                : [...prev, chatId]
        );
    };

    const handleForward = () => {
        if (selectedChats.length === 0) return;
        onForward?.(message, selectedChats);
        onClose?.();
    };

    const getChatName = (chat) => {
        if (chat.name) return chat.name;
        const otherId = chat.participants.find(p => p !== 'user-me');
        const persona = personas.find(p => p.id === otherId);
        return persona ? (language === 'zh' ? persona.name_zh || persona.name : persona.name) : 'Unknown';
    };

    const getChatAvatar = (chat) => {
        const otherId = chat.participants.find(p => p !== 'user-me');
        const persona = personas.find(p => p.id === otherId);
        return persona?.avatar || null;
    };

    if (!message) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <button onClick={onClose} className="text-[var(--color-text-muted)]">
                        <X size={24} />
                    </button>
                    <h3 className="font-medium text-[17px]">{t('forward_to') || 'Forward to'}</h3>
                    <button
                        onClick={handleForward}
                        disabled={selectedChats.length === 0}
                        className={cn(
                            "p-2 rounded-full transition-colors",
                            selectedChats.length > 0
                                ? "text-[var(--color-primary)]"
                                : "text-[var(--color-text-light)]"
                        )}
                    >
                        <Send size={20} />
                    </button>
                </div>

                {/* Message Preview */}
                <div className="px-4 py-2 bg-[var(--color-bg-app)] border-b border-[var(--color-border)]">
                    <p className="text-sm text-[var(--color-text-muted)]">
                        {t('forwarding_message') || 'To forward:'}
                    </p>
                    <p className="text-sm truncate mt-1">
                        {message.content?.slice(0, 50)}{message.content?.length > 50 ? '...' : ''}
                    </p>
                </div>

                {/* Search */}
                <div className="px-4 py-2 border-b border-[var(--color-border)]">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('search_chats') || 'Search chats...'}
                            className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-app)] rounded-lg text-sm outline-none"
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredChats.length === 0 ? (
                        <div className="p-8 text-center text-[var(--color-text-muted)]">
                            {t('no_chats_found') || 'No chats found'}
                        </div>
                    ) : (
                        filteredChats.map(chat => (
                            <button
                                key={chat.id}
                                onClick={() => toggleChat(chat.id)}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-bg-app)] transition-colors"
                            >
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--color-primary)] flex-shrink-0">
                                    {getChatAvatar(chat) ? (
                                        <img src={getChatAvatar(chat)} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white font-medium">
                                            {getChatName(chat).charAt(0)}
                                        </div>
                                    )}
                                </div>

                                {/* Name */}
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-[var(--color-text-main)]">
                                        {getChatName(chat)}
                                    </p>
                                    {chat.participants.length > 2 && (
                                        <p className="text-xs text-[var(--color-text-muted)]">
                                            {chat.participants.length} {t('members') || 'members'}
                                        </p>
                                    )}
                                </div>

                                {/* Checkbox */}
                                <div className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                    selectedChats.includes(chat.id)
                                        ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                                        : "border-[var(--color-text-muted)]"
                                )}>
                                    {selectedChats.includes(chat.id) && (
                                        <Check size={14} className="text-white" />
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Footer */}
                {selectedChats.length > 0 && (
                    <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-app)]">
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {selectedChats.length} {t('selected') || 'selected'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
