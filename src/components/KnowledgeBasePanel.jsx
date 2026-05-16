/**
 * T14: Knowledge Base Management Panel
 * Allows users to view, delete, and manage uploaded documents for RAG.
 */
import React, { useState, useRef } from 'react';
import { X, Database, Trash2, Upload, ToggleLeft, ToggleRight, FileText, FileCode, File, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useDocuments } from '../context/DocumentContext';
import { cn } from '../utils/cn';

const FILE_ICONS = {
    'text': FileText,
    'code': FileCode,
};

function getFileIcon(type = '') {
    if (type.includes('text') || type.includes('txt') || type.includes('md')) return FileText;
    if (type.includes('code') || type.includes('js') || type.includes('py')) return FileCode;
    return File;
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso, language) {
    const d = new Date(iso);
    return language === 'zh'
        ? d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function DocumentCard({ doc, chunksForDoc, language, t, onDelete }) {
    const [showPreview, setShowPreview] = useState(false);
    const chunkCount = chunksForDoc.length;

    return (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-white)] overflow-hidden transition-all">
            <div className="flex items-start gap-3 p-3.5">
                <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-bg-hover)] flex items-center justify-center shrink-0 mt-0.5">
                    {React.createElement(getFileIcon(doc.type || ''), { size: 18, className: "text-[var(--color-primary)]" })}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--color-text-main)] truncate">{doc.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {formatBytes(doc.size)} · {chunkCount} {t('kb_chunks')} · {formatDate(doc.addedAt, language)}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={() => setShowPreview(v => !v)}
                        className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
                        aria-label={t('preview')}
                    >
                        {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                        onClick={() => onDelete(doc.id)}
                        className="p-1.5 rounded-[var(--radius-sm)] hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                        aria-label={t('delete')}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            {showPreview && (
                <div className="px-3.5 pb-3 pt-0 border-t border-[var(--color-border-light)]">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono whitespace-pre-wrap line-clamp-6 mt-2 leading-relaxed">
                        {doc.content?.slice(0, 400)}{doc.content?.length > 400 ? '…' : ''}
                    </p>
                </div>
            )}
        </div>
    );
}

export default function KnowledgeBasePanel({ onClose }) {
    const { t, language } = useLanguage();
    const { documents, ragEnabled, indexedChunks, addDocument, removeDocument, toggleRAG } = useDocuments();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [confirmClear, setConfirmClear] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        try {
            const content = await file.text();
            addDocument({
                name: file.name,
                size: file.size,
                type: file.type || 'text/plain',
                icon: '📄',
                content
            });
        } catch {
            setUploadError(t('kb_upload_failed'));
        }
        setUploading(false);
        e.target.value = '';
    };

    const handleClearAll = () => {
        if (confirmClear) {
            documents.forEach(doc => removeDocument(doc.id));
            setConfirmClear(false);
        } else {
            setConfirmClear(true);
            setTimeout(() => setConfirmClear(false), 3000);
        }
    };

    // Group chunks by documentId for count lookup
    const chunksByDoc = {};
    for (const chunk of indexedChunks) {
        if (!chunksByDoc[chunk.documentId]) chunksByDoc[chunk.documentId] = [];
        chunksByDoc[chunk.documentId].push(chunk);
    }

    const totalChunks = indexedChunks.length;
    const totalSize = documents.reduce((s, d) => s + (d.size || 0), 0);

    return (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-lg glass-crystal rounded-[var(--radius-2xl)] shadow-floating flex flex-col max-h-[85vh] overflow-hidden animate-scale-spring">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[var(--radius-lg)] bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                            <Database size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-display font-bold text-[var(--color-text-main)]">{t('kb_title')}</h2>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {documents.length} {t('kb_docs')} · {totalChunks} {t('kb_chunks')} · {formatBytes(totalSize)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
                        aria-label={t('close')}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* RAG Toggle */}
                <div className="flex items-center justify-between px-5 py-3 bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
                    <div>
                        <p className="text-sm font-semibold text-[var(--color-text-main)]">{t('kb_rag_enabled')}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{t('kb_rag_desc')}</p>
                    </div>
                    <button
                        onClick={toggleRAG}
                        className={cn(
                            'transition-colors',
                            ragEnabled ? 'text-emerald-500' : 'text-[var(--color-text-muted)]'
                        )}
                        aria-label={t('kb_toggle_rag')}
                    >
                        {ragEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                </div>

                {/* Document List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-3">
                    {documents.length === 0 ? (
                        <div className="text-center py-10">
                            <Database size={40} className="mx-auto text-[var(--color-text-muted)] opacity-40 mb-3" />
                            <p className="text-sm text-[var(--color-text-muted)]">{t('kb_empty')}</p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('kb_empty_hint')}</p>
                        </div>
                    ) : (
                        documents.map(doc => (
                            <DocumentCard
                                key={doc.id}
                                doc={doc}
                                chunksForDoc={chunksByDoc[doc.id] || []}
                                language={language}
                                t={t}
                                onDelete={removeDocument}
                            />
                        ))
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center gap-3 px-5 pt-3 pb-5 border-t border-[var(--color-border)]">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.json,.csv,.js,.py,.ts,.jsx,.tsx,.html,.css,.yaml,.yml"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-xl)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-coral)] text-white font-semibold text-sm shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        <Upload size={15} />
                        {uploading ? t('kb_uploading') : t('kb_upload')}
                    </button>
                    {documents.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            className={cn(
                                'px-4 py-2.5 rounded-[var(--radius-xl)] font-semibold text-sm transition-all border',
                                confirmClear
                                    ? 'bg-red-500 text-white border-red-500'
                                    : 'text-[var(--color-danger)] border-[var(--color-danger)]/30 hover:bg-red-50 dark:hover:bg-red-900/20'
                            )}
                        >
                            {confirmClear ? t('kb_confirm_clear') : t('kb_clear_all')}
                        </button>
                    )}
                </div>
                {uploadError && (
                    <p className="px-5 pb-3 text-xs text-[var(--color-danger)]">{uploadError}</p>
                )}
            </div>
        </div>
    );
}
