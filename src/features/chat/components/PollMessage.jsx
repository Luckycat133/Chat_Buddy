import React from 'react';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';
import { CheckCircle2, Circle } from 'lucide-react';

export default function PollMessage({ poll, onVote }) {
    const { currentUser } = useChat();
    const { language } = useLanguage();

    if (!poll) return null;

    const totalVotes = poll.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0);
    const userVotedOptionIds = poll.options
        .filter(opt => opt.votes?.includes(currentUser.id))
        .map(opt => opt.id);
    const hasVoted = userVotedOptionIds.length > 0;

    const handleVote = (optionId) => {
        if (!onVote) return;
        // If single choice and already voted, or if just toggling
        onVote(poll.id, optionId);
    };

    return (
        <div className="bg-[var(--color-bg-white)] rounded-lg p-4 shadow-sm border border-[var(--color-border)] min-w-[280px] max-w-[320px]">
            <div className="mb-3">
                <h3 className="font-medium text-[16px] text-[var(--color-text-main)] mb-1">{poll.question}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                    {poll.isAnonymous ? (language === 'zh' ? '匿名投票' : 'Anonymous Poll') : (language === 'zh' ? '公开投票' : 'Public Poll')}
                    {' • '}
                    {poll.isMultiChoice ? (language === 'zh' ? '多选' : 'Multiple Choice') : (language === 'zh' ? '单选' : 'Single Choice')}
                </p>
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
                            disabled={!poll.isMultiChoice && hasVoted && !isSelected} // Allow deselection? Or switch? depends on logic. Let's assume standard toggle for now.
                            className={cn(
                                "w-full relative overflow-hidden rounded-md border transition-all",
                                isSelected
                                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                                    : "border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
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
