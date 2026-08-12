import React, { createContext, useContext, useMemo, useCallback, useEffect } from 'react';
import { LOCALES } from '../data/locales';
import { useLocalStorage } from '../hooks/useLocalStorage';

const LanguageContext = createContext();

/**
 * Detect browser language, returning 'zh' if Chinese, 'en' otherwise.
 */
function detectBrowserLanguage() {
    try {
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        return browserLang.startsWith('zh') ? 'zh' : 'en';
    } catch (e) {
        console.warn('[LanguageContext] Browser language detection failed:', e?.message);
        return 'en';
    }
}

// Sentinel value: if localStorage has no saved language, use browser detection
const LANG_NOT_SET = '__not_set__';

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};

export const LanguageProvider = ({ children }) => {
    const [storedLang, setStoredLang] = useLocalStorage('chat-buddy-lang', LANG_NOT_SET);
    const [aiLanguage, setAiLanguage] = useLocalStorage('chat-buddy-ai-lang', 'auto');

    // Resolve actual UI language: browser detection on first visit, stored preference thereafter
    const language = storedLang === LANG_NOT_SET ? detectBrowserLanguage() : storedLang;

    useEffect(() => {
        document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    }, [language]);

    // When user explicitly sets language, persist it
    const setLanguage = useCallback((lang) => {
        setStoredLang(lang);
    }, [setStoredLang]);

    const toggleLanguage = useCallback(() => {
        setStoredLang(language === 'en' ? 'zh' : 'en');
    }, [language, setStoredLang]);

    /**
     * Translation helper with optional parameter interpolation.
     * Usage:
     *   t('hello')                          → "Hello"
     *   t('send_gift_to', { name: 'Luna' }) → "Send gift to Luna"
     *
     * Template syntax in locale strings: {name}, {count}, etc.
     */
    const t = useCallback((key, params) => {
        const template = (LOCALES[language] && LOCALES[language][key]) || key;
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
    }, [language]);

    /**
     * Resolve AI conversation language.
     * 'auto' = same as UI language.
     */
    const resolvedAiLanguage = aiLanguage === 'auto' ? language : aiLanguage;

    const value = useMemo(() => ({
        language,
        setLanguage,
        toggleLanguage,
        t,
        aiLanguage,
        setAiLanguage,
        resolvedAiLanguage,
    }), [language, setLanguage, toggleLanguage, t, aiLanguage, setAiLanguage, resolvedAiLanguage]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};
