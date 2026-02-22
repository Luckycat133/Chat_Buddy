import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

const GAMES = [
    {
        id: 'rps',
        icon: '✊',
        nameKey: 'game_rps',
        descKey: 'game_rps_desc',
        color: 'from-orange-400 to-red-500',
    },
    {
        id: 'number_guess',
        icon: '🔢',
        nameKey: 'game_number_guess',
        descKey: 'game_number_guess_desc',
        color: 'from-indigo-500 to-purple-600',
    },
];

export default function GameSelectorPanel({ aiName, onSelectGame, onClose }) {
    const { t } = useLanguage();

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full sm:max-w-sm bg-[var(--color-bg-white)] rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)] shadow-floating overflow-hidden animate-fade-slide-up sm:animate-scale-spring">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
                    <div>
                        <h2 className="font-display font-bold text-[var(--color-text-main)]">{t('select_game')}</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            {t('select_game_desc', { name: aiName || 'AI' })}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
                        aria-label={t('cancel')}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Game list */}
                <div className="p-4 space-y-3 pb-6">
                    {GAMES.map(game => (
                        <button
                            key={game.id}
                            onClick={() => onSelectGame(game.id)}
                            className="w-full flex items-center gap-4 p-4 rounded-[var(--radius-xl)] bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-active)] transition-all text-left active:scale-[0.98]"
                        >
                            <div className={`w-12 h-12 rounded-[var(--radius-lg)] flex items-center justify-center text-2xl bg-gradient-to-br ${game.color} shadow-sm`}>
                                {game.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-[var(--color-text-main)]">{t(game.nameKey)}</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t(game.descKey)}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
