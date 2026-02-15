import React from 'react';
import { cn } from '../utils/cn';
import { STATUS_CONFIG } from '../core/presence/PresenceService';

const STATUS_OPTIONS = ['online', 'busy', 'away', 'do-not-disturb', 'offline'];

export default function StatusSelector({ currentStatus, onStatusChange, language = 'en' }) {
    return (
        <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => {
                const config = STATUS_CONFIG[status];
                const isActive = currentStatus === status;

                return (
                    <button
                        key={status}
                        onClick={() => onStatusChange(status)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                            "border border-transparent hover:border-[var(--color-border)]",
                            isActive
                                ? "bg-[var(--color-bg-white)] shadow-md border-[var(--color-border)]"
                                : "bg-[var(--color-bg-app)] hover:bg-[var(--color-bg-hover)]"
                        )}
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: config.color }}
                        />
                        <span className={isActive ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}>
                            {language === 'zh' ? config.label.zh : config.label.en}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export function StatusBadge({ status, language = 'en', showDescription = false }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.online;

    return (
        <div className={cn(
            "presence-status-indicator presence-status-indicator--" + status
        )}>
            <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config.color }}
            />
            <span>{language === 'zh' ? config.label.zh : config.label.en}</span>
            {showDescription && (
                <span className="text-[var(--color-text-muted)] font-normal">
                    · {language === 'zh' ? config.description.zh : config.description.en}
                </span>
            )}
        </div>
    );
}

export function StatusDot({ status, size = 'md' }) {
    const sizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4'
    };

    const config = STATUS_CONFIG[status] || STATUS_CONFIG.online;

    return (
        <span
            className={cn(
                "rounded-full inline-block",
                sizeClasses[size]
            )}
            style={{ backgroundColor: config.color }}
            title={config.label.en}
        />
    );
}
