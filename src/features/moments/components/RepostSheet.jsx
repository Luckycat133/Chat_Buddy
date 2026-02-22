import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useChatService } from '../../chat/hooks/useChatService';
import { useLanguage } from '../../../context/LanguageContext';

export default function RepostSheet({ post, authorName, onClose }) {
    const { chats, sendMessage } = useChatService();
    const { t, language } = useLanguage();
    const [sentTo, setSentTo] = useState(null);

    const handleShare = (chat) => {
        const formattedContent = `[${language === 'zh' ? '分享动态' : 'Shared Moment'} · ${authorName}]\n${post.content}`;
        sendMessage(chat.id, formattedContent);
        setSentTo(chat.id);
        setTimeout(onClose, 1200);
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg-white)] rounded-t-2xl max-h-[70vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <h3 className="font-medium text-[16px] text-[var(--color-text-main)]">
                        {t('select_chat_to_share') || 'Select a chat to share'}
                    </h3>
                    <button onClick={onClose} className="text-[var(--color-text-muted)]">
                        <X size={20} />
                    </button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                    {chats.length === 0 ? (
                        <div className="p-8 text-center text-[var(--color-text-muted)] text-[14px]">
                            {language === 'zh' ? '暂无聊天' : 'No chats available'}
                        </div>
                    ) : (
                        chats.map(chat => (
                            <button
                                key={chat.id}
                                onClick={() => handleShare(chat)}
                                disabled={sentTo === chat.id}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-app)] border-b border-[var(--color-border-light)] transition-colors"
                            >
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex-shrink-0 flex items-center justify-center overflow-hidden">
                                    {chat.avatar ? (
                                        <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-white font-bold text-[16px]">
                                            {chat.name?.charAt(0)?.toUpperCase() || '?'}
                                        </span>
                                    )}
                                </div>

                                <span className="flex-1 text-left text-[15px] text-[var(--color-text-main)] truncate">
                                    {chat.name}
                                </span>

                                {sentTo === chat.id && (
                                    <Check size={18} className="text-[var(--color-primary)] flex-shrink-0" />
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
