import React, { createContext, useContext } from 'react';
import { LOCALES } from '../data/locales';
import { useLocalStorage } from '../hooks/useLocalStorage';

const LanguageContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};

export const LanguageProvider = ({ children }) => {
    // Default to English or browser preference, but let's stick to 'en' default for simplicity unless persisted
    const [language, setLanguage] = useLocalStorage('chat-buddy-lang', 'en');

    // Toggle function
    const toggleLanguage = () => {
        setLanguage(prev => prev === 'en' ? 'zh' : 'en');
    };

    // Translation helper
    const t = (key) => {
        return LOCALES[language][key] || key;
    };

    const value = {
        language,
        setLanguage,
        toggleLanguage,
        t
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};
