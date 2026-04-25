import React, { useState } from 'react';
import { X, Megaphone, Pin } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

export default function GroupAnnouncement({ announcement, isAdmin, onClose, onSave, onDelete }) {
    const { t, language } = useLanguage();
    const [isEditing, setIsEditing] = useState(!announcement);
    const [content, setContent] = useState(announcement?.content || '');

    const handleSave = () => {
        if (!content.trim()) return;
        onSave?.({
            content: content.trim(),
            updatedAt: new Date().toISOString(),
            updatedBy: 'user-me'
        });
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (confirm(t('announcement_confirm_delete'))) {
            onDelete?.();
            onClose?.();
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-[var(--color-bg-white)] rounded-xl w-full max-w-md overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]">
                    <div className="flex items-center gap-2 text-white">
                        <Megaphone size={20} />
                        <h3 className="font-medium text-[17px]">
                            {t('group_announcement')}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {isEditing ? (
                        <>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={t('announcement_placeholder')}
                                maxLength={500}
                                rows={6}
                                className="w-full px-4 py-3 bg-[var(--color-bg-app)] rounded-lg text-[15px] outline-none focus:ring-2 ring-[var(--color-primary)]/30 resize-none"
                                autoFocus
                            />
                            <p className="text-xs text-[var(--color-text-muted)] text-right mt-1">
                                {content.length}/500
                            </p>

                            {/* Actions */}
                            <div className="flex gap-2 mt-4">
                                {announcement && (
                                    <button
                                        onClick={() => {
                                            setContent(announcement.content);
                                            setIsEditing(false);
                                        }}
                                        className="flex-1 py-2.5 border border-[var(--color-border)] rounded-lg font-medium text-[var(--color-text-main)]"
                                    >
                                        {t('cancel')}
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={!content.trim()}
                                    className={cn(
                                        "flex-1 py-2.5 rounded-lg font-medium transition-all",
                                        content.trim()
                                            ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                                            : "bg-gray-200 text-gray-400"
                                    )}
                                >
                                    {t('announcement_publish')}
                                </button>
                            </div>
                        </>
                    ) : announcement ? (
                        <>
                            {/* Display announcement */}
                            <div className="flex items-start gap-3 mb-4">
                                <Pin size={20} className="text-[var(--color-primary)] flex-shrink-0 mt-1" />
                                <div className="flex-1">
                                    <p className="text-[15px] text-[var(--color-text-main)] whitespace-pre-wrap">
                                        {announcement.content}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                                        {t('announcement_updated_at')} {formatDate(announcement.updatedAt)}
                                    </p>
                                </div>
                            </div>

                            {/* Admin actions */}
                            {isAdmin && (
                                <div className="flex gap-2 pt-4 border-t border-[var(--color-border)]">
                                    <button
                                        onClick={handleDelete}
                                        className="flex-1 py-2.5 border border-red-200 text-red-500 rounded-lg font-medium hover:bg-red-50 transition-colors"
                                    >
                                        {t('delete')}
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex-1 py-2.5 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-lg font-medium"
                                    >
                                        {t('btn_edit')}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8 text-[var(--color-text-muted)]">
                            <Megaphone size={48} className="mx-auto mb-4 opacity-50" />
                            <p>{t('announcement_empty')}</p>
                            {isAdmin && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="mt-4 px-6 py-2 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-full font-medium"
                                >
                                    {t('announcement_create_btn')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
