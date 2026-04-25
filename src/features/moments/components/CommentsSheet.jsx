import React, { useEffect, useRef, useState } from 'react';
import { Reply, Send, Trash2, X, Sparkles, Bot } from 'lucide-react';
import { useMoments } from '../context/MomentsContext';
import { useFriend } from '../../../context/FriendContext';
import { useUser } from '../../../context/UserContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

// AI 正在思考的动画
function AITypingIndicator({ language }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
                <Bot size={14} className="text-[var(--color-primary)]" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl bg-[var(--color-bg-app)] px-3 py-2">
                <span className="text-[12px] text-[var(--color-text-muted)]">
                    {language === 'zh' ? 'AI 正在回复…' : 'AI is replying…'}
                </span>
                <div className="ml-1 flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-primary)] [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-primary)] [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-primary)] [animation-delay:300ms]" />
                </div>
            </div>
        </div>
    );
}

export default function CommentsSheet({ post, onClose }) {
    const {
        addComment,
        deleteComment,
        getAuthor,
        posts,
        generateAIComment,
        buildCommentSuggestions: getCommentSuggestions,
    } = useMoments();
    const { getDisplayName } = useFriend();
    const { userProfile, getDisplayName: getUserDisplayName } = useUser();
    const { t, language } = useLanguage();

    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [isAIReplying, setIsAIReplying] = useState(false);
    const inputRef = useRef(null);
    const listBottomRef = useRef(null);

    const activePost = posts.find(item => item.id === post?.id) || post;
    const suggestions = getCommentSuggestions(activePost, language);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (replyTo) inputRef.current?.focus();
    }, [replyTo]);

    // 新评论时自动滚到底部
    useEffect(() => {
        listBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activePost?.comments?.length]);

    if (!activePost) return null;

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('just_now') || '刚刚';
        if (diffMins < 60) return t('time_min_ago', { n: diffMins }) || `${diffMins}分钟前`;
        if (diffHours < 24) return t('time_hour_ago', { n: diffHours }) || `${diffHours}小时前`;
        if (diffDays < 7) return t('time_day_ago', { n: diffDays }) || `${diffDays}天前`;
        return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
    };

    const handleSubmit = async (event) => {
        event?.preventDefault();
        const text = commentText.trim();
        if (!text) return;

        const authorName = getUserDisplayName(language);
        const newComment = addComment(activePost.id, text, 'user-me', replyTo);
        const syntheticReplyTarget = {
            commentId: newComment.id,
            authorId: 'user-me',
            authorName,
            content: newComment.content,
        };

        setCommentText('');
        setReplyTo(null);

        // AI 自动回复（针对非自己的帖子）
        if (activePost.authorId !== 'user-me') {
            setIsAIReplying(true);
            const postsSnapshot = posts.map(item => {
                if (item.id !== activePost.id) return item;
                return { ...item, comments: [...(item.comments || []), newComment] };
            });
            setTimeout(async () => {
                await generateAIComment(activePost.id, activePost.authorId, syntheticReplyTarget, postsSnapshot);
                setIsAIReplying(false);
            }, 1000 + Math.random() * 1500);
        }
    };

    const handleSuggestionClick = (text) => {
        setCommentText(text);
        inputRef.current?.focus();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
            {/* 背景蒙层 */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="comments-sheet-title"
                className="relative flex max-h-[82vh] w-full max-w-2xl flex-col rounded-t-[28px] bg-[var(--color-bg-white)] shadow-2xl animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                {/* 拖拽指示条 */}
                <div className="flex justify-center pt-3">
                    <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
                </div>

                {/* 标题栏 */}
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('close') || '关闭'}
                        className="rounded-full p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-app)]"
                    >
                        <X size={22} />
                    </button>
                    <h3 id="comments-sheet-title" className="text-[16px] font-bold text-[var(--color-text-main)]">
                        {t('comments') || '评论'} {(activePost.comments || []).length > 0 && `(${(activePost.comments || []).length})`}
                    </h3>
                    <div className="w-8" />
                </div>

                {/* 原帖摘要 */}
                {activePost.content && (
                    <div className="border-b border-[var(--color-border-light)] bg-[var(--color-bg-app)] px-4 py-2.5">
                        <p className="line-clamp-2 text-[13px] leading-5 text-[var(--color-text-muted)]">
                            {activePost.content}
                        </p>
                    </div>
                )}

                {/* AI 建议评论 */}
                {suggestions.length > 0 && (
                    <div className="border-b border-[var(--color-border-light)] px-4 py-3">
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                            <Sparkles size={11} className="text-[var(--color-primary)]" />
                            {language === 'zh' ? 'AI 评论建议' : 'Smart comment ideas'}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleSuggestionClick(s)}
                                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-[12px] text-[var(--color-text-main)] transition-all hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 评论列表 */}
                <div className="flex-1 overflow-y-auto p-4">
                    {(activePost.comments || []).length === 0 && !isAIReplying ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-app)]">
                                <Sparkles size={22} className="text-[var(--color-text-muted)]" />
                            </div>
                            <p className="mt-3 text-[14px] font-medium text-[var(--color-text-muted)]">
                                {language === 'zh' ? '还没有评论，来第一个说话呀。' : 'No comments yet. Be the first to say something!'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(activePost.comments || []).map(comment => {
                                const commenter = getAuthor(comment.authorId);
                                const isOwn = comment.authorId === 'user-me';
                                const commenterName = isOwn
                                    ? getUserDisplayName(language)
                                    : getDisplayName(commenter, language);
                                const avatar = isOwn ? userProfile?.avatar : commenter?.avatar;
                                const isAI = !isOwn && comment.authorId?.startsWith('ai-');

                                return (
                                    <div key={comment.id} className="flex gap-3">
                                        {/* 头像 */}
                                        <div className={cn(
                                            'h-8 w-8 flex-shrink-0 overflow-hidden rounded-full',
                                            isAI ? 'ring-2 ring-[var(--color-primary)]/30' : '',
                                            'bg-[var(--color-primary)]'
                                        )}>
                                            {avatar ? (
                                                <img src={avatar} alt={commenterName} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-white">
                                                    {commenterName.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className={cn(
                                                        'truncate text-[14px] font-semibold',
                                                        isAI ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'
                                                    )}>
                                                        {commenterName}
                                                    </span>
                                                    {isAI && (
                                                        <span className="flex-shrink-0 rounded-full bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                                                            AI
                                                        </span>
                                                    )}
                                                    {comment.replyTo && (
                                                        <>
                                                            <span className="text-[12px] text-[var(--color-text-muted)]">
                                                                {t('replied_verb') || '回复'}
                                                            </span>
                                                            <span className="truncate text-[13px] font-medium text-[var(--color-primary)]">
                                                                {comment.replyTo.authorName}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <span className="flex-shrink-0 text-[11px] text-[var(--color-text-muted)]">
                                                    {formatTime(comment.createdAt)}
                                                </span>
                                            </div>

                                            <p className="mt-0.5 text-[14px] leading-6 text-[var(--color-text-main)]">
                                                {comment.content}
                                            </p>

                                            <div className="mt-1.5 flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setReplyTo({
                                                        commentId: comment.id,
                                                        authorId: comment.authorId,
                                                        authorName: commenterName,
                                                    })}
                                                    className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
                                                >
                                                    <Reply size={12} />
                                                    {t('reply') || '回复'}
                                                </button>
                                                {isOwn && (
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteComment(activePost.id, comment.id)}
                                                        className="text-[12px] text-[var(--color-text-muted)] transition-colors hover:text-red-500"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* AI 打字动效 */}
                            {isAIReplying && <AITypingIndicator language={language} />}
                            <div ref={listBottomRef} />
                        </div>
                    )}
                </div>

                {/* 回复指示条 */}
                {replyTo && (
                    <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-bg-app)] px-4 py-2">
                        <span className="text-[13px] text-[var(--color-text-muted)]">
                            {t('replying_to') || '回复'}{' '}
                            <span className="font-semibold text-[var(--color-primary)]">{replyTo.authorName}</span>
                        </span>
                        <button type="button" onClick={() => setReplyTo(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                            <X size={15} />
                        </button>
                    </div>
                )}

                {/* 输入框 */}
                <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-[var(--color-border)] px-4 py-3">
                    <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-[var(--color-primary)]">
                        {userProfile?.avatar ? (
                            <img src={userProfile.avatar} alt="me" className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-white">
                                {getUserDisplayName(language).charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                        placeholder={
                            replyTo
                                ? `${t('replying_to') || '回复'} ${replyTo.authorName}…`
                                : (t('add_comment') || (language === 'zh' ? '写条评论…' : 'Add a comment…'))
                        }
                        className="flex-1 rounded-full bg-[var(--color-bg-app)] px-4 py-2 text-[14px] outline-none placeholder:text-[var(--color-text-light)] focus:ring-1 focus:ring-[var(--color-primary)]/30"
                    />
                    <button
                        type="submit"
                        disabled={!commentText.trim()}
                        aria-label="发送"
                        className={cn(
                            'flex-shrink-0 rounded-full p-2 transition-all',
                            commentText.trim()
                                ? 'bg-[var(--color-primary)] text-white hover:opacity-90 active:scale-95'
                                : 'bg-[var(--color-bg-app)] text-[var(--color-text-light)]'
                        )}
                    >
                        <Send size={17} />
                    </button>
                </form>
            </div>
        </div>
    );
}
