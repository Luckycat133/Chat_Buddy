import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, File, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { validateFile, processFileForChat } from '../utils/fileUtils';
import { cn } from '../utils/cn';

export default function FileUploader({ onFileSelect, onClose }) {
    const { t } = useLanguage();
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const processFile = useCallback(async (file) => {
        setIsProcessing(true);
        try {
            const validation = validateFile(file);
            if (!validation.valid) {
                setError(t(validation.errors[0]));
                setIsProcessing(false);
                return;
            }

            const fileData = await processFileForChat(file);
            onFileSelect?.(fileData);
            onClose?.();
        } catch (err) {
            setError(t(err.message) || t('error'));
        } finally {
            setIsProcessing(false);
        }
    }, [t, onFileSelect, onClose]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        setIsDragging(false);
        setError(null);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            await processFile(files[0]);
        }
    }, [processFile]);

    const handleFileSelect = useCallback(async (e) => {
        setError(null);
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            await processFile(files[0]);
        }
    }, [processFile]);

    return (
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-[var(--color-bg-white)] rounded-lg shadow-xl border border-[var(--color-border)] overflow-hidden z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border-light)]">
                <span className="font-medium text-sm text-[var(--color-text-main)]">{t('upload_file')}</span>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-[var(--color-bg-hover)] rounded text-[var(--color-text-muted)]"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Drop zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                    "m-3 p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer text-center",
                    isDragging
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-light)]"
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".txt,.md,.json,.js,.ts,.py,.html,.css,.xml,.csv,.yaml,.yml"
                />

                {isProcessing ? (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-[var(--color-text-muted)]">{t('uploading')}</p>
                    </div>
                ) : (
                    <>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-muted)]" />
                        <p className="text-sm text-[var(--color-text-main)] mb-1">{t('drag_drop_file')}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{t('or_click_to_upload')}</p>
                    </>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="mx-3 mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {/* Supported formats */}
            <div className="px-3 pb-3">
                <p className="text-xs text-[var(--color-text-muted)] text-center">
                    {t('supported_formats')}
                </p>
            </div>
        </div>
    );
}
