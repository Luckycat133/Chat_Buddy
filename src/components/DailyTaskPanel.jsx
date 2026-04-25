import React from 'react';
import { X, CheckCircle2, Circle, ChevronRight, Star } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

export default function DailyTaskPanel({ onClose }) {
    const { getDailyTasks, getDailyTaskProgress, points } = useSocial();
    const { t } = useLanguage();

    const tasks = getDailyTasks();
    const { completed, total, totalPoints } = getDailyTaskProgress();
    const allDone = completed === total;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full sm:max-w-md bg-[var(--color-bg-white)] rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)] shadow-floating overflow-hidden animate-fade-slide-up sm:animate-scale-spring">
                {/* Header */}
                <div className="relative px-6 pt-6 pb-4"
                    style={{ background: 'linear-gradient(135deg, var(--color-primary), #f97316)' }}>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
                        aria-label={t('cancel')}
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">📋</span>
                        <div>
                            <h2 className="text-xl font-display font-bold text-white">{t('daily_tasks')}</h2>
                            <p className="text-sm text-white/80">{t('daily_tasks_desc')}</p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="bg-white/20 rounded-full h-2 mt-2">
                        <div
                            className="bg-white rounded-full h-2 transition-all duration-500"
                            style={{ width: `${(completed / total) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-white/80">
                            {t('daily_tasks_progress', { done: completed, total })}
                        </span>
                        <span className="text-xs text-white font-bold flex items-center gap-1">
                            <Star size={12} fill="white" />
                            {points} pts total
                        </span>
                    </div>
                </div>

                {/* Task list */}
                <div className="px-4 py-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {tasks.map(task => (
                        <TaskRow key={task.id} task={task} t={t} />
                    ))}
                </div>

                {/* Footer message */}
                {allDone && (
                    <div className="px-4 pb-4">
                        <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-[var(--radius-lg)] p-3 text-center">
                            <p className="text-sm font-bold text-[var(--color-primary-active)]">{t('tasks_all_done')}</p>
                            <p className="text-xs text-[var(--color-primary)]/80 mt-0.5">{t('tasks_reset_tomorrow')}</p>
                        </div>
                    </div>
                )}
                {totalPoints > 0 && !allDone && (
                    <div className="px-4 pb-4 text-center text-xs text-[var(--color-text-muted)]">
                        {totalPoints} pts earned today
                    </div>
                )}
            </div>
        </div>
    );
}

function TaskRow({ task, t }) {
    const taskNameKey = task.id;        // e.g. 'task_checkin'
    const taskDescKey = task.id + '_desc';

    const label = t(taskNameKey) || task.id;
    const desc = t(taskDescKey, { target: task.target }) || '';

    const pct = task.target > 1
        ? Math.min(100, Math.round((task.progress / task.target) * 100))
        : task.completed ? 100 : 0;

    return (
        <div className={cn(
            'flex items-center gap-3 p-3 rounded-[var(--radius-lg)] border transition-all',
            task.completed
                ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)]/30'
                : 'bg-[var(--color-bg-hover)] border-[var(--color-border)]'
        )}>
            {/* Status icon */}
            <span className="text-2xl flex-shrink-0">{task.icon}</span>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        'text-sm font-semibold',
                        task.completed ? 'text-[var(--color-primary-active)]' : 'text-[var(--color-text-main)]'
                    )}>
                        {label}
                    </span>
                    {task.completed
                        ? <CheckCircle2 size={14} className="text-[var(--color-primary)] flex-shrink-0" />
                        : <Circle size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
                    }
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>

                {/* Progress bar for multi-step tasks */}
                {task.target > 1 && (
                    <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 bg-[var(--color-border)] rounded-full h-1">
                            <div
                                className={cn(
                                    'rounded-full h-1 transition-all duration-300',
                                    task.completed ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-primary)]/70'
                                )}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <span className="text-xs text-[var(--color-text-muted)]">
                            {t('task_in_progress', { progress: task.progress, target: task.target })}
                        </span>
                    </div>
                )}
            </div>

            {/* Points badge */}
            <div className={cn(
                'flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full',
                task.completed
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-active)]'
                    : task.points > 0
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
            )}>
                {task.completed
                    ? t('task_claim')
                    : task.points > 0
                        ? t('task_points', { points: task.points })
                        : t('task_no_points')
                }
            </div>
        </div>
    );
}
