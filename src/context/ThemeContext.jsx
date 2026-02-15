import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { computeAccentPalette } from '../utils/colorUtils';

const ThemeContext = createContext();

// Trigger smooth theme transition with fallback
function withThemeTransition(applyFn) {
    const doc = document.documentElement;
    // Use View Transitions API if available
    if (document.startViewTransition) {
        document.startViewTransition(() => applyFn());
        return;
    }
    // Fallback: CSS class-based transition
    doc.classList.add('theme-transitioning');
    applyFn();
    const tid = setTimeout(() => doc.classList.remove('theme-transitioning'), 600);
    return () => clearTimeout(tid);
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};

// Chat background options
const CHAT_BACKGROUNDS = [
    { id: 'default', name: '默认', name_en: 'Default', value: null },
    { id: 'gradient_blue', name: '蓝色渐变', name_en: 'Blue Gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'gradient_pink', name: '粉色渐变', name_en: 'Pink Gradient', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { id: 'gradient_green', name: '绿色渐变', name_en: 'Green Gradient', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
    { id: 'gradient_sunset', name: '日落', name_en: 'Sunset', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    { id: 'gradient_ocean', name: '海洋', name_en: 'Ocean', value: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)' },
    { id: 'pattern_dots', name: '波点', name_en: 'Dots', value: 'radial-gradient(circle, #e0e0e0 1px, transparent 1px)', bgSize: '20px 20px' },
    { id: 'pattern_stars', name: '星空', name_en: 'Starry', value: 'linear-gradient(135deg, #0c1830 0%, #1a2a50 100%)' },
];

const DEFAULT_THEME = {
    mode: 'system', // 'light' | 'dark' | 'system'
    chatBackground: 'default',
    customBackground: null, // base64 image
    accentColor: null, // custom primary color
    animationIntensity: 'standard', // 'none' | 'subtle' | 'standard' | 'intense'
    bubbleStyle: 'rounded', // 'rounded' | 'square' | 'tail' | 'minimal'
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useLocalStorage('chat-buddy-theme', DEFAULT_THEME);

    // Track OS color scheme preference
    const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => setSystemPrefersDark(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    // Resolve effective mode: system → actual light/dark
    const resolvedMode = theme.mode === 'system'
        ? (systemPrefersDark ? 'dark' : 'light')
        : theme.mode;

    // Apply dark mode class to document with transition
    const prevMode = useRef(resolvedMode);
    useEffect(() => {
        const apply = () => {
            if (resolvedMode === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };
        // Only animate if mode actually changed (not on initial mount)
        if (prevMode.current !== resolvedMode) {
            withThemeTransition(apply);
        } else {
            apply();
        }
        prevMode.current = resolvedMode;
    }, [resolvedMode]);

    // Apply custom accent color (all 6 derived CSS vars)
    useEffect(() => {
        const el = document.documentElement;
        if (theme.accentColor) {
            const palette = computeAccentPalette(theme.accentColor);
            el.style.setProperty('--color-primary', palette.primary);
            el.style.setProperty('--color-primary-hover', palette.hover);
            el.style.setProperty('--color-primary-active', palette.active);
            el.style.setProperty('--color-primary-light', palette.light);
            el.style.setProperty('--color-primary-softer', palette.softer);
            el.style.setProperty('--color-primary-glow', palette.glow);
        } else {
            el.style.removeProperty('--color-primary');
            el.style.removeProperty('--color-primary-hover');
            el.style.removeProperty('--color-primary-active');
            el.style.removeProperty('--color-primary-light');
            el.style.removeProperty('--color-primary-softer');
            el.style.removeProperty('--color-primary-glow');
        }
    }, [theme.accentColor]);

    // Apply animation intensity class
    useEffect(() => {
        const doc = document.documentElement;
        doc.classList.remove('anim-none', 'anim-subtle', 'anim-standard', 'anim-intense');
        doc.classList.add(`anim-${theme.animationIntensity || 'standard'}`);
    }, [theme.animationIntensity]);

    // ========== Theme Mode ==========

    // Cycle: system → light → dark → system
    const toggleDarkMode = useCallback(() => {
        setTheme(prev => {
            const next = prev.mode === 'system' ? 'light'
                : prev.mode === 'light' ? 'dark' : 'system';
            return { ...prev, mode: next };
        });
    }, [setTheme]);

    const setDarkMode = useCallback((isDark) => {
        setTheme(prev => ({ ...prev, mode: isDark ? 'dark' : 'light' }));
    }, [setTheme]);

    // Set explicit mode: 'light' | 'dark' | 'system'
    const setThemeMode = useCallback((mode) => {
        setTheme(prev => ({ ...prev, mode }));
    }, [setTheme]);

    // ========== Chat Background ==========

    const setChatBackground = useCallback((backgroundId) => {
        setTheme(prev => ({ ...prev, chatBackground: backgroundId, customBackground: null }));
    }, [setTheme]);

    const setCustomBackground = useCallback((imageBase64) => {
        setTheme(prev => ({ ...prev, chatBackground: 'custom', customBackground: imageBase64 }));
    }, [setTheme]);

    const getChatBackgroundStyle = useCallback(() => {
        if (theme.chatBackground === 'custom' && theme.customBackground) {
            return {
                backgroundImage: `url(${theme.customBackground})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            };
        }

        const bg = CHAT_BACKGROUNDS.find(b => b.id === theme.chatBackground);
        if (!bg || !bg.value) return {};

        return {
            background: bg.value,
            backgroundSize: bg.bgSize || 'cover'
        };
    }, [theme.chatBackground, theme.customBackground]);

    // ========== Accent Color ==========

    const setAccentColor = useCallback((color) => {
        setTheme(prev => ({ ...prev, accentColor: color }));
    }, [setTheme]);

    const resetAccentColor = useCallback(() => {
        setTheme(prev => ({ ...prev, accentColor: null }));
    }, [setTheme]);

    // ========== Animation & Bubble Style ==========

    const setAnimationIntensity = useCallback((intensity) => {
        setTheme(prev => ({ ...prev, animationIntensity: intensity }));
    }, [setTheme]);

    const setBubbleStyle = useCallback((style) => {
        setTheme(prev => ({ ...prev, bubbleStyle: style }));
    }, [setTheme]);

    const value = {
        // Current theme
        theme,
        isDarkMode: resolvedMode === 'dark',
        themeMode: theme.mode, // raw: 'light' | 'dark' | 'system'
        resolvedMode,          // effective: 'light' | 'dark'

        // Theme mode
        toggleDarkMode,
        setDarkMode,
        setThemeMode,

        // Backgrounds
        chatBackgrounds: CHAT_BACKGROUNDS,
        setChatBackground,
        setCustomBackground,
        getChatBackgroundStyle,

        // Accent color
        setAccentColor,
        resetAccentColor,

        // Animation & bubble
        animationIntensity: theme.animationIntensity || 'standard',
        setAnimationIntensity,
        bubbleStyle: theme.bubbleStyle || 'rounded',
        setBubbleStyle,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
