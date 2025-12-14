import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const UserContext = createContext();

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error('useUser must be used within a UserProvider');
    return context;
};

const DEFAULT_PROFILE = {
    id: 'user-me',
    nickname: '',
    avatar: null,
    signature: '',
    createdAt: new Date().toISOString()
};

export const UserProvider = ({ children }) => {
    const [userProfile, setUserProfile] = useLocalStorage('chat-buddy-user-profile', DEFAULT_PROFILE);

    // Update nickname
    const updateNickname = useCallback((nickname) => {
        setUserProfile(prev => ({
            ...prev,
            nickname: nickname.trim().slice(0, 20) // Max 20 chars
        }));
    }, [setUserProfile]);

    // Update avatar (path or base64 data URL)
    const updateAvatar = useCallback((avatar) => {
        setUserProfile(prev => ({
            ...prev,
            avatar
        }));
    }, [setUserProfile]);

    // Update signature/status
    const updateSignature = useCallback((signature) => {
        setUserProfile(prev => ({
            ...prev,
            signature: signature.slice(0, 100) // Max 100 chars
        }));
    }, [setUserProfile]);

    // Reset profile to defaults
    const resetProfile = useCallback(() => {
        setUserProfile({
            ...DEFAULT_PROFILE,
            createdAt: new Date().toISOString()
        });
    }, [setUserProfile]);

    // Get display name (nickname or default)
    const getDisplayName = useCallback((language = 'en') => {
        if (userProfile.nickname) return userProfile.nickname;
        return language === 'zh' ? '你' : 'You';
    }, [userProfile.nickname]);

    const value = {
        userProfile,
        updateNickname,
        updateAvatar,
        updateSignature,
        resetProfile,
        getDisplayName
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};
