import React from 'react';
import { getCharacterThemeStyle } from '../CharacterTheme';
import { Pencil } from 'lucide-react';

export default function TypingBubble({ persona, isEditing = false }) {
    if (!persona) return null;

    return (
        <div className="flex mb-4 justify-start bubble-enter">
            <div
                className="flex gap-2.5 max-w-[75%]"
                style={getCharacterThemeStyle(persona.id)}
            >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 shadow-sm opacity-90">
                    {persona.avatar ? (
                        <img src={persona.avatar} className="w-full h-full object-cover" alt={persona.name} />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-active)] flex items-center justify-center text-white text-xs font-bold">
                            {persona.name?.charAt(0)}
                        </div>
                    )}
                </div>

                {/* Bubble */}
                {isEditing ? (
                    // Phase 3: Editing state with pencil icon
                    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-white)] text-[var(--color-text-muted)] rounded-[20px] rounded-tl-sm border border-[var(--color-border-light)] shadow-sm self-end">
                        <Pencil size={14} className="animate-pulse" />
                        <span className="text-sm">Editing...</span>
                    </div>
                ) : (
                    <div className="typing-bubble message-bubble-ai self-end">
                        <span className="typing-dot"></span>
                        <span className="typing-dot" style={{ animationDelay: '0.15s' }}></span>
                        <span className="typing-dot" style={{ animationDelay: '0.3s' }}></span>
                    </div>
                )}
            </div>
        </div>
    );
}
