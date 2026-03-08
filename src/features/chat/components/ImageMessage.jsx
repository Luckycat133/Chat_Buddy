import React, { useState } from 'react';
import { X, ZoomIn, Download } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

/**
 * Image Message Component - T07: Image Messages
 * Displays inline image messages with click-to-expand lightbox
 */
export default function ImageMessage({ url, alt = '', isMe, onClick }) {
    const { t } = useLanguage();
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        return (
            <div className={cn(
                "p-4 rounded-xl bg-[var(--color-bg-active)] text-center min-w-[200px]",
                isMe ? "text-white/80" : "text-[var(--color-text-muted)]"
            )}>
                <p className="text-sm">{t('image_load_failed')}</p>
            </div>
        );
    }

    return (
        <div
            className="relative group cursor-pointer overflow-hidden rounded-xl max-w-[280px] md:max-w-[320px]"
            onClick={onClick}
        >
            {!isLoaded && (
                <div className="absolute inset-0 bg-[var(--color-bg-active)] animate-pulse flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
            )}
            <img
                src={url}
                alt={alt}
                className={cn(
                    "max-w-full h-auto rounded-xl transition-all duration-300",
                    isLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setIsLoaded(true)}
                onError={() => setHasError(true)}
            />
            {isLoaded && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                        <ZoomIn size={20} className="text-gray-700" />
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Image Lightbox Component
 * Full-screen image viewer with download option
 */
export function ImageLightbox({ url, alt = '', isOpen, onClose }) {
    const { t } = useLanguage();
    const [scale, setScale] = useState(1);

    if (!isOpen) return null;

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `image-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center animate-fade-in"
            onClick={onClose}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all z-10"
            >
                <X size={28} />
            </button>

            {/* Toolbar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
                <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
                >
                    <Download size={18} />
                    <span className="text-sm">{t('download')}</span>
                </button>
            </div>

            {/* Image */}
            <img
                src={url}
                alt={alt}
                className="max-w-[95vw] max-h-[90vh] object-contain cursor-zoom-in transition-transform duration-200"
                style={{ transform: `scale(${scale})` }}
                onClick={(e) => {
                    e.stopPropagation();
                    setScale(s => s === 1 ? 2 : 1);
                }}
            />

            {/* Hint */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
                {t('image_zoom_hint')}
            </div>
        </div>
    );
}
