import React, { useState } from 'react';
import { MapPin, Heart, MessageCircle, MoreHorizontal, Trash2, Share2, SmilePlus } from 'lucide-react';
import { useMoments } from '../context/MomentsContext';
import { useFriend } from '../../../context/FriendContext';
import { useUser } from '../../../context/UserContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

const REACTION_EMOJIS = ['😂', '❤️', '👍', '🔥', '😮', '😢'];

export default function MomentCard({ post, onCommentClick }) {
    const { toggleLike, deletePost, getAuthor, addReaction } = useMoments();
    const { getDisplayName } = useFriend();
    const { userProfile, getDisplayName: getUserDisplayName } = useUser();
    const { t, language } = useLanguage();

    const [showMenu, setShowMenu] = useState(false);
    const [showReactions, setShowReactions] = useState(false);

    const author = getAuthor(post.authorId);
    const isOwn = post.authorId === 'user-me';
    const hasLiked = post.likes.includes('user-me');
    const likeCount = post.likes.length;
    const commentCount = post.comments.length;
    const reactions = post.reactions || {};

    // Get display name
    const getAuthorName = () => {
        if (isOwn) {
            return getUserDisplayName(language);
        }
        return getDisplayName(author, language);
    };

    // Get avatar
    const getAvatar = () => {
        if (isOwn) {
            return userProfile.avatar;
        }
        return author.avatar;
    };

    // Format relative time
    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('just_now') || 'Just now';
        if (diffMins < 60) return `${diffMins} ${language === 'zh' ? '分钟前' : 'min ago'}`;
        if (diffHours < 24) return `${diffHours} ${language === 'zh' ? '小时前' : 'h ago'}`;
        if (diffDays < 7) return `${diffDays} ${language === 'zh' ? '天前' : 'd ago'}`;
        return date.toLocaleDateString();
    };

    // Get liker names
    const getLikerNames = () => {
        if (likeCount === 0) return null;
        const names = post.likes.slice(0, 5).map(id => {
            if (id === 'user-me') return getUserDisplayName(language);
            const liker = getAuthor(id);
            return getDisplayName(liker, language);
        });
        if (likeCount > 5) {
            return names.join(', ') + ` +${likeCount - 5}`;
        }
        return names.join(', ');
    };

    // Get visible reactions
    const getReactionSummary = () => {
        const entries = Object.entries(reactions).filter(([_, users]) => users.length > 0);
        return entries.slice(0, 4); // Show max 4 different emoji types
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Chat Buddy Moment',
                text: post.content,
            });
        } else {
            navigator.clipboard.writeText(post.content);
            alert(language === 'zh' ? '已复制到剪贴板' : 'Copied to clipboard!');
        }
    };

    const handleReaction = (emoji) => {
        addReaction(post.id, emoji, 'user-me');
        setShowReactions(false);
    };

    // Format comment with reply info
    const formatComment = (comment) => {
        const commenter = getAuthor(comment.authorId);
        const commenterName = comment.authorId === 'user-me'
            ? getUserDisplayName(language)
            : getDisplayName(commenter, language);

        if (comment.replyTo) {
            return (
                <span>
                    <span className="font-medium text-[var(--color-primary)]">{commenterName}</span>
                    <span className="text-[var(--color-text-muted)]"> {t('reply_to') || 'replied'} </span>
                    <span className="font-medium text-[var(--color-primary)]">{comment.replyTo.authorName}</span>
                    <span className="text-[var(--color-text-main)]">: {comment.content}</span>
                </span>
            );
        }

        return (
            <span>
                <span className="font-medium text-[var(--color-primary)]">{commenterName}:</span>
                <span className="text-[var(--color-text-main)] ml-1">{comment.content}</span>
            </span>
        );
    };

    return (
        <div className="bg-white border-b border-[var(--color-border-light)] px-4 py-4">
            {/* Header */}
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-[4px] overflow-hidden flex-shrink-0 bg-[var(--color-primary)]">
                    {getAvatar() ? (
                        <img src={getAvatar()} alt={getAuthorName()} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold">
                            {getAuthorName().charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Name and Menu */}
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--color-primary)] text-[15px]">
                            {getAuthorName()}
                        </span>
                        {isOwn && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowMenu(!showMenu)}
                                    className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                                >
                                    <MoreHorizontal size={18} />
                                </button>
                                {showMenu && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                        <div className="absolute right-0 top-6 bg-white rounded-lg shadow-lg border border-[var(--color-border)] z-20 overflow-hidden">
                                            <button
                                                onClick={() => {
                                                    deletePost(post.id);
                                                    setShowMenu(false);
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 whitespace-nowrap"
                                            >
                                                <Trash2 size={16} />
                                                {t('delete_post') || 'Delete'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Post Content */}
                    <p className="text-[var(--color-text-main)] text-[15px] mt-1 whitespace-pre-wrap">
                        {post.content}
                    </p>

                    {/* Images Grid */}
                    {post.images && post.images.length > 0 && (
                        <div className={cn(
                            "grid gap-1 mt-2",
                            post.images.length === 1 && "grid-cols-1 max-w-[200px]",
                            post.images.length === 2 && "grid-cols-2 max-w-[280px]",
                            post.images.length >= 3 && "grid-cols-3 max-w-[280px]"
                        )}>
                            {post.images.slice(0, 9).map((img, index) => (
                                <div
                                    key={index}
                                    className="aspect-square rounded overflow-hidden bg-[var(--color-bg-app)]"
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Location */}
                    {post.location && (
                        <div className="flex items-center gap-1 mt-2 text-[var(--color-text-muted)] text-[12px]">
                            <MapPin size={12} />
                            <span>{post.location}</span>
                        </div>
                    )}

                    {/* Time and Actions */}
                    <div className="flex items-center justify-between mt-3">
                        <span className="text-[var(--color-text-muted)] text-[12px]">
                            {formatTime(post.createdAt)}
                        </span>

                        <div className="flex items-center gap-4">
                            {/* Reaction Picker */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowReactions(!showReactions)}
                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                                >
                                    <SmilePlus size={16} />
                                </button>
                                {showReactions && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowReactions(false)} />
                                        <div className="absolute bottom-6 right-0 bg-white rounded-full shadow-lg border border-[var(--color-border)] z-20 flex gap-1 p-1">
                                            {REACTION_EMOJIS.map(emoji => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => handleReaction(emoji)}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-bg-app)] rounded-full text-[18px] transition-transform hover:scale-125"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Share */}
                            <button
                                onClick={handleShare}
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                            >
                                <Share2 size={16} />
                            </button>

                            {/* Comment */}
                            <button
                                onClick={() => onCommentClick(post)}
                                className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                            >
                                <MessageCircle size={16} />
                                {commentCount > 0 && <span className="text-[12px]">{commentCount}</span>}
                            </button>

                            {/* Like */}
                            <button
                                onClick={() => toggleLike(post.id)}
                                className={cn(
                                    "flex items-center gap-1 transition-colors",
                                    hasLiked ? "text-red-500" : "text-[var(--color-text-muted)] hover:text-red-500"
                                )}
                            >
                                <Heart size={16} className={hasLiked ? "fill-current" : ""} />
                                {likeCount > 0 && <span className="text-[12px]">{likeCount}</span>}
                            </button>
                        </div>
                    </div>

                    {/* Reactions Display */}
                    {getReactionSummary().length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {getReactionSummary().map(([emoji, users]) => (
                                <div
                                    key={emoji}
                                    className="flex items-center bg-[var(--color-bg-app)] rounded-full px-2 py-0.5 text-[12px]"
                                >
                                    <span>{emoji}</span>
                                    <span className="ml-1 text-[var(--color-text-muted)]">{users.length}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Likes and Comments Section */}
                    {(likeCount > 0 || commentCount > 0) && (
                        <div className="mt-2 bg-[var(--color-bg-app)] rounded-lg overflow-hidden">
                            {/* Likes */}
                            {likeCount > 0 && (
                                <div className="px-2 py-1.5 flex items-start gap-1 border-b border-[var(--color-border-light)]">
                                    <Heart size={14} className="text-red-500 fill-red-500 flex-shrink-0 mt-0.5" />
                                    <span className="text-[13px] text-[var(--color-text-main)]">
                                        {getLikerNames()}
                                    </span>
                                </div>
                            )}

                            {/* Recent Comments */}
                            {commentCount > 0 && (
                                <div className="px-2 py-1.5">
                                    {post.comments.slice(-3).map((comment) => (
                                        <div key={comment.id} className="text-[13px] py-0.5">
                                            {formatComment(comment)}
                                        </div>
                                    ))}
                                    {commentCount > 3 && (
                                        <button
                                            onClick={() => onCommentClick(post)}
                                            className="text-[12px] text-[var(--color-primary)] mt-1"
                                        >
                                            {t('view_all_comments') || `View all ${commentCount} comments`}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
