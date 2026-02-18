import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';
import { CheckCircle2, Circle, Clock, Users } from 'lucide-react';

/**
 * Format remaining time for countdown
 */
function formatRemainingTime(expiresAt, language) {
    if (!expiresAt) return null;
    const now = Date.now();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;

    if (diff <= 0) return language === 'zh' ? '已结束' : 'Ended';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return language === 'zh' ? `剩余 ${hours} 小时` : `${hours}h ${minutes}m left`;
    }
    return language === 'zh' ? `剩余 ${minutes} 分钟` : `${minutes}m left`;
}

/**
 * Check if poll has expired
 */
function isPollExpired(poll) {
    if (!poll.expiresAt) return false;
    return new Date(poll.expiresAt).getTime() <= Date.now();
}

export default function PollMessage({ poll, onVote }) {
    const { currentUser } = useChat();
    const { language } = useLanguage();
    const [timeLeft, setTimeLeft] = useState(formatRemainingTime(poll?.expiresAt, language));

    // Update countdown timer
    useEffect(() => {
        if (!poll?.expiresAt || isPollExpired(poll)) return;

        const interval = setInterval(() => {
            setTimeLeft(formatRemainingTime(poll.expiresAt, language));
        }, 60000); // Update every minute

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [poll?.expiresAt, language]);

    if (!poll) return null;

    const expired = isPollExpired(poll);

    const totalVotes = poll.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0);
    const userVotedOptionIds = poll.options
        .filter(opt => opt.votes?.includes(currentUser.id))
        .map(opt => opt.id);
    const hasVoted = userVotedOptionIds.length > 0;

    const handleVote = (optionId) => {
        if (!onVote || expired) return;

        if (poll.isMultiChoice) {
            // Multi-choice: toggle selection
            const isSelected = userVotedOptionIds.includes(optionId);
            if (isSelected) {
                // Remove vote
                onVote(poll.id, optionId, 'remove');
            } else {
                // Add vote
                onVote(poll.id, optionId, 'add');
            }
        } else {
            // Single choice: switch selection
            onVote(poll.id, optionId, 'switch');
        }
    };

    return (
        <div className={cn(
            "bg-[var(--color-bg-white)] rounded-lg p-4 shadow-sm border min-w-[280px] max-w-[320px]",
            expired ? "border-[var(--color-text-muted)]/30 opacity-75" : "border-[var(--color-border)]"
        )}>
            <div className="mb-3">
                <h3 className="font-medium text-[16px] text-[var(--color-text-main)] mb-1">{poll.question}</h3>
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                        <Users size={12} />
                        {poll.isAnonymous ? (language === 'zh' ? '匿名' : 'Anonymous') : (language === 'zh' ? '公开' : 'Public')}
                    </span>
                    <span>•</span>
                    <span>{poll.isMultiChoice ? (language === 'zh' ? '多选' : 'Multi') : (language === 'zh' ? '单选' : 'Single')}</span>
                    {timeLeft && (
                        <>
                            <span>•</span>
                            <span className={cn(
                                "flex items-center gap-1",
                                expired && "text-red-500 font-medium"
                            )}>
                                <Clock size={12} />
                                {expired ? (language === 'zh' ? '已结束' : 'Ended') : timeLeft}
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                {poll.options.map((option) => {
                    const votes = option.votes?.length || 0;
                    const percentage = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
                    const isSelected = userVotedOptionIds.includes(option.id);

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleVote(option.id)}
                            disabled={expired || (!poll.isMultiChoice && hasVoted && !isSelected)}
                            className={cn(
                                "w-full relative overflow-hidden rounded-md border transition-all",
                                isSelected
                                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                                    : "border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]",
                                expired && "cursor-not-allowed opacity-60"
                            )}
                        >
                            {/* Progress Bar Background */}
                            <div
                                className="absolute top-0 left-0 h-full bg-[var(--color-primary)]/10 transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                            />

                            <div className="relative flex items-center justify-between px-3 py-2.5">
                                <div className="flex items-center gap-3">
                                    {isSelected ? (
                                        <CheckCircle2 size={18} className="text-[var(--color-primary)] flex-shrink-0" />
                                    ) : (
                                        <Circle size={18} className="text-[var(--color-text-light)] flex-shrink-0" />
                                    )}
                                    <span className={cn(
                                        "text-sm font-medium z-10",
                                        isSelected ? "text-[var(--color-primary)]" : "text-[var(--color-text-main)]"
                                    )}>
                                        {option.text}
                                    </span>
                                </div>
                                <span className="text-xs text-[var(--color-text-muted)] z-10">
                                    {votes}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] flex justify-between items-center">
                <span className="text-xs text-[var(--color-text-muted)]">
                    {totalVotes} {language === 'zh' ? '人已参与' : 'votes'}
                </span>
            </div>
        </div>
    );
}
