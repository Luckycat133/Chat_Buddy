import React, { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

// Game choices
const CHOICES = [
    { id: 'rock', emoji: '✊', name: '石头', name_en: 'Rock' },
    { id: 'paper', emoji: '✋', name: '布', name_en: 'Paper' },
    { id: 'scissors', emoji: '✌️', name: '剪刀', name_en: 'Scissors' }
];

const OUTCOMES = {
    rock: { rock: 'draw', paper: 'lose', scissors: 'win' },
    paper: { rock: 'win', paper: 'draw', scissors: 'lose' },
    scissors: { rock: 'lose', paper: 'win', scissors: 'draw' }
};

export default function RockPaperScissors({ aiName, onClose, onResult }) {
    const { t, language } = useLanguage();
    const [playerChoice, setPlayerChoice] = useState(null);
    const [aiChoice, setAiChoice] = useState(null);
    const [result, setResult] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const [score, setScore] = useState({ player: 0, ai: 0 });
    const [round, setRound] = useState(1);

    // AI makes its choice after player
    useEffect(() => {
        if (playerChoice && !aiChoice) {
            setCountdown(3);
        }
    }, [playerChoice, aiChoice]);

    // Countdown and reveal
    useEffect(() => {
        if (countdown === null) return;

        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 500);
            return () => clearTimeout(timer);
        } else {
            // AI picks randomly
            const randomChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
            setAiChoice(randomChoice);

            // Determine result
            const outcome = OUTCOMES[playerChoice.id][randomChoice.id];
            setResult(outcome);

            // Update score
            if (outcome === 'win') {
                setScore(prev => ({ ...prev, player: prev.player + 1 }));
            } else if (outcome === 'lose') {
                setScore(prev => ({ ...prev, ai: prev.ai + 1 }));
            }
        }
    }, [countdown, playerChoice]);

    const handleChoice = (choice) => {
        if (playerChoice) return; // Already chose
        setPlayerChoice(choice);
    };

    const handlePlayAgain = () => {
        setPlayerChoice(null);
        setAiChoice(null);
        setResult(null);
        setCountdown(null);
        setRound(prev => prev + 1);
    };

    const handleFinish = () => {
        const finalResult = score.player > score.ai ? 'win' : score.player < score.ai ? 'lose' : 'draw';
        onResult?.({ result: finalResult, score, rounds: round });
        onClose?.();
    };

    const getResultMessage = () => {
        if (!result) return '';
        if (result === 'win') return t('you_win');
        if (result === 'lose') return t('ai_wins', { name: aiName });
        return t('game_draw');
    };

    const getResultColor = () => {
        if (!result) return '';
        if (result === 'win') return 'text-green-500';
        if (result === 'lose') return 'text-red-500';
        return 'text-yellow-500';
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-xl w-full max-w-sm overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]">
                    <h3 className="font-bold text-white text-lg">
                        ✊ {t('rock_paper_scissors')} ✌️
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Score */}
                <div className="flex justify-between items-center px-6 py-3 bg-[var(--color-bg-app)]">
                    <div className="text-center">
                        <p className="text-sm text-[var(--color-text-muted)]">{t('you') || 'You'}</p>
                        <p className="text-2xl font-bold text-[var(--color-primary)]">{score.player}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-[var(--color-text-muted)]">{t('round_label', { round })}</p>
                        <p className="text-lg font-medium">VS</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-[var(--color-text-muted)]">{aiName}</p>
                        <p className="text-2xl font-bold text-red-500">{score.ai}</p>
                    </div>
                </div>

                {/* Game Area */}
                <div className="p-6">
                    {/* Choices Display */}
                    <div className="flex justify-center items-center gap-8 mb-6">
                        <div className="text-center">
                            <div className={cn(
                                "w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-4xl transition-all",
                                playerChoice && "animate-bounce-once"
                            )}>
                                {playerChoice ? playerChoice.emoji : '❓'}
                            </div>
                            <p className="mt-2 text-sm font-medium">{t('you') || 'You'}</p>
                        </div>

                        <div className="text-2xl font-bold text-[var(--color-text-muted)]">
                            {countdown !== null && countdown > 0 ? countdown : 'VS'}
                        </div>

                        <div className="text-center">
                            <div className={cn(
                                "w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-4xl transition-all",
                                aiChoice && "animate-bounce-once"
                            )}>
                                {aiChoice ? aiChoice.emoji : (countdown !== null ? '🤔' : '❓')}
                            </div>
                            <p className="mt-2 text-sm font-medium">{aiName}</p>
                        </div>
                    </div>

                    {/* Result */}
                    {result && (
                        <div className={cn("text-center text-xl font-bold mb-4", getResultColor())}>
                            {getResultMessage()}
                        </div>
                    )}

                    {/* Choice Buttons */}
                    {!playerChoice && (
                        <div>
                            <p className="text-center text-sm text-[var(--color-text-muted)] mb-4">
                                {t('make_your_choice')}
                            </p>
                            <div className="flex justify-center gap-4">
                                {CHOICES.map(choice => (
                                    <button
                                        key={choice.id}
                                        onClick={() => handleChoice(choice)}
                                        className="w-16 h-16 rounded-full bg-[var(--color-bg-app)] hover:bg-[var(--color-primary)] hover:text-white text-3xl transition-all hover:scale-110 active:scale-95"
                                    >
                                        {choice.emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Play Again / Finish */}
                    {result && (
                        <div className="flex gap-3">
                            <button
                                onClick={handlePlayAgain}
                                className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-[var(--color-primary-hover)] transition-colors"
                            >
                                <RotateCcw size={18} />
                                {t('play_again')}
                            </button>
                            <button
                                onClick={handleFinish}
                                className="flex-1 py-3 bg-[var(--color-bg-app)] text-[var(--color-text-main)] rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                {t('finish')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
