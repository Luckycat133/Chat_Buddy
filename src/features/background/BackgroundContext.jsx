import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_BACKGROUND, BACKGROUND_THEMES } from './themes';
import { INITIAL_PERSONAS } from '../../data/personas';
import { TASK_AGENTS } from '../../data/taskAgents';
import { storage } from '../../services/storage/StorageService';
import imageStorage from '../../services/storage/ImageStorageService';

const BackgroundContext = createContext();

// Helper to find persona config
const findPersonaById = (id) => {
    return [...INITIAL_PERSONAS, ...TASK_AGENTS].find(p => p.id === id);
};

// Generate a simple unique ID without external dependency
const genId = () => `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// eslint-disable-next-line react-refresh/only-export-components
export const useBackground = () => {
    const context = useContext(BackgroundContext);
    if (!context) {
        throw new Error('useBackground must be used within a BackgroundProvider');
    }
    return context;
};

export const BackgroundProvider = ({ children }) => {
    // Persistent state for global theme — uses StorageService
    const [globalTheme, setGlobalThemeState] = useState(() => {
        return storage.get('background:global-theme', DEFAULT_BACKGROUND);
    });

    // Persistent state for per-chat backgrounds — uses StorageService
    const [chatBackgrounds, setChatBackgroundsState] = useState(() => {
        return storage.get('background:chat-backgrounds', {});
    });

    // Map of imageId -> base64 for rendering custom images
    const [imageUrls, setImageUrls] = useState({});

    // Track IDs we've already started loading
    const loadedIds = useRef(new Set());

    // On mount: run one-time migration
    useEffect(() => {
        imageStorage.migrateFromLocalStorage().then(() => {
            // After migration reload storage (migration may have updated keys)
            const gt = storage.get('background:global-theme', DEFAULT_BACKGROUND);
            const cbs = storage.get('background:chat-backgrounds', {});
            // Use functional setState to merge (avoids stale closure)
            setGlobalThemeState(prev => {
                return JSON.stringify(prev) !== JSON.stringify(gt) ? gt : prev;
            });
            setChatBackgroundsState(prev => {
                return JSON.stringify(prev) !== JSON.stringify(cbs) ? cbs : prev;
            });
        });
    }, []);

    /**
     * Load an image from IndexedDB into the imageUrls map.
     * Calling this from event handlers and other non-effect locations is fine.
     * From effects: only call inside async callbacks (.then / await), never sync.
     */
    const loadImage = useCallback((id) => {
        if (!id || loadedIds.current.has(id)) return;
        loadedIds.current.add(id);
        if (id.startsWith('data:') || id.startsWith('http')) {
            // For data/http URLs, resolve on the next tick so we're not in render
            Promise.resolve(id).then(url =>
                setImageUrls(prev => ({ ...prev, [id]: url }))
            );
            return;
        }
        // IndexedDB load — inherently async, setState in .then() is fine
        imageStorage.getImage(id).then(base64 => {
            if (base64) setImageUrls(prev => ({ ...prev, [id]: base64 }));
        });
    }, []);

    // Load image for global theme whenever the config ID changes
    useEffect(() => {
        if (globalTheme?.type === 'custom' && globalTheme.value) {
            const id = globalTheme.value;
            // All setState calls happen inside async callbacks, not sync
            imageStorage.getImage(id).then(base64 => {
                if (base64 && !loadedIds.current.has(id)) {
                    loadedIds.current.add(id);
                    setImageUrls(prev => ({ ...prev, [id]: base64 }));
                } else if (id.startsWith('data:') || id.startsWith('http')) {
                    if (!loadedIds.current.has(id)) {
                        loadedIds.current.add(id);
                        setImageUrls(prev => ({ ...prev, [id]: id }));
                    }
                }
            });
        }
    }, [globalTheme?.type, globalTheme?.value]);

    // Load images for per-chat backgrounds
    useEffect(() => {
        const entries = Object.values(chatBackgrounds);
        entries.forEach(cfg => {
            if (cfg?.type !== 'custom' || !cfg.value) return;
            const id = cfg.value;
            if (loadedIds.current.has(id)) return;
            imageStorage.getImage(id).then(base64 => {
                if (base64) {
                    loadedIds.current.add(id);
                    setImageUrls(prev => ({ ...prev, [id]: base64 }));
                }
            });
        });
    }, [chatBackgrounds]);

    // Time-based auto-switch logic (checks every 60s)
    useEffect(() => {
        const checkTimeSwitch = () => {
            const hour = new Date().getHours();
            const isDay = hour >= 6 && hour < 18;

            if (globalTheme?.autoSwitch) {
                const targetValue = isDay ? globalTheme.dayValue : globalTheme.nightValue;
                if (targetValue && globalTheme.value !== targetValue) {
                    const next = { ...globalTheme, value: targetValue };
                    setGlobalThemeState(next);
                    storage.set('background:global-theme', next);
                }
            }
        };

        checkTimeSwitch();
        const interval = setInterval(checkTimeSwitch, 60_000);
        return () => clearInterval(interval);
        // Intentionally only depends on stable parts to avoid re-creating interval
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalTheme?.autoSwitch, globalTheme?.dayValue, globalTheme?.nightValue]);

    // Persist global theme
    const setGlobalTheme = useCallback((newConfig) => {
        setGlobalThemeState(newConfig);
        storage.set('background:global-theme', newConfig);
        // Fire-and-forget image load from event handler (not from an effect)
        if (newConfig?.type === 'custom' && newConfig.value) {
            loadImage(newConfig.value);
        }
    }, [loadImage]);

    // Persist chat backgrounds
    const setBackgroundForChat = useCallback((chatId, config) => {
        setChatBackgroundsState(prev => {
            const next = { ...prev, [chatId]: config };
            storage.set('background:chat-backgrounds', next);
            return next;
        });
        if (config?.type === 'custom' && config.value) {
            loadImage(config.value);
        }
    }, [loadImage]);

    /**
     * Save a custom image to IndexedDB and update config.
     * @param {string} base64 - The image data URL
     * @returns {string} The generated image ID
     */
    const saveCustomImage = useCallback(async (base64) => {
        const id = genId();
        await imageStorage.saveImage(id, base64);
        loadedIds.current.add(id);
        setImageUrls(prev => ({ ...prev, [id]: base64 }));
        return id;
    }, []);

    /**
     * Get the effective background for a specific chat.
     * Falls back to character default, then global theme.
     */
    const getBackgroundForChat = useCallback((chatId, personaId) => {
        if (chatId && chatBackgrounds[chatId]) {
            return chatBackgrounds[chatId];
        }

        if (personaId) {
            const persona = findPersonaById(personaId);
            if (persona?.defaultBackgroundId) {
                const allThemes = Object.values(BACKGROUND_THEMES).flat();
                const defaultTheme = allThemes.find(t => t.id === persona.defaultBackgroundId);

                if (defaultTheme) {
                    return {
                        type: 'preset',
                        value: defaultTheme.url,
                        blur: 0,
                        opacity: 0.6,
                        overlayColor: '#000000'
                    };
                }
            }
        }

        return globalTheme;
    }, [chatBackgrounds, globalTheme]);

    /**
     * Remove chat-specific background (revert to global)
     */
    const clearBackgroundForChat = useCallback((chatId) => {
        setChatBackgroundsState(prev => {
            const next = { ...prev };
            delete next[chatId];
            storage.set('background:chat-backgrounds', next);
            return next;
        });
    }, []);

    const value = {
        globalTheme,
        setGlobalTheme,
        chatBackgrounds,
        imageUrls,
        saveCustomImage,
        getBackgroundForChat,
        setBackgroundForChat,
        clearBackgroundForChat,
    };

    return (
        <BackgroundContext.Provider value={value}>
            {children}
        </BackgroundContext.Provider>
    );
};
