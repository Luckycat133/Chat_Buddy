import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocalStorage } from '../../../hooks/useLocalStorage';

const MomentsStateContext = createContext();

const DEFAULT_MOMENTS_DATA = {
    posts: [],
    lastAIPostTime: {},
    imageApiUrl: '',
    draft: null,
    lastStoryEventDate: null,
};

// eslint-disable-next-line react-refresh/only-export-components
export const useMomentsState = () => {
    const context = useContext(MomentsStateContext);
    if (!context) throw new Error('useMomentsState must be used within a MomentsProvider');
    return context;
};

export const MomentsStateProvider = ({ children }) => {
    const [momentsData, setMomentsData] = useLocalStorage('chat-buddy-moments', DEFAULT_MOMENTS_DATA);
    const [imageApiKey, setImageApiKey] = useState('');

    useEffect(() => {
        if (!Object.hasOwn(momentsData, 'imageApiKey')) return;
        setMomentsData(({ imageApiKey: _legacyKey, ...rest }) => rest);
    }, [momentsData, setMomentsData]);

    // Refs for intervals (moved here or staying in provider? If logic is extracted, refs might be needed in the logic hook)
    // Actually, the main provider (Facade) will hold the AI logic which uses these refs.
    // But the refs themselves are not really "State" that consumers need.
    // Consumers just need `posts` etc.

    // We will expose setters here so ActionProvider can use them.

    const value = {
        momentsData,
        setMomentsData,
        posts: momentsData.posts || [],
        lastAIPostTime: momentsData.lastAIPostTime || {},
        imageApiKey,
        setImageApiKey,
        imageApiUrl: momentsData.imageApiUrl,
        draft: momentsData.draft || null,
        lastStoryEventDate: momentsData.lastStoryEventDate || null,
    };

    return (
        <MomentsStateContext.Provider value={value}>
            {children}
        </MomentsStateContext.Provider>
    );
};
