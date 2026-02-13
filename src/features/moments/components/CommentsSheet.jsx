import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Trash2, Reply } from 'lucide-react';
import { useMoments } from '../context/MomentsContext';
import { useFriend } from '../../../context/FriendContext';
import { useUser } from '../../../context/UserContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

export default function CommentsSheet({ post, onClose }) {
    const { addComment, deleteComment, getAuthor } = useMoments();
    const { getDisplayName } = useFriend();
    const { userProfile, getDisplayName: getUserDisplayName } = useUser();
    const { t, language } = useLanguage();

    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState(null); // { commentId, authorId, authorName }
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Focus input when replying
    useEffect(() => {
        if (replyTo) {
            inputRef.current?.focus();
        }
    }, [replyTo]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        addComment(post.id, commentText.trim(), 'user-me', replyTo);
        setCommentText('');
        setReplyTo(null);
    };

    const handleReply = (comment) => {
        const author = getAuthor(comment.authorId);
        const authorName = comment.authorId === 'user-me'
            ? getUserDisplayName(language)
            : getDisplayName(author, language);

        setReplyTo({
            commentId: comment.id,
            authorId: comment.authorId,
            authorName
        });
    };

    const cancelReply = () => {
        setReplyTo(null);
        setCommentText('');
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('just_now') || 'Just now';
        if (diffMins < 60) return `${diffMins}${language === 'zh' ? '分钟前' : 'm'}`;
        if (diffHours < 24) return `${diffHours}${language === 'zh' ? '小时前' : 'h'}`;
        if (diffDays < 7) return `${diffDays}${language === 'zh' ? '天前' : 'd'}`;
        return date.toLocaleDateString();
    };

    if (!post) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-[var(--color-bg-white)] rounded-t-2xl w-full max-w-lg max-h-[70vh] flex flex-col animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <button onClick={onClose} className="text-[var(--color-text-muted)]">
                        <X size={24} />
                    </button>
                    <h3 className="font-medium text-[17px]">
                        {t('comments') || 'Comments'} ({post.comments.length})
                    </h3>
                    <div className="w-6" />
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {post.comments.length === 0 ? (
                        <div className="text-center py-8 text-[var(--color-text-muted)]">
                            {t('no_comments') || 'No comments yet'}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {post.comments.map((comment) => {
                                const commenter = getAuthor(comment.authorId);
                                const isOwn = comment.authorId === 'user-me';
                                const commenterName = isOwn
                                    ? getUserDisplayName(language)
                                    : getDisplayName(commenter, language);
                                const avatar = isOwn ? userProfile.avatar : commenter.avatar;

                                return (
                                    <div key={comment.id} className="flex gap-3">
                                        {/* Avatar */}
                                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-primary)]">
                                            {avatar ? (
                                                <img src={avatar} alt={commenterName} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                                                    {commenterName.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium text-[14px] text-[var(--color-primary)]">
                                                        {commenterName}
                                                    </span>
                                                    {comment.replyTo && (
                                                        <>
                                                            <span className="text-[12px] text-[var(--color-text-muted)]">
                                                                {language === 'zh' ? '回复' : 'replied'}
                                                            </span>
                                                            <span className="font-medium text-[14px] text-[var(--color-primary)]">
                                                                {comment.replyTo.authorName}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[12px] text-[var(--color-text-muted)]">
                                                        {formatTime(comment.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-[14px] text-[var(--color-text-main)] mt-1">
                                                {comment.content}
                                            </p>

                                            {/* Comment Actions */}
                                            <div className="flex items-center gap-3 mt-1">
                                                <button
                                                    onClick={() => handleReply(comment)}
                                                    className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                                                >
                                                    <Reply size={12} />
                                                    {t('reply') || 'Reply'}
                                                </button>
                                                {isOwn && (
                                                    <button
                                                        onClick={() => deleteComment(post.id, comment.id)}
                                                        className="text-[var(--color-text-muted)] hover:text-red-500"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Reply Indicator */}
                {replyTo && (
                    <div className="px-4 py-2 bg-[var(--color-bg-app)] border-t border-[var(--color-border)] flex items-center justify-between">
                        <span className="text-[13px] text-[var(--color-text-muted)]">
                            {language === 'zh' ? '回复' : 'Replying to'}{' '}
                            <span className="font-medium text-[var(--color-primary)]">{replyTo.authorName}</span>
                        </span>
                        <button onClick={cancelReply} className="text-[var(--color-text-muted)]">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Comment Input */}
                <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--color-border)] flex gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-primary)]">
                        {userProfile.avatar ? (
                            <img src={userProfile.avatar} alt="You" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                                {getUserDisplayName(language).charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={
                            replyTo
                                ? (language === 'zh' ? `回复 ${replyTo.authorName}...` : `Reply to ${replyTo.authorName}...`)
                                : (t('add_comment') || 'Add a comment...')
                        }
                        className="flex-1 px-3 py-2 bg-[var(--color-bg-app)] rounded-full text-[14px] outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!commentText.trim()}
                        className={cn(
                            "p-2 rounded-full transition-colors",
                            commentText.trim()
                                ? "bg-[var(--color-primary)] text-white"
                                : "bg-[var(--color-bg-app)] text-[var(--color-text-light)]"
                        )}
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
