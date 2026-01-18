import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_BACKGROUND, BACKGROUND_THEMES } from './themes';
import { INITIAL_PERSONAS } from '../../data/personas';
import { TASK_AGENTS } from '../../data/taskAgents';

const BackgroundContext = createContext();

// Helper to find persona config
const findPersonaById = (id) => {
    return [...INITIAL_PERSONAS, ...TASK_AGENTS].find(p => p.id === id);
};

// Helper inside context or just outside? Inside is fine.

// eslint-disable-next-line react-refresh/only-export-components
export const useBackground = () => {
    const context = useContext(BackgroundContext);
    if (!context) {
        throw new Error('useBackground must be used within a BackgroundProvider');
    }
    return context;
};

export const BackgroundProvider = ({ children }) => {
    // Persistent state for global theme
    const [globalTheme, setGlobalTheme] = useState(() => {
        const saved = localStorage.getItem('cb_global_theme');
        return saved ? JSON.parse(saved) : DEFAULT_BACKGROUND;
    });

    // Persistent state for per-chat backgrounds
    // Map of chatId -> backgroundConfig
    const [chatBackgrounds, setChatBackgrounds] = useState(() => {
        const saved = localStorage.getItem('cb_chat_backgrounds');
        return saved ? JSON.parse(saved) : {};
    });

    // Save to local storage on change
    useEffect(() => {
        localStorage.setItem('cb_global_theme', JSON.stringify(globalTheme));
    }, [globalTheme]);

    useEffect(() => {
        localStorage.setItem('cb_chat_backgrounds', JSON.stringify(chatBackgrounds));
    }, [chatBackgrounds]);

    /**
     * Get the effective background for a specific chat.
     * Falls back to character default, then global theme.
     */
    const getBackgroundForChat = (chatId, personaId) => {
        // 1. Check for user-set chat specific background
        if (chatId && chatBackgrounds[chatId]) {
            return chatBackgrounds[chatId];
        }

        // 2. Check for Character Default
        if (personaId) {
            const persona = findPersonaById(personaId);
            if (persona?.defaultBackgroundId) {
                // Find the theme object in CHARACTERS category or recursively
                // For simplicity, let's assume it's in CHARACTERS or flatten search
                const allThemes = Object.values(BACKGROUND_THEMES).flat();
                const defaultTheme = allThemes.find(t => t.id === persona.defaultBackgroundId);

                if (defaultTheme) {
                    return {
                        type: 'preset',
                        value: defaultTheme.url,
                        blur: 0,
                        opacity: 0.6, // Default opacity for character backgrounds
                        overlayColor: '#000000'
                    };
                }
            }
        }

        // 3. Fall back to Global Theme
        return globalTheme;
    };

    /**
     * Set background for a specific chat
     */
    const setBackgroundForChat = (chatId, config) => {
        setChatBackgrounds(prev => ({
            ...prev,
            [chatId]: config
        }));
    };

    /**
     * Remove chat-specific background (revert to global)
     */
    const clearBackgroundForChat = (chatId) => {
        setChatBackgrounds(prev => {
            const next = { ...prev };
            delete next[chatId];
            return next;
        });
    };

    const value = {
        globalTheme,
        setGlobalTheme,
        chatBackgrounds,
        getBackgroundForChat,
        setBackgroundForChat,
        clearBackgroundForChat
    };

    return (
        <BackgroundContext.Provider value={value}>
            {children}
        </BackgroundContext.Provider>
    );
};
