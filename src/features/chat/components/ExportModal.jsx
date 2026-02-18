import React, { useState } from 'react';
import { X, FileText, Code, FileCode, Download } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { exportChat } from '../services/ExportService';
import { cn } from '../../../utils/cn';

/**
 * Export Modal Component
 * T07: Chat History Export
 *
 * Allows users to export chat history in various formats
 */
export default function ExportModal({ chat, personas, onClose }) {
    const { t, language } = useLanguage();
    const [selectedFormat, setSelectedFormat] = useState('txt');
    const [isExporting, setIsExporting] = useState(false);

    const formats = [
        {
            id: 'txt',
            label: t('export_txt') || 'Text (TXT)',
            description: t('export_txt_desc') || 'Simple text format with timestamps',
            icon: FileText,
            color: 'text-gray-600',
            bgColor: 'bg-gray-100'
        },
        {
            id: 'json',
            label: t('export_json') || 'JSON',
            description: t('export_json_desc') || 'Full structured data export',
            icon: Code,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
        },
        {
            id: 'html',
            label: t('export_html') || 'HTML',
            description: t('export_html_desc') || 'Styled webpage with chat bubbles',
            icon: FileCode,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
        }
    ];

    const handleExport = () => {
        if (!chat) return;

        setIsExporting(true);

        // Small delay to show loading state
        setTimeout(() => {
            try {
                exportChat(chat, personas, selectedFormat);
                setIsExporting(false);
                onClose();
            } catch (error) {
                console.error('Export failed:', error);
                setIsExporting(false);
                alert(t('export_failed') || 'Export failed. Please try again.');
            }
        }, 300);
    };

    if (!chat) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--color-bg-white)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-spring">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-main)]">
                            {t('export_chat') || 'Export Chat'}
                        </h2>
                        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                            {chat.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors"
                        aria-label={t('close') || 'Close'}
                    >
                        <X size={20} className="text-[var(--color-text-muted)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                        {t('export_format_label') || 'Select export format:'}
                    </p>

                    <div className="space-y-3">
                        {formats.map((format) => {
                            const Icon = format.icon;
                            const isSelected = selectedFormat === format.id;

                            return (
                                <button
                                    key={format.id}
                                    onClick={() => setSelectedFormat(format.id)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-4 rounded-[var(--radius-lg)] border-2 transition-all text-left",
                                        isSelected
                                            ? "border-[var(--color-primary)] bg-[var(--color-primary-softer)]"
                                            : "border-[var(--color-border-light)] hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-bg-hover)]"
                                    )}
                                >
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", format.bgColor)}>
                                        <Icon size={24} className={format.color} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-[var(--color-text-main)]">
                                                {format.label}
                                            </span>
                                            {isSelected && (
                                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[var(--color-primary)] text-white rounded-full">
                                                    {t('selected') || 'Selected'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                                            {format.description}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Info */}
                    <div className="mt-6 p-3 bg-[var(--color-bg-active)] rounded-[var(--radius-lg)]">
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {language === 'zh'
                                ? `共 ${chat.messages?.length || 0} 条消息将被导出`
                                : `${chat.messages?.length || 0} messages will be exported`
                            }
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-app)]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2 rounded-[var(--radius-lg)] font-medium text-white transition-all",
                            isExporting
                                ? "bg-[var(--color-primary)]/70 cursor-not-allowed"
                                : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-active)] hover:scale-105 active:scale-95"
                        )}
                    >
                        {isExporting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('exporting') || 'Exporting...'}
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                {t('export') || 'Export'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
