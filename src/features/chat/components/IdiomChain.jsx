/**
 * T10: IdiomChain (成语接龙)
 * Chinese idiom chain game — only available in Chinese mode.
 * AI responds with an idiom starting with the last character of the previous idiom.
 * Awards points on success.
 */
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Trophy, RefreshCw, BookOpen } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { useSocial } from '../../../context/SocialContext';
import { callAI } from '../services/chatService';
import { cn } from '../../../utils/cn';

// Seed idioms to start the game
const SEED_IDIOMS = ['一石二鸟', '马到成功', '半途而废', '画龙点睛', '守株待兔', '对牛弹琴', '四面楚歌', '亡羊补牢'];

function getRandomSeed() {
    return SEED_IDIOMS[Math.floor(Math.random() * SEED_IDIOMS.length)];
}

// Basic validation: must be 4 Chinese characters
function isValidIdiom(text) {
    return /^[\u4e00-\u9fff]{4}$/.test(text.trim());
}

export default function IdiomChain({ aiName, onClose, onAwardPoints }) {
    const { t, language } = useLanguage();
    const { addPoints, updateTaskProgress } = useSocial();
    const [chain, setChain] = useState([]);
    const [input, setInput] = useState('');
    const [aiThinking, setAiThinking] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [error, setError] = useState('');
    const [started, setStarted] = useState(false);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [chain]);

    const startGame = () => {
        const seed = getRandomSeed();
        setChain([{ text: seed, isAI: true }]);
        setStarted(true);
        setGameOver(false);
        setScore(0);
        setError('');
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const getAIResponse = async (lastIdiom) => {
        const lastChar = lastIdiom[lastIdiom.length - 1];
        const prompt = `成语接龙游戏。请给出一个以"${lastChar}"开头的四字成语，只输出成语本身，不要任何解释或标点。如果无法找到合适的成语，只输出"认输"两字。`;
        try {
            const response = await callAI([
                { role: 'system', content: '你是成语接龙游戏的裁判，只输出四字成语或认输，不输出其他任何内容。' },
                { role: 'user', content: prompt }
            ], { max_tokens: 20 });
            const text = (response?.choices?.[0]?.message?.content || '').trim();
            return text;
        } catch {
            return '认输';
        }
    };

    const handleSubmit = async () => {
        if (!started || gameOver || aiThinking) return;
        const idiom = input.trim();
        setError('');

        if (!isValidIdiom(idiom)) {
            setError(t('idiom_invalid'));
            return;
        }

        // Check continuation: first char of user idiom must match last char of AI idiom
        const lastEntry = chain[chain.length - 1];
        if (lastEntry && idiom[0] !== lastEntry.text[lastEntry.text.length - 1]) {
            setError(t('idiom_wrong_start', { char: lastEntry.text[lastEntry.text.length - 1] }));
            return;
        }

        // Check for duplicates
        if (chain.some(e => e.text === idiom)) {
            setError(t('idiom_duplicate'));
            return;
        }

        // Add user idiom
        setChain(prev => [...prev, { text: idiom, isAI: false }]);
        setInput('');
        setScore(s => s + 1);

        // Get AI response
        setAiThinking(true);
        await new Promise(r => setTimeout(r, 600)); // slight delay for realism
        const aiResponse = await getAIResponse(idiom);
        setAiThinking(false);

        if (aiResponse === '认输' || !isValidIdiom(aiResponse)) {
            // AI gives up — user wins!
            setChain(prev => [...prev, { text: language === 'zh' ? '认输！你赢了！🎉' : 'I give up! You win! 🎉', isAI: true, isEnd: true }]);
            setGameOver(true);
            const pts = Math.max(10, score * 5);
            addPoints(pts);
            updateTaskProgress?.('task_game', 1);
        } else if (chain.some(e => e.text === aiResponse)) {
            // AI repeated — user wins
            setChain(prev => [...prev, { text: `${aiResponse} (重复！你赢了！)`, isAI: true, isEnd: true }]);
            setGameOver(true);
            addPoints(10);
            updateTaskProgress?.('task_game', 1);
        } else {
            setChain(prev => [...prev, { text: aiResponse, isAI: true }]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full sm:max-w-sm bg-[var(--color-bg-white)] rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)] shadow-floating overflow-hidden animate-fade-slide-up sm:animate-scale-spring flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--color-border)] bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
                    <div>
                        <h2 className="font-display font-bold text-[var(--color-text-main)] flex items-center gap-2">
                            <BookOpen size={16} className="text-red-500" />
                            {t('idiom_chain_title')}
                        </h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('idiom_chain_desc')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {started && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
                                <Trophy size={11} className="text-amber-500" />
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{score}</span>
                            </div>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Chain Display */}
                <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[200px]">
                    {!started ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 gap-3">
                            <div className="text-4xl">🀄</div>
                            <p className="text-sm text-[var(--color-text-muted)] text-center">{t('idiom_start_hint')}</p>
                            <button onClick={startGame} className="px-6 py-2.5 rounded-[var(--radius-xl)] bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold text-sm hover:opacity-90">
                                {t('idiom_start')}
                            </button>
                        </div>
                    ) : (
                        chain.map((entry, i) => (
                            <div key={i} className={cn('flex', entry.isAI ? 'justify-start' : 'justify-end')}>
                                {entry.isAI && (
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold mr-2 mt-1 shrink-0">
                                        AI
                                    </div>
                                )}
                                <div className={cn(
                                    'px-4 py-2.5 rounded-[var(--radius-xl)] text-sm font-medium',
                                    entry.isAI
                                        ? entry.isEnd
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs'
                                            : 'bg-[var(--color-bg-hover)] text-[var(--color-text-main)]'
                                        : 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
                                )}>
                                    {entry.text}
                                    {entry.isAI && !entry.isEnd && i > 0 && (
                                        <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                                            ↩ {entry.text[entry.text.length - 1]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {aiThinking && (
                        <div className="flex justify-start">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold mr-2 mt-1">AI</div>
                            <div className="bg-[var(--color-bg-hover)] px-4 py-2.5 rounded-[var(--radius-xl)]">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input + Error */}
                {error && (
                    <p className="px-4 text-xs text-[var(--color-danger)] text-center">{error}</p>
                )}

                {started && !gameOver ? (
                    <div className="flex items-center gap-2 px-4 pb-5 pt-3 border-t border-[var(--color-border)]">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            placeholder={chain.length > 0 ? `${t('idiom_input_hint')} "${chain[chain.length - 1]?.text?.slice(-1)}"...` : t('idiom_enter')}
                            disabled={aiThinking}
                            className="flex-1 input-modern text-sm py-2.5"
                            maxLength={4}
                        />
                        <button
                            onClick={handleSubmit}
                            disabled={aiThinking || !input.trim()}
                            className="p-2.5 rounded-[var(--radius-xl)] bg-gradient-to-r from-red-500 to-orange-500 text-white disabled:opacity-50 transition-all hover:opacity-90"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                ) : gameOver ? (
                    <div className="flex items-center gap-2 px-4 pb-5 pt-3 border-t border-[var(--color-border)]">
                        <button
                            onClick={startGame}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-xl)] bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold text-sm"
                        >
                            <RefreshCw size={14} />
                            {t('play_again')}
                        </button>
                        <button onClick={onClose} className="px-4 py-2.5 rounded-[var(--radius-xl)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]">
                            {t('close')}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
