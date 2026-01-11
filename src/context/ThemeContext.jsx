import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const ThemeContext = createContext();

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
    mode: 'light', // 'light' | 'dark'
    chatBackground: 'default',
    customBackground: null, // base64 image
    accentColor: null // custom primary color
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useLocalStorage('chat-buddy-theme', DEFAULT_THEME);

    // Apply dark mode class to document
    useEffect(() => {
        if (theme.mode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme.mode]);

    // Apply custom accent color
    useEffect(() => {
        if (theme.accentColor) {
            document.documentElement.style.setProperty('--color-primary', theme.accentColor);
        } else {
            document.documentElement.style.removeProperty('--color-primary');
        }
    }, [theme.accentColor]);

    // ========== Theme Mode ==========

    const toggleDarkMode = useCallback(() => {
        setTheme(prev => ({
            ...prev,
            mode: prev.mode === 'dark' ? 'light' : 'dark'
        }));
    }, [setTheme]);

    const setDarkMode = useCallback((isDark) => {
        setTheme(prev => ({ ...prev, mode: isDark ? 'dark' : 'light' }));
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

    const value = {
        // Current theme
        theme,
        isDarkMode: theme.mode === 'dark',

        // Theme mode
        toggleDarkMode,
        setDarkMode,

        // Backgrounds
        chatBackgrounds: CHAT_BACKGROUNDS,
        setChatBackground,
        setCustomBackground,
        getChatBackgroundStyle,

        // Accent color
        setAccentColor,
        resetAccentColor
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
