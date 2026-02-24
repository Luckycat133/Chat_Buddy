/**
 * T13: ToolResultCard
 * Renders a tool_event message as a collapsible iOS 26 Liquid Glass card.
 * States: loading → success | error
 */
import React, { useState } from 'react';
import { cn } from '../../../utils/cn';
import {
    Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp,
    Code2, Search, Globe, Calculator, Brain, Database,
    Languages, FileSearch, Cpu, ArrowRightLeft,
} from 'lucide-react';

const TOOL_META = {
    run_code:             { icon: Code2,       labelEn: 'Code Execution',   labelZh: '代码执行' },
    search_docs:          { icon: Database,    labelEn: 'Doc Search',       labelZh: '文档搜索' },
    analyze_code:         { icon: FileSearch,  labelEn: 'Code Analysis',    labelZh: '代码分析' },
    web_search:           { icon: Globe,       labelEn: 'Web Search',       labelZh: '网络搜索' },
    sonar_search:         { icon: Search,      labelEn: 'Sonar Search',     labelZh: 'Sonar 搜索' },
    deep_research:        { icon: Brain,       labelEn: 'Deep Research',    labelZh: '深度研究' },
    fact_check:           { icon: CheckCircle, labelEn: 'Fact Check',       labelZh: '事实核查' },
    cite_sources:         { icon: FileSearch,  labelEn: 'Citations',        labelZh: '引用生成' },
    immersive_translate:  { icon: Languages,   labelEn: 'Translation',      labelZh: '沉浸式翻译' },
    detect_content_domain:{ icon: FileSearch,  labelEn: 'Domain Detection', labelZh: '领域检测' },
    execute_math:         { icon: Calculator,  labelEn: 'Math',             labelZh: '数学计算' },
    check_prerequisites:  { icon: Brain,       labelEn: 'Prerequisites',    labelZh: '前置检查' },
    generate_quiz:        { icon: Brain,       labelEn: 'Quiz',             labelZh: '生成测验' },
    track_progress:       { icon: Brain,       labelEn: 'Progress',         labelZh: '进度追踪' },
    delegate_task:        { icon: ArrowRightLeft, labelEn: 'Delegating',    labelZh: '任务委派' },
    MEMORY_REQUEST:       { icon: Brain,       labelEn: 'Memory Request',   labelZh: '记忆请求' },
};

export default function ToolResultCard({ msg, language }) {
    const [expanded, setExpanded] = useState(false);

    const { toolName, status, inputSummary, outputDetail } = msg;
    const meta = TOOL_META[toolName] || { icon: Cpu, labelEn: toolName, labelZh: toolName };
    const Icon = meta.icon;
    const label = language === 'zh' ? meta.labelZh : meta.labelEn;

    const isLoading = status === 'loading';
    const isError = status === 'error';

    return (
        <div className="flex justify-start mb-3 px-2">
            <div className={cn(
                'max-w-[80%] min-w-[200px] rounded-2xl overflow-hidden',
                'glass border transition-all duration-300',
                isLoading
                    ? 'border-[var(--color-border)] opacity-80'
                    : isError
                        ? 'border-red-400/30'
                        : 'border-[var(--color-primary)]/20',
            )}>
                {/* Header row */}
                <button
                    className={cn(
                        'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left',
                        'hover:bg-white/5 transition-colors',
                        outputDetail ? 'cursor-pointer' : 'cursor-default',
                    )}
                    onClick={() => outputDetail && setExpanded(e => !e)}
                    disabled={!outputDetail}
                >
                    {/* Status icon */}
                    {isLoading ? (
                        <Loader2 size={15} className="shrink-0 text-[var(--color-primary)] animate-spin" />
                    ) : isError ? (
                        <XCircle size={15} className="shrink-0 text-red-400" />
                    ) : (
                        <CheckCircle size={15} className="shrink-0 text-emerald-400" />
                    )}

                    {/* Tool icon + label */}
                    <Icon size={13} className="shrink-0 text-[var(--color-text-muted)]" />
                    <span className={cn(
                        'text-xs font-semibold tracking-wide uppercase',
                        isError ? 'text-red-400' : 'text-[var(--color-text-secondary)]',
                    )}>
                        {label}
                    </span>

                    {/* Input summary — ellipsized */}
                    {inputSummary && (
                        <span className="flex-1 text-[11px] text-[var(--color-text-muted)] truncate ml-1">
                            {inputSummary}
                        </span>
                    )}

                    {/* Expand toggle */}
                    {outputDetail && (
                        <span className="shrink-0 text-[var(--color-text-muted)]">
                            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </span>
                    )}
                </button>

                {/* Expanded output */}
                {expanded && outputDetail && (
                    <div className="px-3.5 pb-3 pt-0.5 border-t border-[var(--color-border-light)]">
                        <pre className={cn(
                            'text-[11px] leading-relaxed whitespace-pre-wrap break-words font-mono',
                            'max-h-48 overflow-y-auto custom-scrollbar',
                            isError ? 'text-red-400' : 'text-[var(--color-text-secondary)]',
                        )}>
                            {outputDetail}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
