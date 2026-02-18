import React, { useMemo } from 'react';
import { Link2, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

/**
 * T08: Link Preview Card (Option A - Simple MVP)
 * Shows basic link preview with favicon and domain
 * No metadata fetching due to CORS limitations
 */
export default function LinkPreview({ url }) {
    const { t } = useLanguage();

    // Compute domain and favicon synchronously to avoid setState in effect
    const { domain, favicon } = useMemo(() => {
        try {
            const urlObj = new URL(url);
            const extractedDomain = urlObj.hostname.replace(/^www\./, '');
            return {
                domain: extractedDomain,
                favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
            };
        } catch {
            return { domain: url, favicon: '' };
        }
    }, [url]);

    const handleClick = (e) => {
        e.preventDefault();
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div
            className="absolute z-50 mt-2 w-72 bg-[var(--color-bg-white)] rounded-lg shadow-lg border border-[var(--color-border)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
            style={{ left: 0, top: '100%' }}
        >
            {/* Header with favicon and domain */}
            <div className="flex items-center gap-3 p-3 border-b border-[var(--color-border-light)] bg-[var(--color-bg-active)]">
                {favicon ? (
                    <img
                        src={favicon}
                        alt=""
                        className="w-5 h-5 rounded"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div
                    className="w-5 h-5 rounded bg-[var(--color-primary)]/10 items-center justify-center hidden"
                    data-favicon-fallback
                >
                    <Link2 size={12} className="text-[var(--color-primary)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-main)] truncate">
                    {domain}
                </span>
            </div>

            {/* URL preview */}
            <div className="p-3">
                <p className="text-xs text-[var(--color-text-muted)] truncate mb-2">
                    {url}
                </p>
                <button
                    onClick={handleClick}
                    className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                    <ExternalLink size={12} />
                    {t('open_link')}
                </button>
            </div>
        </div>
    );
}
