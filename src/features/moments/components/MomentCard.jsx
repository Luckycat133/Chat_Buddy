import React, { useState, useCallback } from 'react';
import {
    Heart, MapPin, MessageCircle, MoreHorizontal,
    Repeat2, SmilePlus, Sparkles, Trash2, ChevronDown,
    Zap, Send,
} from 'lucide-react';
import { useMoments } from '../context/MomentsContext';
import { useFriend } from '../../../context/FriendContext';
import { useUser } from '../../../context/UserContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';
import MomentMediaGrid from './MomentMediaGrid';
import RepostSheet from './RepostSheet';

const REACTION_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '😢', '🎉', '💯'];

// 点赞爱心动画组件
function LikeAnimation({ active }) {
    return (
        <span className={cn(
            'inline-flex items-center justify-center transition-all duration-200',
            active ? 'scale-125' : 'scale-100'
        )}>
            <Heart
                size={17}
                className={cn(
                    'transition-all duration-300',
                    active ? 'fill-red-500 text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]' : ''
                )}
            />
        </span>
    );
}

// AI反馈卡 - 可折叠
function AIFeedbackCard({ feedback, language, onApplyComment, onCommentClick }) {
    const [expanded, setExpanded] = useState(false);

    if (!feedback) return null;

    return (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(255,157,74,0.20)] bg-gradient-to-br from-[rgba(255,157,74,0.07)] to-[rgba(255,200,130,0.05)]">
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
                        <Sparkles size={12} className="text-[var(--color-primary)]" />
                    </div>
                    <span className="text-[13px] font-semibold text-[var(--color-text-main)]">
                        {language === 'zh'
                            ? `${feedback.authorName} 给你留了一条反馈`
                            : `${feedback.authorName} left you feedback`}
                    </span>
                </div>
                <ChevronDown
                    size={15}
                    className={cn('text-[var(--color-text-muted)] transition-transform duration-200', expanded && 'rotate-180')}
                />
            </button>

            {expanded && (
                <div className="border-t border-[rgba(255,157,74,0.12)] px-4 pb-4 pt-3">
                    <p className="text-[13px] leading-6 text-[var(--color-text-main)]">
                        {feedback.summary}
                    </p>
                    {feedback.nextMove && (
                        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-5 text-[var(--color-text-muted)]">
                            <Sparkles size={12} className="mt-0.5 flex-shrink-0 text-[var(--color-primary)]" />
                            <span>{feedback.nextMove}</span>
                        </p>
                    )}
                    {feedback.suggestedComment && (
                        <div className="mt-3 flex items-start gap-3 rounded-xl bg-[var(--color-bg-app)] px-3 py-2.5">
                            <span className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">"</span>
                            <p className="flex-1 text-[13px] leading-6 text-[var(--color-text-main)] italic">
                                {feedback.suggestedComment}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    onApplyComment?.(feedback.suggestedComment);
                                    onCommentClick?.();
                                }}
                                className="flex-shrink-0 rounded-full bg-[var(--color-primary)] px-3 py-1 text-[11px] font-semibold text-white transition-transform hover:scale-105"
                            >
                                {language === 'zh' ? '发出去' : 'Post'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function MomentCard({ post, onCommentClick, onHashtagClick }) {
    const { toggleLike, deletePost, getAuthor, addReaction, addComment, buildCommentSuggestions } = useMoments();
    const { getDisplayName } = useFriend();
    const { userProfile, getDisplayName: getUserDisplayName } = useUser();
    const { t, language } = useLanguage();

    const [showMenu, setShowMenu] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const [showRepostSheet, setShowRepostSheet] = useState(false);
    const [likeAnimating, setLikeAnimating] = useState(false);
    const [pendingComment, setPendingComment] = useState('');
    const [showQuickComment, setShowQuickComment] = useState(false);
    const [isPostingComment, setIsPostingComment] = useState(false);

    const author = getAuthor(post.authorId);
    const isOwn = post.authorId === 'user-me';
    const hasLiked = (post.likes || []).includes('user-me');
    const likeCount = (post.likes || []).length;
    const commentCount = (post.comments || []).length;
    const shareCount = post.shareCount || 0;
    const reactions = post.reactions || {};
    const commentSuggestions = buildCommentSuggestions(post, language);

    const getAuthorName = useCallback(() => {
        if (isOwn) return getUserDisplayName(language);
        return getDisplayName(author, language);
    }, [isOwn, author, language, getUserDisplayName, getDisplayName]);

    const getAvatar = useCallback(() => {
        if (isOwn) return userProfile?.avatar;
        return author?.avatar;
    }, [isOwn, userProfile, author]);

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

    const handleLike = () => {
        setLikeAnimating(true);
        toggleLike(post.id);
        setTimeout(() => setLikeAnimating(false), 400);
    };

    const getLikerNames = () => {
        if (likeCount === 0) return null;
        const names = (post.likes || []).slice(0, 4).map(id => {
            if (id === 'user-me') return getUserDisplayName(language);
            const liker = getAuthor(id);
            return getDisplayName(liker, language);
        });
        const separator = language === 'zh' ? '、' : ', ';
        return likeCount > 4
            ? `${names.join(separator)} ${language === 'zh' ? `等${likeCount}人` : `+${likeCount - 4} more`}`
            : names.join(separator);
    };

    const getReactionSummary = () => {
        return Object.entries(reactions)
            .filter(([, users]) => users.length > 0)
            .sort(([, a], [, b]) => b.length - a.length)
            .slice(0, 5);
    };

    const renderContent = (text) => {
        if (!text) return null;
        return text.split(/(#[\w\u3400-\u9fff-]+)/g).map((part, index) =>
            part.startsWith('#') ? (
                <button
                    key={`${part}-${index}`}
                    type="button"
                    className="font-medium text-[var(--color-primary)] transition-colors hover:underline"
                    aria-label={part}
                    onClick={() => onHashtagClick?.(part)}
                >
                    {part}
                </button>
            ) : (
                <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
            )
        );
    };

    const formatComment = (comment) => {
        const commenter = getAuthor(comment.authorId);
        const commenterName = comment.authorId === 'user-me'
            ? getUserDisplayName(language)
            : getDisplayName(commenter, language);

        if (comment.replyTo) {
            return (
                <span>
                    <span className="font-medium text-[var(--color-primary)]">{commenterName}</span>
                    <span className="text-[var(--color-text-muted)]"> {t('reply_to') || '回复'} </span>
                    <span className="font-medium text-[var(--color-primary)]">{comment.replyTo.authorName}</span>
                    <span className="text-[var(--color-text-main)]">: {comment.content}</span>
                </span>
            );
        }
        return (
            <span>
                <span className="font-medium text-[var(--color-primary)]">{commenterName}:</span>
                <span className="ml-1 text-[var(--color-text-main)]">{comment.content}</span>
            </span>
        );
    };

    const handleQuickComment = async (text = pendingComment) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setIsPostingComment(true);
        addComment(post.id, trimmed, 'user-me', null);
        setPendingComment('');
        setShowQuickComment(false);
        setIsPostingComment(false);
    };

    const handleApplyFeedbackComment = (text) => {
        setPendingComment(text);
        setShowQuickComment(true);
    };

    const reactionSummary = getReactionSummary();

    return (
        <>
            <article className="overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-bg-white)] shadow-[0_8px_32px_rgba(255,157,74,0.07)] transition-shadow hover:shadow-[0_12px_40px_rgba(255,157,74,0.12)]">
                {/* 头部：头像 + 名称 + 时间 + 菜单 */}
                <div className="flex items-start gap-3 px-5 pt-5">
                    <div className="relative h-11 w-11 flex-shrink-0">
                        <div className="h-11 w-11 overflow-hidden rounded-[14px] bg-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/10">
                            {getAvatar() ? (
                                <img src={getAvatar()} alt={getAuthorName()} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center font-bold text-white">
                                    {getAuthorName().charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        {!isOwn && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="truncate text-[15px] font-semibold text-[var(--color-text-main)]">
                                    {getAuthorName()}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
                                    {post.location && (
                                        <>
                                            <MapPin size={11} />
                                            <span className="truncate max-w-[120px]">{post.location}</span>
                                            <span>·</span>
                                        </>
                                    )}
                                    <span>{formatTime(post.createdAt)}</span>
                                </div>
                            </div>

                            {isOwn && (
                                <div className="relative flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowMenu(v => !v)}
                                        aria-label={language === 'zh' ? '动态操作' : 'Post actions'}
                                        className="rounded-full p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-app)] hover:text-[var(--color-text-main)]"
                                    >
                                        <MoreHorizontal size={17} />
                                    </button>
                                    {showMenu && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                            <div className="absolute right-0 top-9 z-20 min-w-[120px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-white)] shadow-xl">
                                                <button
                                                    type="button"
                                                    onClick={() => { deletePost(post.id); setShowMenu(false); }}
                                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-red-500 transition-colors hover:bg-red-50"
                                                >
                                                    <Trash2 size={14} />
                                                    {t('delete_post') || '删除'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 正文 */}
                <div className="px-5 pb-1 pt-3">
                    {post.storyTitle && (
                        <h3 className="mb-2 text-[17px] font-bold leading-snug text-[var(--color-text-main)]">
                            {post.storyTitle}
                        </h3>
                    )}

                    {post.content && (
                        <div className="whitespace-pre-wrap text-[15px] leading-7 text-[var(--color-text-main)]">
                            {renderContent(post.content)}
                        </div>
                    )}

                    {/* 转发引用 */}
                    {post.repostOf && (
                        <div className="mt-3 overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-app)] p-4">
                            <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-primary)]">
                                <Repeat2 size={12} />
                                {post.repostOf.authorName}
                            </div>
                            {post.repostOf.storyTitle && (
                                <div className="mt-1.5 text-[14px] font-semibold text-[var(--color-text-main)]">
                                    {post.repostOf.storyTitle}
                                </div>
                            )}
                            <div className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[13px] leading-6 text-[var(--color-text-muted)]">
                                {post.repostOf.content}
                            </div>
                        </div>
                    )}

                    {/* 图片网格 */}
                    <MomentMediaGrid post={post.repostOf ? {
                        ...post.repostOf,
                        location: post.repostOf.location || post.location,
                    } : post} />

                    {/* AI反馈卡 */}
                    <AIFeedbackCard
                        feedback={post.aiFeedback}
                        language={language}
                        onApplyComment={handleApplyFeedbackComment}
                        onCommentClick={() => onCommentClick(post)}
                    />
                </div>

                {/* 互动区 */}
                <div className="px-5 pb-5 pt-3">
                    {/* 点赞者名单 + 评论预览 */}
                    {(likeCount > 0 || commentCount > 0 || reactionSummary.length > 0) && (
                        <div className="mb-3 overflow-hidden rounded-[16px] bg-[var(--color-bg-app)]">
                            {/* 表情汇总 */}
                            {reactionSummary.length > 0 && (
                                <div className="flex items-center gap-1 border-b border-[var(--color-border-light)] px-3 py-2">
                                    {reactionSummary.map(([emoji, users]) => (
                                        <div
                                            key={emoji}
                                            className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-bg-white)] px-2 py-0.5 text-[12px] shadow-sm border border-[var(--color-border)]"
                                        >
                                            <span>{emoji}</span>
                                            <span className="text-[var(--color-text-muted)]">{users.length}</span>
                                        </div>
                                    ))}
                                    {likeCount > 0 && (
                                        <span className="ml-auto text-[12px] text-[var(--color-text-muted)]">
                                            {likeCount} {language === 'zh' ? '个赞' : 'likes'}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* 点赞名单 */}
                            {likeCount > 0 && reactionSummary.length === 0 && (
                                <div className={cn(
                                    'flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--color-text-main)]',
                                    commentCount > 0 && 'border-b border-[var(--color-border-light)]'
                                )}>
                                    <Heart size={13} className="flex-shrink-0 fill-red-500 text-red-500" />
                                    <span className="line-clamp-1">{getLikerNames()}</span>
                                </div>
                            )}

                            {/* 评论预览 */}
                            {commentCount > 0 && (
                                <div className="px-3 py-2">
                                    {(post.comments || []).slice(-3).map(comment => (
                                        <div key={comment.id} className="py-0.5 text-[13px] leading-6">
                                            {formatComment(comment)}
                                        </div>
                                    ))}
                                    {commentCount > 3 && (
                                        <button
                                            type="button"
                                            onClick={() => onCommentClick(post)}
                                            className="mt-1 text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                                        >
                                            {language === 'zh' ? `查看全部 ${commentCount} 条评论` : `View all ${commentCount} comments`}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 快速评论区 */}
                    {showQuickComment && (
                        <div className="mb-3 flex items-center gap-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-white)] p-2 shadow-sm">
                            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-[var(--color-primary)]">
                                {userProfile?.avatar ? (
                                    <img src={userProfile.avatar} alt="me" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white">
                                        {getUserDisplayName(language).charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <input
                                autoFocus
                                type="text"
                                value={pendingComment}
                                onChange={e => setPendingComment(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickComment(); } }}
                                placeholder={language === 'zh' ? '写条评论...' : 'Write a comment...'}
                                className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--color-text-light)]"
                            />
                            <button
                                type="button"
                                onClick={() => handleQuickComment()}
                                disabled={!pendingComment.trim() || isPostingComment}
                                className={cn(
                                    'flex-shrink-0 rounded-full p-1.5 transition-colors',
                                    pendingComment.trim()
                                        ? 'bg-[var(--color-primary)] text-white'
                                        : 'bg-[var(--color-bg-app)] text-[var(--color-text-light)]'
                                )}
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    )}

                    {/* AI快捷评论建议 */}
                    {showQuickComment && commentSuggestions.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                            {commentSuggestions.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleQuickComment(s)}
                                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-white)] px-3 py-1 text-[12px] text-[var(--color-text-main)] transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 操作按钮栏 */}
                    <div className="flex items-center gap-0.5 border-t border-[var(--color-border-light)] pt-3">
                        {/* 点赞 */}
                        <button
                            type="button"
                            onClick={handleLike}
                            aria-label={hasLiked ? (language === 'zh' ? '取消点赞' : 'Unlike') : (language === 'zh' ? '点赞' : 'Like')}
                            className={cn(
                                'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium transition-all hover:bg-[var(--color-bg-app)]',
                                hasLiked ? 'text-red-500' : 'text-[var(--color-text-muted)]'
                            )}
                        >
                            <LikeAnimation active={hasLiked || likeAnimating} />
                            <span>{language === 'zh' ? '点赞' : 'Like'}</span>
                            {likeCount > 0 && <span className="text-[12px] opacity-70">{likeCount}</span>}
                        </button>

                        {/* 评论 */}
                        <button
                            type="button"
                            onClick={() => {
                                setShowQuickComment(v => !v);
                                if (!showQuickComment) setTimeout(() => {}, 50);
                            }}
                            aria-label={language === 'zh' ? '评论' : 'Comment'}
                            className={cn(
                                'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-bg-app)]',
                                showQuickComment && 'text-[var(--color-primary)]'
                            )}
                        >
                            <MessageCircle size={17} />
                            <span>{language === 'zh' ? '评论' : 'Comment'}</span>
                            {commentCount > 0 && <span className="text-[12px] opacity-70">{commentCount}</span>}
                        </button>

                        {/* 表情 */}
                        <div className="relative flex-1">
                            <button
                                type="button"
                                onClick={() => setShowReactions(v => !v)}
                                aria-label={language === 'zh' ? '表情反应' : 'React'}
                                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-bg-app)]"
                            >
                                <SmilePlus size={17} />
                                <span>{language === 'zh' ? '表情' : 'React'}</span>
                            </button>
                            {showReactions && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowReactions(false)} />
                                    <div className="absolute bottom-12 left-1/2 z-20 -translate-x-1/2 flex gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-white)] p-1.5 shadow-2xl">
                                        {REACTION_EMOJIS.map(emoji => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => { addReaction(post.id, emoji, 'user-me'); setShowReactions(false); }}
                                                aria-label={emoji}
                                                className="flex h-9 w-9 items-center justify-center rounded-full text-[20px] transition-all hover:scale-125 hover:bg-[var(--color-bg-app)]"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 转发 */}
                        <button
                            type="button"
                            onClick={() => setShowRepostSheet(true)}
                            aria-label={language === 'zh' ? '转发' : 'Share'}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-bg-app)]"
                        >
                            <Repeat2 size={17} />
                            <span>{language === 'zh' ? '转发' : 'Share'}</span>
                            {shareCount > 0 && <span className="text-[12px] opacity-70">{shareCount}</span>}
                        </button>

                        {/* AI互动 */}
                        <button
                            type="button"
                            onClick={() => onCommentClick(post)}
                            aria-label={language === 'zh' ? '更多互动' : 'More'}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-bg-app)]"
                        >
                            <Zap size={16} />
                            <span>{language === 'zh' ? '更多' : 'More'}</span>
                        </button>
                    </div>
                </div>
            </article>

            {showRepostSheet && (
                <RepostSheet
                    post={post}
                    authorName={getAuthorName()}
                    onClose={() => setShowRepostSheet(false)}
                />
            )}
        </>
    );
}
