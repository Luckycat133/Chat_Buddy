/**
 * CharacterMemoryPanel
 * T12: Memory Management UI
 *
 * Shows what a character remembers about the user.
 * Allows deleting individual memories or clearing all.
 */

import React, { useState, useEffect } from 'react';
import { Brain, Trash2, X, RefreshCw } from 'lucide-react';
import { memoryStore } from '../core/memory/MemoryStore';
import { cn } from '../utils/cn';

const CATEGORY_COLORS = {
    preference: { bg: 'bg-[var(--color-accent-sky)]/20', text: 'text-[var(--color-accent-sky)]', border: 'border-[var(--color-accent-sky)]/30' },
    fact: { bg: 'bg-[var(--color-primary)]/10', text: 'text-[var(--color-primary)]', border: 'border-[var(--color-primary)]/20' },
    event: { bg: 'bg-[var(--color-accent-lavender)]/20', text: 'text-[var(--color-accent-lavender)]', border: 'border-[var(--color-accent-lavender)]/30' },
};

const IMPORTANCE_LABELS = {
    1: '⬜', 2: '⬜', 3: '🟨',
    4: '🟨', 5: '🟧', 6: '🟧',
    7: '🟥', 8: '🟥', 9: '⭐', 10: '⭐',
};

export default function CharacterMemoryPanel({ character, onClose }) {
    const [memories, setMemories] = useState([]);
    const [loadedForCharacterId, setLoadedForCharacterId] = useState(null);
    const [clearing, setClearing] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const characterId = character?.id;
    const loading = Boolean(characterId) && loadedForCharacterId !== characterId;

    const fetchMemories = async (targetCharacterId) => {
        if (!targetCharacterId) return [];
        try {
            const facts = await memoryStore.getAllFactsForUI(targetCharacterId);
            return Array.isArray(facts) ? facts : [];
        } catch (_error) {
            return [];
        }
    };

    useEffect(() => {
        if (!characterId) return;
        let cancelled = false;

        (async () => {
            const facts = await fetchMemories(characterId);
            if (cancelled) return;
            setMemories(facts);
            setLoadedForCharacterId(characterId);
        })();

        return () => {
            cancelled = true;
        };
    }, [characterId]);

    const handleRefresh = async () => {
        if (!characterId || refreshing) return;
        setRefreshing(true);
        setLoadedForCharacterId(null);
        const facts = await fetchMemories(characterId);
        setMemories(facts);
        setLoadedForCharacterId(characterId);
        setRefreshing(false);
    };

    const handleForget = async (factId) => {
        await memoryStore.forgetFact(factId);
        setMemories((prev) => prev.filter((m) => m.id !== factId));
    };

    const handleForgetAll = async () => {
        if (!window.confirm(`Clear all memories for ${character?.name}? This cannot be undone.`)) return;
        setClearing(true);
        await memoryStore.forgetAllFacts(character.id);
        setMemories([]);
        setClearing(false);
    };

    const formatDate = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative w-full max-w-lg glass-crystal rounded-[var(--radius-2xl)] shadow-floating overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        {character?.avatar && (
                            <img
                                src={character.avatar}
                                alt={character.name}
                                className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--color-primary)]/30"
                            />
                        )}
                        <div>
                            <h3 className="font-semibold text-[var(--color-text-main)]">
                                <Brain size={14} className="inline mr-1 text-[var(--color-primary)]" />
                                {character?.name}'s Memory
                            </h3>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                                {memories.length} remembered {memories.length === 1 ? 'fact' : 'facts'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="btn btn-ghost btn-icon disabled:opacity-60"
                            title="Refresh"
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={onClose} className="btn btn-ghost btn-icon">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-secondary)]">
                            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-3" />
                            <p className="text-sm">Loading memories…</p>
                        </div>
                    ) : memories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-secondary)]">
                            <Brain size={40} className="mb-3 opacity-30" />
                            <p className="text-sm font-medium">No memories yet</p>
                            <p className="text-xs mt-1 opacity-60">
                                {character?.name} will start remembering things as you chat more.
                            </p>
                        </div>
                    ) : (
                        memories.map((memory) => {
                            const cat = CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.fact;
                            return (
                                <div
                                    key={memory.id}
                                    className="group relative flex items-start gap-3 p-3 rounded-[var(--radius-lg)] bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                                >
                                    {/* Importance + Category */}
                                    <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                                        <span className="text-base leading-none" title={`Importance: ${memory.importance}/10`}>
                                            {IMPORTANCE_LABELS[memory.importance] || '⬜'}
                                        </span>
                                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', cat.bg, cat.text, cat.border)}>
                                            {memory.category}
                                        </span>
                                    </div>

                                    {/* Fact text */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-[var(--color-text-main)] leading-relaxed">
                                            {memory.fact}
                                        </p>
                                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                                            Remembered {formatDate(memory.timestamp)}
                                            {memory.lastRecalledAt !== memory.timestamp && (
                                                <span className="ml-2 opacity-60">
                                                    · Last recalled {formatDate(memory.lastRecalledAt)}
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Forget button */}
                                    <button
                                        onClick={() => handleForget(memory.id)}
                                        className="btn btn-ghost btn-icon opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-danger)] shrink-0"
                                        title="Forget this memory"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                {memories.length > 0 && (
                    <div className="p-4 border-t border-white/10">
                        <button
                            onClick={handleForgetAll}
                            disabled={clearing}
                            className="btn btn-danger w-full flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} />
                            {clearing ? 'Clearing…' : `Clear All Memories`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
