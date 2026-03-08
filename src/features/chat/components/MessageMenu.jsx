import React, { useEffect, useRef } from 'react';
import { Copy, Forward, Quote, Trash2, RotateCcw, Pin, Bookmark } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

export default function MessageMenu({
    message,
    isOwnMessage,
    isPinned,
    isBookmarked,
    position,
    onClose,
    onCopy,
    onQuote,
    onDelete,
    onForward,
    onPin,
    onBookmark,
    canRecall: canRecallProp
}) {
    const { t } = useLanguage();
    const menuRef = useRef(null);

    // canRecall is provided by the parent who captures Date.now() in an event handler
    const canRecall = isOwnMessage && (canRecallProp ?? false);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose?.();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        onCopy?.();
        onClose?.();
    };

    const handleQuote = () => {
        onQuote?.(message);
        onClose?.();
    };

    const handleDelete = () => {
        onDelete?.(message.id);
        onClose?.();
    };

    const handleForward = () => {
        onForward?.(message);
        onClose?.();
    };

    const handlePin = () => {
        onPin?.(message.id, !isPinned);
        onClose?.();
    };

    const handleBookmark = () => {
        onBookmark?.(message.id, !isBookmarked);
        onClose?.();
    };

    const menuItems = [
        { icon: Copy, label: t('copy'), action: handleCopy, show: true },
        { icon: Quote, label: t('quote'), action: handleQuote, show: true },
        { icon: Forward, label: t('forward'), action: handleForward, show: true },
        { icon: Pin, label: isPinned ? t('unpin_message') : t('pin_message'), action: handlePin, show: true },
        { icon: Bookmark, label: isBookmarked ? t('unbookmark_message') : t('bookmark_message'), action: handleBookmark, show: true },
        { icon: Trash2, label: canRecall ? t('recall') : t('delete'), action: handleDelete, show: isOwnMessage, danger: true }
    ].filter(item => item.show);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-[var(--color-bg-white)] rounded-lg shadow-xl border border-[var(--color-border)] py-1 min-w-[120px] animate-scale-in"
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -100%)'
            }}
        >
            {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                    <button
                        key={index}
                        onClick={item.action}
                        className={cn(
                            "w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors",
                            item.danger
                                ? "text-red-500 hover:bg-red-50"
                                : "text-[var(--color-text-main)] hover:bg-[var(--color-bg-hover)]"
                        )}
                    >
                        <Icon size={16} />
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
