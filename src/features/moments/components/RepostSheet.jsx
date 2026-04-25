import React, { useState } from 'react';
import { Check, Repeat2, Send, X } from 'lucide-react';
import { useChatService } from '../../chat/hooks/useChatService';
import { useMoments } from '../context/MomentsContext';
import { useLanguage } from '../../../context/LanguageContext';

export default function RepostSheet({ post, authorName, onClose }) {
    const { chats, sendMessage } = useChatService();
    const { incrementShare, repostPost } = useMoments();
    const { t, language } = useLanguage();
    const [sentTo, setSentTo] = useState(null);
    const [note, setNote] = useState('');
    const [repostedToFeed, setRepostedToFeed] = useState(false);

    const handleShareToChat = (chat) => {
        const formattedContent = `[${language === 'zh' ? '分享动态' : 'Shared Moment'} · ${authorName}]\n${post.content}`;
        sendMessage(chat.id, formattedContent);
        incrementShare(post.id, { sharerId: 'user-me', target: 'chat', targetId: chat.id });
        setSentTo(chat.id);
        setTimeout(onClose, 1200);
    };

    const handleRepostToMoments = () => {
        repostPost(post.id, note.trim(), 'user-me');
        setRepostedToFeed(true);
        setTimeout(onClose, 1000);
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

            <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[78vh] rounded-t-[28px] bg-[var(--color-bg-white)] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
                    <h3 className="text-[16px] font-semibold text-[var(--color-text-main)]">
                        {language === 'zh' ? '更多互动' : 'More ways to share'}
                    </h3>
                    <button type="button" onClick={onClose} className="text-[var(--color-text-muted)]">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-5 overflow-y-auto px-4 py-4">
                    <section className="rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,241,0.94))] p-4">
                        <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--color-text-main)]">
                            <Repeat2 size={16} className="text-[var(--color-primary)]" />
                            {language === 'zh' ? '转发到我的朋友圈' : 'Repost to my feed'}
                        </div>
                        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-muted)]">
                            {language === 'zh'
                                ? '可以额外写一句自己的感受，再把这条动态带回你的动态流。'
                                : 'Add a short thought of your own, then repost this moment into your feed.'}
                        </p>

                        <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder={language === 'zh' ? '写一句你想补充的话（可选）...' : 'Add a line of your own (optional)...'}
                            className="mt-3 h-24 w-full resize-none rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-[14px] outline-none"
                        />

                        <button
                            type="button"
                            onClick={handleRepostToMoments}
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
                        >
                            {repostedToFeed ? <Check size={16} /> : <Repeat2 size={16} />}
                            {language === 'zh' ? '转发到朋友圈' : 'Repost to Moments'}
                        </button>
                    </section>

                    <section>
                        <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--color-text-main)]">
                            <Send size={16} className="text-[var(--color-primary)]" />
                            {t('select_chat_to_share') || 'Select a chat to share'}
                        </div>
                        <div className="mt-3 overflow-hidden rounded-3xl border border-[var(--color-border)]">
                            {chats.length === 0 ? (
                                <div className="p-8 text-center text-[14px] text-[var(--color-text-muted)]">
                                    {t('no_chats_available')}
                                </div>
                            ) : (
                                chats.map(chat => (
                                    <button
                                        key={chat.id}
                                        type="button"
                                        onClick={() => handleShareToChat(chat)}
                                        disabled={sentTo === chat.id}
                                        className="flex w-full items-center gap-3 border-b border-[var(--color-border-light)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-bg-app)]"
                                    >
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)]">
                                            {chat.avatar ? (
                                                <img src={chat.avatar} alt={chat.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-[16px] font-bold text-white">
                                                    {chat.name?.charAt(0)?.toUpperCase() || '?'}
                                                </span>
                                            )}
                                        </div>

                                        <span className="flex-1 truncate text-[15px] text-[var(--color-text-main)]">
                                            {chat.name}
                                        </span>

                                        {sentTo === chat.id && (
                                            <Check size={18} className="flex-shrink-0 text-[var(--color-primary)]" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}
