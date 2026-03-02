/**
 * T15: ScholarResultCard
 * Visual citation card for Scholar agent search results.
 * Rendered when a message contains [CITATION:n|url|title|snippet|verdict] markers.
 */
import React, { useState } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, HelpCircle, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

const VERDICT_CONFIG = {
    verified: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', labelEn: 'Verified', labelZh: '已核实' },
    disputed: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', labelEn: 'Disputed', labelZh: '有争议' },
    unverifiable: { icon: HelpCircle, color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-bg-hover)]', labelEn: 'Unverifiable', labelZh: '无法核实' },
};

/**
 * Parse [CITATION:n|url|title|snippet|verdict] from message content.
 * Returns array of citation objects.
 */
export function parseCitationMarkers(content) {
    if (!content) return [];
    const regex = /\[CITATION:(\d+)\|([^|]*)\|([^|]*)\|([^|]*)\|?([^\]]*)\]/g;
    const results = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        results.push({
            n: match[1],
            url: match[2]?.trim(),
            title: match[3]?.trim(),
            snippet: match[4]?.trim(),
            verdict: match[5]?.trim() || null,
        });
    }
    return results;
}

function getDomain(url) {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function CitationCard({ citation, language }) {
    const [expanded, setExpanded] = useState(false);
    const verdictCfg = citation.verdict ? VERDICT_CONFIG[citation.verdict] : null;
    const VerdictIcon = verdictCfg?.icon;
    const domain = getDomain(citation.url || '');

    return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-white)] overflow-hidden">
            <div className="flex items-start gap-2.5 p-3">
                {/* Citation number */}
                <div className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-[var(--color-primary)]">{citation.n}</span>
                </div>

                <div className="flex-1 min-w-0">
                    {/* Title */}
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-[var(--color-text-main)] leading-tight line-clamp-2">
                            {citation.title || domain}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                            {verdictCfg && (
                                <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold', verdictCfg.bg, verdictCfg.color)}>
                                    <VerdictIcon size={9} />
                                    {language === 'zh' ? verdictCfg.labelZh : verdictCfg.labelEn}
                                </span>
                            )}
                            {citation.url && (
                                <a
                                    href={citation.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <ExternalLink size={11} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Domain */}
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{domain}</p>

                    {/* Snippet toggle */}
                    {citation.snippet && (
                        <>
                            <button
                                onClick={() => setExpanded(v => !v)}
                                className="flex items-center gap-1 text-[10px] text-[var(--color-primary)] mt-1 hover:underline"
                            >
                                {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                {expanded ? (language === 'zh' ? '收起' : 'Collapse') : (language === 'zh' ? '查看摘要' : 'Show snippet')}
                            </button>
                            {expanded && (
                                <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mt-1.5 border-l-2 border-[var(--color-primary)]/30 pl-2">
                                    {citation.snippet}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ScholarResultCard({ citations, language }) {
    const { t } = useLanguage();
    if (!citations || citations.length === 0) return null;

    return (
        <div className="mt-2 rounded-[var(--radius-xl)] border border-sky-200/60 dark:border-sky-700/40 overflow-hidden bg-[var(--color-bg-white)] shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border-b border-[var(--color-border-light)]">
                <BookOpen size={13} className="text-sky-500 shrink-0" />
                <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
                    {t('scholar_sources')} ({citations.length})
                </span>
            </div>

            <div className="p-3 space-y-2">
                {citations.map((c, i) => (
                    <CitationCard key={i} citation={c} language={language} />
                ))}
            </div>
        </div>
    );
}
