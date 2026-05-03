/**
 * T15: LearningReportPanel
 * Visualizes Sensei learning progress — topics studied, quiz scores, progress bars.
 * Reading from localStorage key 'chat-buddy-sensei-progress'.
 */
import React, { useMemo } from 'react';
import { X, GraduationCap, Download, TrendingUp, CheckCircle, Circle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { LOCALES } from '../data/locales';
import { cn } from '../utils/cn';

const PROGRESS_KEY = 'chat-buddy-sensei-progress';

function loadProgress() {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        return raw ? JSON.parse(raw) : { topics: [], quizzes: [], sessions: 0, totalMessages: 0 };
    } catch (e) { console.warn('[LearningReport] Failed to load progress:', e?.message); return { topics: [], quizzes: [], sessions: 0, totalMessages: 0 }; }
}

function ProgressBar({ value, max, color = 'var(--color-primary)' }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div className="h-1.5 rounded-full bg-[var(--color-bg-hover)] overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: color }}
            />
        </div>
    );
}

function StatCard({ icon, label, value, color }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-white)]">
            <div className={cn('w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center', color)}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
                <p className="text-lg font-display font-bold text-[var(--color-text-main)]">{value}</p>
            </div>
        </div>
    );
}

function exportReport(progress, language) {
    const l = LOCALES[language] || LOCALES.en;
    const lines = [
        l.learning_export_title,
        `${new Date().toLocaleDateString()}`,
        '',
        `${l.learning_export_sessions}: ${progress.sessions}`,
        `${l.learning_export_messages}: ${progress.totalMessages}`,
        `${l.learning_export_topics_count}: ${progress.topics.length}`,
        '',
        `${l.learning_export_topics_studied}:`,
        ...progress.topics.map(t => `  \u2022 ${t.name} (${l.learning_export_mastery}: ${t.mastery || 0}%)`),
        '',
        `${l.learning_export_quiz_records}:`,
        ...progress.quizzes.map(q => `  \u2022 ${q.topic}: ${q.score}/${q.total} (${q.date})`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensei-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function LearningReportPanel({ onClose }) {
    const { t, language } = useLanguage();
    const progress = useMemo(() => loadProgress(), []);

    const avgQuizScore = useMemo(() => {
        if (progress.quizzes.length === 0) return 0;
        const pcts = progress.quizzes.map(q => q.total > 0 ? (q.score / q.total) * 100 : 0);
        return Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length);
    }, [progress.quizzes]);

    const isEmpty = progress.topics.length === 0 && progress.quizzes.length === 0 && progress.sessions === 0;

    return (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md glass-crystal rounded-[var(--radius-2xl)] shadow-floating flex flex-col max-h-[85vh] overflow-hidden animate-scale-spring">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[var(--radius-lg)] bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                            <GraduationCap size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-display font-bold text-[var(--color-text-main)]">{t('learning_report_title')}</h2>
                            <p className="text-xs text-[var(--color-text-muted)]">{t('learning_report_desc')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isEmpty && (
                            <button
                                onClick={() => exportReport(progress, language)}
                                className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
                                title={t('export')}
                            >
                                <Download size={16} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
                    {isEmpty ? (
                        <div className="text-center py-12">
                            <GraduationCap size={48} className="mx-auto text-[var(--color-text-muted)] opacity-30 mb-3" />
                            <p className="text-sm text-[var(--color-text-muted)]">{t('learning_no_data')}</p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('learning_no_data_hint')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2">
                                <StatCard
                                    icon={<TrendingUp size={16} className="text-white" />}
                                    label={t('learning_sessions')}
                                    value={progress.sessions}
                                    color="bg-gradient-to-br from-blue-400 to-indigo-500"
                                />
                                <StatCard
                                    icon={<CheckCircle size={16} className="text-white" />}
                                    label={t('learning_avg_score')}
                                    value={`${avgQuizScore}%`}
                                    color="bg-gradient-to-br from-emerald-400 to-teal-500"
                                />
                            </div>

                            {/* Topics Progress */}
                            {progress.topics.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-[var(--color-text-main)] mb-2">
                                        {t('learning_topics')} ({progress.topics.length})
                                    </p>
                                    <div className="space-y-2.5">
                                        {progress.topics.map((topic, i) => (
                                            <div key={i} className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-[var(--color-text-secondary)]">{topic.name}</span>
                                                    <span className="text-[10px] text-[var(--color-text-muted)]">{topic.mastery || 0}%</span>
                                                </div>
                                                <ProgressBar value={topic.mastery || 0} max={100} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Quiz History */}
                            {progress.quizzes.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-[var(--color-text-main)] mb-2">
                                        {t('learning_quizzes')} ({progress.quizzes.length})
                                    </p>
                                    <div className="space-y-2">
                                        {progress.quizzes.map((quiz, i) => {
                                            const pct = quiz.total > 0 ? Math.round((quiz.score / quiz.total) * 100) : 0;
                                            const isGood = pct >= 70;
                                            return (
                                                <div key={i} className="flex items-center gap-3 p-2.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-white)]">
                                                    <div className={cn(
                                                        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white',
                                                        isGood ? 'bg-emerald-500' : 'bg-amber-500'
                                                    )}>
                                                        {pct}%
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-[var(--color-text-main)] truncate">{quiz.topic}</p>
                                                        <p className="text-[10px] text-[var(--color-text-muted)]">
                                                            {quiz.score}/{quiz.total} · {quiz.date}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
