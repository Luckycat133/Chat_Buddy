import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useSocial } from '../../../context/SocialContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

const MAX_ATTEMPTS = 7;
const WIN_POINTS = 30;

export default function NumberGuessGame({ aiName, onClose, onResult }) {
    const { t } = useLanguage();
    const { addPoints, updateTaskProgress } = useSocial();

    // Lazy state initializer — runs once at mount, not on re-renders
    const [secret, setSecret] = useState(() => Math.floor(Math.random() * 100) + 1);
    const [guess, setGuess] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [feedback, setFeedback] = useState(null); // { type: 'high'|'low'|'correct'|'fail', msg: string }
    const [gameOver, setGameOver] = useState(false);
    const [won, setWon] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleGuess = () => {
        const n = parseInt(guess, 10);
        if (isNaN(n) || n < 1 || n > 100) return;

        const next = attempts + 1;
        setAttempts(next);
        setGuess('');

        if (n === secret) {
            setFeedback({
                type: 'correct',
                msg: t('number_guess_correct', { attempts: next })
            });
            setWon(true);
            setGameOver(true);
            addPoints(WIN_POINTS);
            updateTaskProgress('task_game', 1);
            onResult?.({ result: 'win', points: WIN_POINTS, attempts: next });
        } else if (next >= MAX_ATTEMPTS) {
            setFeedback({
                type: 'fail',
                msg: t('number_guess_fail', { number: secret })
            });
            setGameOver(true);
            updateTaskProgress('task_game', 1);
            onResult?.({ result: 'lose', points: 0, attempts: next });
        } else if (n > secret) {
            setFeedback({ type: 'high', msg: t('number_guess_too_high') });
        } else {
            setFeedback({ type: 'low', msg: t('number_guess_too_low') });
        }
    };

    const handlePlayAgain = () => {
        setSecret(Math.floor(Math.random() * 100) + 1);
        setGuess('');
        setAttempts(0);
        setFeedback(null);
        setGameOver(false);
        setWon(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const attemptsLeft = MAX_ATTEMPTS - attempts;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-sm mx-4 bg-[var(--color-bg-white)] rounded-[var(--radius-2xl)] shadow-floating overflow-hidden animate-scale-spring">
                {/* Header */}
                <div className="relative px-5 pt-5 pb-4"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                        aria-label={t('cancel')}
                    >
                        <X size={16} />
                    </button>
                    <div className="text-center">
                        <span className="text-4xl">🔢</span>
                        <h2 className="text-lg font-display font-bold text-white mt-1">{t('number_guess')}</h2>
                        <p className="text-sm text-white/80 mt-0.5">
                            {t('number_guess_thinking', { name: aiName || 'AI' })}
                        </p>
                    </div>
                </div>

                {/* Game area */}
                <div className="p-5">
                    {/* Attempt pills */}
                    <div className="flex justify-center gap-1.5 mb-5">
                        {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    'w-7 h-7 rounded-full border-2 transition-all',
                                    i < attempts
                                        ? won && i === attempts - 1
                                            ? 'bg-green-500 border-green-500'
                                            : 'bg-[var(--color-border)] border-[var(--color-border)]'
                                        : 'border-[var(--color-border)] bg-transparent'
                                )}
                            />
                        ))}
                    </div>

                    {/* Feedback */}
                    {feedback && (
                        <div className={cn(
                            'rounded-[var(--radius-lg)] px-4 py-3 mb-4 text-sm font-medium text-center',
                            feedback.type === 'correct' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' :
                                feedback.type === 'fail' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                                    feedback.type === 'high' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' :
                                        'bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400'
                        )}>
                            {feedback.msg}
                            {won && (
                                <div className="mt-1 font-bold text-green-600">
                                    {t('number_guess_win_pts', { pts: WIN_POINTS })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Input */}
                    {!gameOver && (
                        <form onSubmit={(e) => { e.preventDefault(); handleGuess(); }} className="space-y-3">
                            <input
                                ref={inputRef}
                                type="number"
                                min="1"
                                max="100"
                                value={guess}
                                onChange={(e) => setGuess(e.target.value)}
                                placeholder={t('number_guess_enter')}
                                className="input-modern w-full text-center text-xl font-bold"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={!guess}
                                    className="btn btn-primary flex-1"
                                >
                                    {t('number_guess_guess_btn')}
                                </button>
                            </div>
                            {!feedback && (
                                <p className="text-center text-xs text-[var(--color-text-muted)]">
                                    {t('number_guess_attempts_left', { left: attemptsLeft })}
                                </p>
                            )}
                        </form>
                    )}

                    {/* Game over actions */}
                    {gameOver && (
                        <div className="flex gap-2 mt-2">
                            <button onClick={handlePlayAgain} className="btn btn-secondary flex-1">
                                {t('number_guess_play_again')}
                            </button>
                            <button onClick={onClose} className="btn btn-ghost flex-1">
                                {t('finish')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
