/* eslint-disable react-refresh/only-export-components */
/**
 * T15: CodeDiffView
 * Visual before/after code diff for Coder agent suggestions.
 * Rendered when message contains [DIFF:lang|before_code||after_code] marker.
 */
import React, { useState } from 'react';
import { Code2, Copy, Check, ArrowRight, Plus, Minus } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

/**
 * Parse [DIFF:lang|before||after] from message content.
 */
export function parseDiffMarker(content) {
    if (!content) return null;
    const match = content.match(/\[DIFF:([^|]*)\|([\s\S]*?)\|\|([\s\S]*?)\]/);
    if (!match) return null;
    return {
        lang: match[1]?.trim() || 'text',
        before: match[2]?.trim() || '',
        after: match[3]?.trim() || '',
        rest: content.replace(match[0], '').trim()
    };
}

function computeLineDiff(before, after) {
    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');
    // Simple LCS-based line diff
    const result = [];

    let i = 0, j = 0;
    while (i < beforeLines.length || j < afterLines.length) {
        if (i >= beforeLines.length) {
            result.push({ type: 'add', line: afterLines[j++] });
        } else if (j >= afterLines.length) {
            result.push({ type: 'remove', line: beforeLines[i++] });
        } else if (beforeLines[i] === afterLines[j]) {
            result.push({ type: 'same', line: beforeLines[i] });
            i++; j++;
        } else {
            // Check if the before line appears later in after (skip removed)
            const nextSameInAfter = afterLines.indexOf(beforeLines[i], j);
            const nextSameInBefore = beforeLines.indexOf(afterLines[j], i);

            if (nextSameInAfter === -1 || (nextSameInBefore !== -1 && nextSameInBefore < nextSameInAfter)) {
                result.push({ type: 'remove', line: beforeLines[i++] });
            } else {
                result.push({ type: 'add', line: afterLines[j++] });
            }
        }
    }
    return result;
}

function CopyButton({ text, t }) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
    };
    return (
        <button
            onClick={handle}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            aria-label={t('copy')}
        >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
    );
}

export default function CodeDiffView({ before, after, lang = 'text' }) {
    const { t } = useLanguage();
    const [mode, setMode] = useState('unified'); // 'unified' | 'split'
    const diffLines = computeLineDiff(before, after);

    const addedCount = diffLines.filter(l => l.type === 'add').length;
    const removedCount = diffLines.filter(l => l.type === 'remove').length;

    return (
        <div className="mt-2 rounded-[var(--radius-xl)] overflow-hidden border border-[var(--color-border)] shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e2e] text-white">
                <Code2 size={13} className="text-emerald-400 shrink-0" />
                <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">
                    {t('code_diff')} · {lang}
                </span>
                <div className="flex items-center gap-1.5 ml-1">
                    {addedCount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-400">+{addedCount}</span>
                    )}
                    {removedCount > 0 && (
                        <span className="text-[10px] font-bold text-red-400">-{removedCount}</span>
                    )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {/* Mode toggle */}
                    <div className="flex rounded overflow-hidden border border-white/20 text-[10px]">
                        {['unified', 'split'].map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn(
                                    'px-2 py-0.5 transition-colors',
                                    mode === m ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/70'
                                )}
                            >
                                {m === 'unified' ? t('diff_unified') : t('diff_split')}
                            </button>
                        ))}
                    </div>
                    <CopyButton text={after} t={t} />
                </div>
            </div>

            {mode === 'unified' ? (
                /* Unified diff view */
                <div className="bg-[#1e1e2e] overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
                    {diffLines.map((line, i) => (
                        <div
                            key={i}
                            className={cn(
                                'flex text-[11px] font-mono',
                                line.type === 'add' && 'bg-emerald-900/30',
                                line.type === 'remove' && 'bg-red-900/30',
                            )}
                        >
                            <div className="w-6 shrink-0 flex items-center justify-center text-[10px]">
                                {line.type === 'add' && <Plus size={9} className="text-emerald-400" />}
                                {line.type === 'remove' && <Minus size={9} className="text-red-400" />}
                            </div>
                            <pre className={cn(
                                'flex-1 px-2 py-0.5 whitespace-pre leading-relaxed',
                                line.type === 'add' ? 'text-emerald-300' : line.type === 'remove' ? 'text-red-300' : 'text-gray-300'
                            )}>
                                {line.line}
                            </pre>
                        </div>
                    ))}
                </div>
            ) : (
                /* Split diff view */
                <div className="grid grid-cols-2 divide-x divide-white/10 bg-[#1e1e2e]">
                    {/* Before */}
                    <div className="overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
                        <div className="px-2 py-1 text-[10px] text-red-400 font-semibold border-b border-white/10">
                            {t('diff_before')}
                        </div>
                        <pre className="text-[11px] font-mono text-gray-300 p-2 leading-relaxed whitespace-pre">
                            {before}
                        </pre>
                    </div>
                    {/* After */}
                    <div className="overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between px-2 py-1 border-b border-white/10">
                            <span className="text-[10px] text-emerald-400 font-semibold">{t('diff_after')}</span>
                            <ArrowRight size={10} className="text-white/40" />
                        </div>
                        <pre className="text-[11px] font-mono text-emerald-300 p-2 leading-relaxed whitespace-pre">
                            {after}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
