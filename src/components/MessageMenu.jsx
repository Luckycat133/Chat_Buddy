import React, { useEffect, useRef } from 'react';
import { Copy, Forward, Quote, Trash2, RotateCcw, Pin } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

export default function MessageMenu({
    message,
    isOwnMessage,
    isPinned,
    position,
    onClose,
    onCopy,
    onQuote,
    onDelete,
    onForward,
    onPin
}) {
    const { t, language } = useLanguage();
    const menuRef = useRef(null);

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

    // Check if message can be recalled (within 2 minutes)
    const canRecall = isOwnMessage && message?.timestamp &&
        (Date.now() - new Date(message.timestamp).getTime()) < 2 * 60 * 1000;

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

    const menuItems = [
        { icon: Copy, label: t('copy'), action: handleCopy, show: true },
        { icon: Quote, label: t('quote'), action: handleQuote, show: true },
        { icon: Forward, label: t('forward'), action: handleForward, show: true },
        { icon: Pin, label: isPinned ? (language === 'zh' ? '取消置顶' : 'Unpin') : (language === 'zh' ? '置顶' : 'Pin'), action: handlePin, show: true },
        { icon: Trash2, label: canRecall ? t('recall') : t('delete'), action: handleDelete, show: isOwnMessage, danger: true }
    ].filter(item => item.show);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[120px] animate-scale-in"
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
                                : "text-gray-700 hover:bg-gray-50"
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
