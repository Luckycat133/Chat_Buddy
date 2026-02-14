import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const NotificationContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotification must be used within a NotificationProvider');
    return context;
};

// Default notification settings
const DEFAULT_SETTINGS = {
    soundEnabled: true,
    doNotDisturb: false,
    browserPush: false,
    soundVolume: 0.5
};

export const NotificationProvider = ({ children }) => {
    const [settings, setSettings] = useLocalStorage('chat-buddy-notification-settings', DEFAULT_SETTINGS);
    const [unreadCounts, setUnreadCounts] = useLocalStorage('chat-buddy-unread-counts', {}); // { chatId: count }
    const audioRef = useRef(null);

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio();
        audioRef.current.src = '/sounds/notification.mp3';
        audioRef.current.volume = settings.soundVolume;

        // Request browser push permission if enabled
        if (settings.browserPush && 'Notification' in window) {
            Notification.requestPermission();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update audio volume when settings change
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = settings.soundVolume;
        }
    }, [settings.soundVolume]);

    // ========== Sound Notifications ==========

    const playNotificationSound = useCallback(() => {
        if (!settings.soundEnabled || settings.doNotDisturb) return;

        try {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {
                    // Browser may block autoplay, ignore error
                });
            }
        } catch {
            // Fallback: create new audio instance
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = settings.soundVolume;
            audio.play().catch(() => { });
        }
    }, [settings.soundEnabled, settings.doNotDisturb, settings.soundVolume]);

    // ========== Browser Push Notifications ==========

    const showBrowserNotification = useCallback((title, body, options = {}) => {
        if (!settings.browserPush || settings.doNotDisturb) return;
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        try {
            const notification = new Notification(title, {
                body,
                icon: '/logo.png',
                badge: '/logo.png',
                tag: options.chatId || 'chat-buddy',
                ...options
            });

            notification.onclick = () => {
                window.focus();
                if (options.onClick) options.onClick();
                notification.close();
            };

            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
        } catch (e) {
            console.error('Failed to show notification:', e);
        }
    }, [settings.browserPush, settings.doNotDisturb]);

    // ========== Unread Counts ==========

    const incrementUnread = useCallback((chatId) => {
        setUnreadCounts(prev => ({
            ...prev,
            [chatId]: (prev[chatId] || 0) + 1
        }));
    }, [setUnreadCounts]);

    const clearUnread = useCallback((chatId) => {
        setUnreadCounts(prev => ({
            ...prev,
            [chatId]: 0
        }));
    }, [setUnreadCounts]);

    const markChatUnread = useCallback((chatId) => {
        setUnreadCounts(prev => ({
            ...prev,
            [chatId]: Math.max(prev[chatId] || 0, 1)
        }));
    }, [setUnreadCounts]);

    const getTotalUnread = useCallback(() => {
        return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    }, [unreadCounts]);

    const getUnreadCount = useCallback((chatId) => {
        return unreadCounts[chatId] || 0;
    }, [unreadCounts]);

    // ========== Settings Management ==========

    const updateSettings = useCallback((updates) => {
        setSettings(prev => ({ ...prev, ...updates }));
    }, [setSettings]);

    const toggleSound = useCallback(() => {
        setSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }));
    }, [setSettings]);

    const toggleDoNotDisturb = useCallback(() => {
        setSettings(prev => ({ ...prev, doNotDisturb: !prev.doNotDisturb }));
    }, [setSettings]);

    const toggleBrowserPush = useCallback(async () => {
        if (!settings.browserPush) {
            // Enable - request permission first
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    setSettings(prev => ({ ...prev, browserPush: true }));
                }
            }
        } else {
            setSettings(prev => ({ ...prev, browserPush: false }));
        }
    }, [settings.browserPush, setSettings]);

    // ========== Combined Notification ==========

    const notify = useCallback((chatId, title, body, options = {}) => {
        if (settings.doNotDisturb) return;

        // Play sound
        playNotificationSound();

        // Update unread count
        incrementUnread(chatId);

        // Show browser notification if page is not visible
        if (document.hidden && settings.browserPush) {
            showBrowserNotification(title, body, { chatId, ...options });
        }
    }, [settings.doNotDisturb, settings.browserPush, playNotificationSound, incrementUnread, showBrowserNotification]);

    const value = {
        // Settings
        settings,
        updateSettings,
        toggleSound,
        toggleDoNotDisturb,
        toggleBrowserPush,

        // Notifications
        playNotificationSound,
        showBrowserNotification,
        notify,

        // Unread
        unreadCounts,
        incrementUnread,
        clearUnread,
        markChatUnread,
        getTotalUnread,
        getUnreadCount
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};
