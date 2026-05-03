import React from 'react';
import { X, Bookmark, MessageSquare, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { getBookmarks, removeBookmark } from '../services/BookmarkService';
import { formatTimeSeparator } from '../../../utils/formatTime';

export default function BookmarkPanel({ isOpen, onClose, onNavigateToMessage, personas }) {
    const { t, language } = useLanguage();
    const [bookmarks, setBookmarks] = React.useState([]);

    const handleBookmarkKeyDown = (event, bookmark) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleNavigate(bookmark);
    };

    // Load bookmarks when panel opens
    React.useEffect(() => {
        if (isOpen) {
            setBookmarks(getBookmarks());
        }
    }, [isOpen]);

    const handleRemove = (e, messageId) => {
        e.stopPropagation();
        removeBookmark(messageId);
        setBookmarks(getBookmarks());
    };

    const handleNavigate = (bookmark) => {
        onNavigateToMessage?.(bookmark.chatId, bookmark.messageId);
        onClose?.();
    };

    const getSenderName = (senderId) => {
        if (senderId === 'user-me') return t('you');
        const sender = personas?.find(p => p.id === senderId);
        return language === 'zh' ? (sender?.name_zh || sender?.name) : sender?.name;
    };

    // Truncate content for preview
    const truncateContent = (content, maxLength = 80) => {
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <button
                type="button"
                className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-label={t('close') || 'Close'}
            />

            {/* Panel */}
            <div className="relative w-full max-w-md h-full bg-[var(--color-bg-white)] shadow-2xl animate-slide-in-right flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                            <Bookmark className="text-[var(--color-primary)]" size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-[var(--color-text-main)]">
                                {t('bookmarks_title') || 'Bookmarks'}
                            </h2>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {bookmarks.length} {bookmarks.length === 1 ? (t('bookmark_count') || 'bookmark') : (t('bookmarks_count') || 'bookmarks')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors"
                    >
                        <X size={20} className="text-[var(--color-text-muted)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {bookmarks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="w-20 h-20 rounded-full bg-[var(--color-bg-active)] flex items-center justify-center mb-4">
                                <Bookmark size={32} className="text-[var(--color-text-muted)]" />
                            </div>
                            <p className="text-[var(--color-text-muted)] font-medium mb-1">
                                {t('no_bookmarks') || 'No bookmarks yet'}
                            </p>
                            <p className="text-sm text-[var(--color-text-muted)]/70">
                                {t('bookmarks_hint') || 'Long press a message to bookmark it'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {bookmarks.map((bookmark) => (
                                <div
                                    key={bookmark.messageId}
                                    onClick={() => handleNavigate(bookmark)}
                                    onKeyDown={(event) => handleBookmarkKeyDown(event, bookmark)}
                                    role="button"
                                    tabIndex={0}
                                    className="group p-4 bg-[var(--color-bg-app)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:shadow-md transition-all cursor-pointer"
                                >
                                    {/* Chat name and time */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-[var(--color-primary)] flex items-center gap-1">
                                            <MessageSquare size={12} />
                                            {bookmark.chatName}
                                        </span>
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                            {formatTimeSeparator(bookmark.bookmarkedAt, language)}
                                        </span>
                                    </div>

                                    {/* Sender */}
                                    <p className="text-xs text-[var(--color-text-muted)] mb-1">
                                        {getSenderName(bookmark.senderId)}
                                    </p>

                                    {/* Content preview */}
                                    <p className="text-sm text-[var(--color-text-main)] line-clamp-2">
                                        {truncateContent(bookmark.content)}
                                    </p>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border-light)]">
                                        <span className="text-xs text-[var(--color-primary)] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                            {t('view_message') || 'View Message'}
                                            <ArrowRight size={12} />
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => handleRemove(e, bookmark.messageId)}
                                            className="text-xs text-[var(--color-text-muted)] hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
                                        >
                                            {t('remove') || 'Remove'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
