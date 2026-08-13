import React, { useState, useRef, useEffect } from 'react';
import { X, Trophy, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { useSocial } from '../../../context/SocialContext';
import { findNextIdiom, getIdiomMeaning, isKnownIdiom } from '../../../data/localGameContent';

const POINTS_PER_ROUND = 5;

export default function IdiomChainGame({ aiName, onClose, onResult }) {
    const { t, language } = useLanguage();
    const { addPoints, updateTaskProgress } = useSocial();

    const [input, setInput] = useState('');
    const [rounds, setRounds] = useState(0);
    const [history, setHistory] = useState([]); // [{type:'user'|'ai', idiom, meaning?, valid}]
    const [gameOver, setGameOver] = useState(false);
    const [totalPts, setTotalPts] = useState(0);
    const [requiredChar, setRequiredChar] = useState('');
    const inputRef = useRef(null);
    const historyRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Auto-scroll history
    useEffect(() => {
        if (historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [history]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const userIdiom = input.trim();
        if (!userIdiom || gameOver) return;

        // Basic validation: must be 4 Chinese characters
        if (!/^[\u4e00-\u9fa5]{4}$/.test(userIdiom)) {
            setHistory(h => [...h, { type: 'error', msg: '成语必须是4个汉字' }]);
            return;
        }

        // Check required starting character
        if (requiredChar && userIdiom[0] !== requiredChar) {
            setHistory(h => [...h, { type: 'error', msg: `成语必须以「${requiredChar}」开头` }]);
            return;
        }

        if (!isKnownIdiom(userIdiom)) {
            setHistory(h => [...h, {
                type: 'error',
                msg: language === 'zh' ? '当前常用成语词库未收录这个词，请换一个试试' : 'This idiom is not in the local common-idiom bank.',
            }]);
            return;
        }

        if (history.some(item => item.idiom === userIdiom)) {
            setHistory(h => [...h, { type: 'error', msg: language === 'zh' ? '这个成语已经用过了' : 'That idiom has already been used.' }]);
            return;
        }

        setInput('');
        const used = history.map(item => item.idiom).filter(Boolean);
        const aiIdiom = findNextIdiom(userIdiom, [...used, userIdiom]);
        const newRounds = rounds + 1;
        const newPts = totalPts + POINTS_PER_ROUND;
        addPoints(POINTS_PER_ROUND);
        setRounds(newRounds);
        setTotalPts(newPts);

        if (!aiIdiom) {
            setHistory(h => [
                ...h,
                { type: 'user', idiom: userIdiom },
                { type: 'win', msg: language === 'zh' ? '本地词库接不上了，你赢了！' : 'The local bank has no reply—you win!' },
            ]);
            setGameOver(true);
            updateTaskProgress('task_game', 1);
            onResult?.({ result: 'win', rounds: newRounds, points: newPts });
            return;
        }

        setHistory(h => [
            ...h,
            { type: 'user', idiom: userIdiom },
            {
                type: 'ai',
                idiom: aiIdiom,
                meaning: getIdiomMeaning(aiIdiom),
                round: newRounds,
            },
        ]);
        setRequiredChar(aiIdiom.slice(-1));
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleReset = () => {
        setInput('');
        setRounds(0);
        setHistory([]);
        setGameOver(false);
        setTotalPts(0);
        setRequiredChar('');
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleFinish = () => {
        if (rounds > 0) {
            updateTaskProgress('task_game', 1);
            onResult?.({ result: 'win', rounds, points: totalPts });
        }
        onClose();
    };

    const placeholder = requiredChar
        ? `以「${requiredChar}」开头的成语...`
        : t('idiom_your_idiom');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-sm mx-4 bg-[var(--color-bg-white)] rounded-[var(--radius-2xl)] shadow-floating overflow-hidden animate-scale-spring flex flex-col max-h-[90vh]">
                {/* Header */}
                <div
                    className="relative px-5 pt-5 pb-4 flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                        aria-label={t('cancel')}
                    >
                        <X size={16} />
                    </button>
                    <div className="text-center">
                        <span className="text-4xl">🀄</span>
                        <h2 className="text-lg font-display font-bold text-white mt-1">{t('game_idiom_chain')}</h2>
                        <p className="text-sm text-white/80 mt-0.5">{t('idiom_chain_rules')}</p>
                        <div className="flex items-center justify-center gap-4 mt-2">
                            <span className="text-white/90 text-sm font-semibold">
                                🔄 {rounds} {language === 'zh' ? '轮' : 'rounds'}
                            </span>
                            <span className="text-white/90 text-sm font-semibold">
                                ⭐ {totalPts} pts
                            </span>
                        </div>
                    </div>
                </div>

                {/* History area */}
                <div
                    ref={historyRef}
                    className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[180px]"
                >
                    {history.length === 0 && (
                        <p className="text-center text-[var(--color-text-muted)] text-sm mt-4">
                            {t('idiom_chain_rules')}
                        </p>
                    )}
                    {history.map((item, idx) => (
                        <div key={idx}>
                            {item.type === 'user' && (
                                <div className="flex justify-end">
                                    <div className="bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[var(--radius-xl)] rounded-tr-sm px-4 py-2 max-w-[70%]">
                                        <span className="font-bold text-lg">{item.idiom}</span>
                                    </div>
                                </div>
                            )}
                            {item.type === 'ai' && (
                                <div className="flex justify-start">
                                    <div className="bg-[var(--color-bg-hover)] rounded-[var(--radius-xl)] rounded-tl-sm px-4 py-2 max-w-[75%]">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-xs text-[var(--color-text-muted)]">{aiName}</span>
                                            <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 rounded-full">
                                                {language === 'zh' ? `第${item.round}轮` : `Rd.${item.round}`}
                                            </span>
                                        </div>
                                        <span className="font-bold text-lg text-[var(--color-text-main)]">{item.idiom}</span>
                                        {item.meaning && (
                                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.meaning}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            {item.type === 'error' && (
                                <div className="flex justify-center">
                                    <div className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs px-3 py-1.5 rounded-full">
                                        {item.msg}
                                    </div>
                                </div>
                            )}
                            {item.type === 'fail' && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[var(--radius-lg)] p-3 text-center">
                                    <p className="text-red-600 dark:text-red-400 font-semibold text-sm">{item.msg}</p>
                                    <p className="text-[var(--color-text-muted)] text-xs mt-1">
                                        {t('idiom_rounds_completed', { rounds })}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                    {history.some(item => item.type === 'win') && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-[var(--radius-lg)] p-3 text-center">
                            <p className="text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
                                {history.find(item => item.type === 'win')?.msg}
                            </p>
                        </div>
                    )}
                </div>

                {/* Input area */}
                <div className="p-4 border-t border-[var(--color-border)] flex-shrink-0">
                    {!gameOver ? (
                        <form onSubmit={handleSubmit} className="space-y-2">
                            {requiredChar && (
                                <div className="text-center">
                                    <span className="inline-flex items-center gap-1.5 text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full font-medium">
                                        <span>接龙：需以</span>
                                        <span className="text-base font-bold">「{requiredChar}」</span>
                                        <span>开头</span>
                                    </span>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={placeholder}
                                    maxLength={4}
                                    className="input-modern flex-1 text-center text-lg font-bold"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="btn btn-primary px-4"
                                >
                                    {t('idiom_submit')}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-2">
                            {rounds > 0 && (
                                <div className="flex items-center gap-2 justify-center text-[var(--color-primary)] font-semibold">
                                    <Trophy size={18} />
                                    <span>{t('idiom_rounds_completed', { rounds })} · +{totalPts} pts</span>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button onClick={handleReset} className="btn btn-secondary flex-1 flex items-center justify-center gap-2">
                                    <RefreshCw size={16} />
                                    {t('idiom_play_again')}
                                </button>
                                <button onClick={handleFinish} className="btn btn-ghost flex-1">
                                    {t('finish')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
