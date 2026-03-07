/**
 * T10: AI Trivia Quiz
 * AI generates questions from chat context or general knowledge.
 * Multiple choice, score tracking, points reward.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { X, Brain, Trophy, RefreshCw, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { useSocial } from '../../../context/SocialContext';
import { callAI } from '../services/chatService';
import { cn } from '../../../utils/cn';
import { getHistoryByCharacter, saveQuizResult } from '../services/TriviaStore';

const QUIZ_LENGTH = 5;
const POINTS_PER_CORRECT = 6;

const CATEGORIES_EN = ['General Knowledge', 'Science', 'History', 'Pop Culture', 'Technology', 'Math'];
const CATEGORIES_ZH = ['常识', '科学', '历史', '流行文化', '科技', '数学'];

async function generateQuizQuestion(category, language) {
    const prompt = language === 'zh'
        ? `生成一道关于"${category}"的选择题。格式必须是严格的JSON：
{"question": "题目", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "简短解释"}
correct是正确选项的下标(0-3)。只输出JSON，不加任何其他内容。`
        : `Generate a multiple-choice trivia question about "${category}". Return ONLY valid JSON:
{"question": "question text", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "brief explanation"}
correct is the index (0-3) of the correct option. Output only JSON.`;

    try {
        const response = await callAI([
            { role: 'system', content: 'You are a trivia question generator. Output only valid JSON.' },
            { role: 'user', content: prompt }
        ], { maxTokens: 300, temperature: 0.8 });

        const text = String(response || '').trim();
        // Extract JSON from the response (handle code block wrapping)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found');
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length < 2) throw new Error('Invalid format');
        return parsed;
    } catch (_e) {
        // Fallback question if AI fails
        return {
            question: language === 'zh' ? `关于${category}：什么是人工智能？` : `About ${category}: What does AI stand for?`,
            options: language === 'zh'
                ? ['人工智能', '自动化系统', '高级接口', '分析引擎']
                : ['Artificial Intelligence', 'Automated Interface', 'Advanced Integration', 'Analytical Input'],
            correct: 0,
            explanation: language === 'zh' ? 'AI代表人工智能，即机器模拟人类智能的技术。' : 'AI stands for Artificial Intelligence — machines simulating human intelligence.'
        };
    }
}

export default function TriviaQuiz({ aiName: _aiName, onClose, chatId, personaId }) {
    const { t, language } = useLanguage();
    const { addPoints, updateTaskProgress } = useSocial();
    const [phase, setPhase] = useState('select'); // 'select' | 'playing' | 'result'
    const [category, setCategory] = useState('');
    const [questions, setQuestions] = useState([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [selected, setSelected] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showExplain, setShowExplain] = useState(false);
    const [history, setHistory] = useState([]);

    const categories = language === 'zh' ? CATEGORIES_ZH : CATEGORIES_EN;

    useEffect(() => {
        let cancelled = false;
        if (!personaId) return;
        getHistoryByCharacter(personaId).then((items) => {
            if (!cancelled) setHistory(items || []);
        }).catch(() => {
            if (!cancelled) setHistory([]);
        });
        return () => {
            cancelled = true;
        };
    }, [personaId, phase]);

    const startQuiz = useCallback(async (cat) => {
        setCategory(cat);
        setPhase('playing');
        setLoading(true);
        setCurrentQ(0);
        setAnswers([]);
        setSelected(null);
        setShowExplain(false);

        // Generate all questions in parallel
        const generated = await Promise.all(
            Array.from({ length: QUIZ_LENGTH }, () => generateQuizQuestion(cat, language))
        );
        setQuestions(generated);
        setLoading(false);
    }, [language]);

    const handleAnswer = (optIdx) => {
        if (selected !== null) return;
        setSelected(optIdx);
        setShowExplain(true);
        const q = questions[currentQ];
        const isCorrect = optIdx === q.correct;
        setAnswers(prev => [...prev, { selected: optIdx, correct: q.correct, isCorrect }]);
    };

    const handleNext = async () => {
        if (currentQ + 1 >= questions.length) {
            // Calculate final score
            const correctCount = answers.filter(a => a.isCorrect).length;
            const pts = correctCount * POINTS_PER_CORRECT;
            addPoints(pts);
            updateTaskProgress?.('task_game', 1);
            if (chatId && personaId) {
                await saveQuizResult({
                    chatId,
                    personaId,
                    score: correctCount,
                    total: questions.length,
                    questions: questions.map((q, idx) => ({
                        q: q.question,
                        options: q.options,
                        answer: q.correct,
                        userAnswer: answers[idx]?.selected ?? null,
                        correct: Boolean(answers[idx]?.isCorrect)
                    }))
                }).catch(() => { });
            }
            setPhase('result');
        } else {
            setCurrentQ(q => q + 1);
            setSelected(null);
            setShowExplain(false);
        }
    };

    const finalScore = answers.filter(a => a.isCorrect).length;

    if (phase === 'select') {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="w-full sm:max-w-sm bg-[var(--color-bg-white)] rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)] shadow-floating overflow-hidden animate-fade-slide-up sm:animate-scale-spring">
                    <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
                        <div>
                            <h2 className="font-display font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                <Brain size={16} className="text-indigo-500" />
                                {t('trivia_title')}
                            </h2>
                            <p className="text-xs text-[var(--color-text-muted)]">{t('trivia_select_category')}</p>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-2 pb-6">
                        {categories.map((cat, i) => (
                            <button
                                key={cat}
                                onClick={() => startQuiz(cat)}
                                className="p-3.5 rounded-[var(--radius-xl)] border border-[var(--color-border)] hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left active:scale-[0.97]"
                            >
                                <div className="text-xl mb-1">
                                    {['🌍', '🔬', '📜', '🎬', '💻', '🔢'][i]}
                                </div>
                                <p className="text-sm font-semibold text-[var(--color-text-main)]">{cat}</p>
                                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{QUIZ_LENGTH} {t('trivia_questions')}</p>
                            </button>
                        ))}
                    </div>
                    {history.length > 0 && (
                        <div className="px-4 pb-5">
                            <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">
                                {t('trivia_history') || 'Recent Results'}
                            </p>
                            <div className="space-y-1.5">
                                {history.slice(0, 3).map(item => (
                                    <div key={item.id} className="flex items-center justify-between text-xs bg-[var(--color-bg-hover)] rounded-lg px-3 py-2">
                                        <span className="text-[var(--color-text-muted)]">
                                            {new Date(item.generatedAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}
                                        </span>
                                        <span className="font-semibold text-[var(--color-text-main)]">
                                            {item.score}/{item.total}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (phase === 'result') {
        const total = questions.length;
        const pct = Math.round((finalScore / total) * 100);
        const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '😊' : '📚';
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="w-full sm:max-w-sm bg-[var(--color-bg-white)] rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)] shadow-floating overflow-hidden animate-fade-slide-up sm:animate-scale-spring">
                    <div className="p-6 text-center">
                        <div className="text-5xl mb-3">{emoji}</div>
                        <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('trivia_finished')}</h2>
                        <p className="text-[var(--color-text-muted)] text-sm mt-1">{category}</p>
                        <div className="mt-4 py-4 px-6 rounded-[var(--radius-xl)] bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                            <p className="text-3xl font-display font-bold text-indigo-600 dark:text-indigo-400">{finalScore}/{total}</p>
                            <p className="text-sm text-[var(--color-text-muted)] mt-1">{pct}% {t('trivia_correct')}</p>
                            <p className="text-xs text-indigo-500 mt-2">+{finalScore * POINTS_PER_CORRECT} {t('points')}</p>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => startQuiz(category)} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-xl)] bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm">
                                <RefreshCw size={14} /> {t('play_again')}
                            </button>
                            <button onClick={onClose} className="px-4 py-2.5 rounded-[var(--radius-xl)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]">{t('close')}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Playing phase
    const q = questions[currentQ];
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full sm:max-w-sm bg-[var(--color-bg-white)] rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)] shadow-floating overflow-hidden animate-fade-slide-up sm:animate-scale-spring flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-2">
                        <Brain size={16} className="text-indigo-500" />
                        <p className="text-sm font-semibold text-[var(--color-text-main)]">{category}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            {questions.map((_, i) => (
                                <div key={i} className={cn(
                                    'w-1.5 h-1.5 rounded-full transition-all',
                                    i < currentQ
                                        ? (answers[i]?.isCorrect ? 'bg-emerald-500' : 'bg-red-400')
                                        : i === currentQ ? 'bg-indigo-500 w-3' : 'bg-[var(--color-border)]'
                                )} />
                            ))}
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 size={32} className="text-indigo-500 animate-spin" />
                            <p className="text-sm text-[var(--color-text-muted)]">{t('trivia_generating')}</p>
                        </div>
                    ) : q ? (
                        <>
                            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-3">
                                Q{currentQ + 1}/{questions.length}
                            </p>
                            <p className="text-sm font-semibold text-[var(--color-text-main)] leading-relaxed mb-4">
                                {q.question}
                            </p>

                            <div className="space-y-2">
                                {q.options.map((opt, i) => {
                                    const isSelected = selected === i;
                                    const isCorrect = i === q.correct;
                                    const showResult = selected !== null;

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => handleAnswer(i)}
                                            disabled={selected !== null}
                                            className={cn(
                                                'w-full flex items-center gap-3 p-3.5 rounded-[var(--radius-xl)] border text-left transition-all text-sm',
                                                !showResult && 'border-[var(--color-border)] hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10',
                                                showResult && isCorrect && 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
                                                showResult && isSelected && !isCorrect && 'border-red-400 bg-red-50 dark:bg-red-900/20',
                                                showResult && !isSelected && !isCorrect && 'border-[var(--color-border)] opacity-50',
                                            )}
                                        >
                                            <span className={cn(
                                                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                                !showResult && 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]',
                                                showResult && isCorrect && 'bg-emerald-500 text-white',
                                                showResult && isSelected && !isCorrect && 'bg-red-500 text-white',
                                                showResult && !isSelected && !isCorrect && 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]',
                                            )}>
                                                {showResult && isCorrect ? <CheckCircle size={12} /> : showResult && isSelected && !isCorrect ? <XCircle size={12} /> : String.fromCharCode(65 + i)}
                                            </span>
                                            <span className={cn(
                                                showResult && isCorrect && 'text-emerald-700 dark:text-emerald-300 font-semibold',
                                                showResult && isSelected && !isCorrect && 'text-red-600 dark:text-red-400',
                                            )}>
                                                {opt}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {showExplain && q.explanation && (
                                <div className="mt-3 p-3 rounded-[var(--radius-lg)] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/60 dark:border-indigo-700/40">
                                    <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">{q.explanation}</p>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {!loading && selected !== null && (
                    <div className="px-5 pb-5 pt-3 border-t border-[var(--color-border)]">
                        <button
                            onClick={handleNext}
                            className="w-full py-2.5 rounded-[var(--radius-xl)] bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:opacity-90"
                        >
                            {currentQ + 1 >= questions.length ? t('trivia_see_results') : t('next_question')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
