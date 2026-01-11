import React from 'react';
import { Download, File, Eye } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { formatFileSize, getFileTypeInfo } from '../../../utils/fileUtils';
import { cn } from '../../../utils/cn';

export default function FileMessage({ fileData, isOwn, onDownload, onPreview }) {
    const { t } = useLanguage();
    const typeInfo = getFileTypeInfo(fileData.name);

    return (
        <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg min-w-[200px] max-w-[280px]",
            isOwn ? "bg-[var(--color-primary)]/90" : "bg-white shadow-sm"
        )}>
            {/* File icon */}
            <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0",
                isOwn ? "bg-white/20" : "bg-gray-100"
            )}>
                {typeInfo.icon}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    "text-sm font-medium truncate",
                    isOwn ? "text-white" : "text-gray-800"
                )}>
                    {fileData.name}
                </p>
                <p className={cn(
                    "text-xs",
                    isOwn ? "text-white/70" : "text-gray-500"
                )}>
                    {formatFileSize(fileData.size)}
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-1 flex-shrink-0">
                {onPreview && (
                    <button
                        onClick={() => onPreview(fileData)}
                        className={cn(
                            "p-1.5 rounded transition-colors",
                            isOwn ? "hover:bg-white/20 text-white" : "hover:bg-gray-100 text-gray-600"
                        )}
                        title={t('preview')}
                    >
                        <Eye size={16} />
                    </button>
                )}
                <button
                    onClick={() => onDownload?.(fileData)}
                    className={cn(
                        "p-1.5 rounded transition-colors",
                        isOwn ? "hover:bg-white/20 text-white" : "hover:bg-gray-100 text-gray-600"
                    )}
                    title={t('download')}
                >
                    <Download size={16} />
                </button>
            </div>
        </div>
    );
}

/**
 * Component for displaying AI-generated files
 */
export function GeneratedFileMessage({ fileData, onDownload }) {
    const { t } = useLanguage();

    return (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 max-w-[300px]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{fileData.icon}</span>
                <span className="text-xs font-medium text-purple-600 uppercase">
                    {t('generated_file')}
                </span>
            </div>

            {/* File name */}
            <p className="text-sm font-medium text-gray-800 mb-1 truncate">
                {fileData.filename}
            </p>

            {/* Size */}
            <p className="text-xs text-gray-500 mb-3">
                {formatFileSize(fileData.size)}
            </p>

            {/* Preview snippet */}
            {fileData.content && (
                <pre className="text-xs bg-white/80 rounded p-2 mb-3 max-h-24 overflow-auto text-gray-600 font-mono">
                    {fileData.content.slice(0, 200)}
                    {fileData.content.length > 200 && '...'}
                </pre>
            )}

            {/* Download button */}
            <button
                onClick={() => onDownload?.(fileData)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
                <Download size={16} />
                {t('download_file')}
            </button>
        </div>
    );
}
