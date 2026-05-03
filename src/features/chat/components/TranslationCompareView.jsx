/**
 * T15: TranslationCompareView
 * Side-by-side source / translated text panel for Muse agent.
 * Rendered when a message contains a [TRANSLATION:source||target||lang_from||lang_to] marker.
 */
import React, { useState } from 'react';
import { Copy, Check, ArrowRight, Languages } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

const LANG_LABELS = {
    en: 'EN', zh: 'ZH', ja: 'JA', ko: 'KO', fr: 'FR', de: 'DE', es: 'ES',
};

function CopyButton({ text, t }) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (e) { console.warn('[TranslationCompare] Clipboard write failed:', e?.message); }
    };
    return (
        <button
            onClick={handle}
            className="p-1 rounded-[var(--radius-sm)] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--color-text-muted)] transition-colors"
            aria-label={t('copy')}
        >
            {copied ? <Check size={12} className="text-[var(--color-success)]" /> : <Copy size={12} />}
        </button>
    );
}

export default function TranslationCompareView({ source, target, from = 'auto', to = 'en' }) {
    const { t } = useLanguage();

    return (
        <div className="mt-2 rounded-[var(--radius-xl)] border border-[var(--color-primary)]/20 overflow-hidden bg-[var(--color-bg-white)] shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-primary-softer)] border-b border-[var(--color-border-light)]">
                <Languages size={13} className="text-[var(--color-primary)] shrink-0" />
                <span className="text-[11px] font-semibold text-[var(--color-primary-active)] uppercase tracking-wide">
                    {t('translation_compare')}
                </span>
                <div className="flex items-center gap-1 ml-auto">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">
                        {LANG_LABELS[from] || from.toUpperCase()}
                    </span>
                    <ArrowRight size={10} className="text-[var(--color-text-muted)]" />
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-primary)]/15 text-[var(--color-primary-active)]">
                        {LANG_LABELS[to] || to.toUpperCase()}
                    </span>
                </div>
            </div>

            {/* Content grid */}
            <div className="grid grid-cols-2 divide-x divide-[var(--color-border-light)]">
                {/* Source */}
                <div className="p-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                            {t('translation_source')}
                        </span>
                        <CopyButton text={source} t={t} />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                        {source}
                    </p>
                </div>

                {/* Target */}
                <div className="p-3 bg-[var(--color-primary-softer)]">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold text-[var(--color-primary-active)] uppercase tracking-wide">
                            {t('translation_result')}
                        </span>
                        <CopyButton text={target} t={t} />
                    </div>
                    <p className="text-xs text-[var(--color-text-main)] leading-relaxed whitespace-pre-wrap font-medium">
                        {target}
                    </p>
                </div>
            </div>
        </div>
    );
}
