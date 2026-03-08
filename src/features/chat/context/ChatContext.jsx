import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useChatService } from '../hooks/useChatService';
import { useSocial } from '../../../context/SocialContext';
import { useLanguage } from '../../../context/LanguageContext';
import { chatEngine } from '../../../core/chat/ChatEngine';

// Facade Context for backward compatibility
const ChatContext = createContext();

// Legacy Contexts compatibility
// Some components might import these separately
// eslint-disable-next-line react-refresh/only-export-components
export const ChatStateContext = createContext();
// eslint-disable-next-line react-refresh/only-export-components
export const ChatActionContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useChat = () => {
    return useContext(ChatContext);
};

// Legacy hooks support
// eslint-disable-next-line react-refresh/only-export-components
export const useChatState = () => useContext(ChatStateContext);
// eslint-disable-next-line react-refresh/only-export-components
export const useChatActions = () => useContext(ChatActionContext);


export const ChatProvider = ({ children }) => {
    // Wiring the new Service
    const service = useChatService();
    const { addChatIntimacy, getIntimacyLevel, getIntimacy } = useSocial();
    const { resolvedAiLanguage, language } = useLanguage();

    // Compatibility Refs (some old components might rely on refs for async closures)
    // We mock them or link them to current state if absolutely necessary
    const scheduledMessagesRef = useRef(new Map());
    const chatsRef = useRef(service.chats);

    useEffect(() => {
        chatsRef.current = service.chats;
    }, [service.chats]);

    // T06: Bridge ChatEngine → SocialContext for chat-based affinity gain
    useEffect(() => {
        const unregister = chatEngine.registerOnUserMessage((_chatId, aiIds) => {
            aiIds.forEach(id => addChatIntimacy(id));
        });
        return unregister;
    }, [addChatIntimacy]);

    // T06: Provide affinity/mood context to ChatEngine for AI prompts
    // Use a ref to avoid stale closures
    const getIntimacyLevelRef = useRef(getIntimacyLevel);
    const getIntimacyRef = useRef(getIntimacy);
    const moodMapRef = useRef(service.moodMap);
    const aiLanguageRef = useRef(resolvedAiLanguage);
    const uiLanguageRef = useRef(language);
    useEffect(() => {
        getIntimacyLevelRef.current = getIntimacyLevel;
        getIntimacyRef.current = getIntimacy;
        moodMapRef.current = service.moodMap;
        aiLanguageRef.current = resolvedAiLanguage;
        uiLanguageRef.current = language;
    }, [getIntimacyLevel, getIntimacy, service.moodMap, resolvedAiLanguage, language]);

    const contextProviderFn = useCallback((personaId) => {
        const levelData = getIntimacyLevelRef.current(personaId);
        return {
            intimacyLevel: levelData.level,
            intimacyScore: getIntimacyRef.current(personaId),
            mood: moodMapRef.current?.[personaId] || null,
            preferredLanguage: aiLanguageRef.current || 'zh',
            uiLanguage: uiLanguageRef.current || 'zh',
        };
    }, []);

    useEffect(() => {
        chatEngine.setContextProvider(contextProviderFn);
    }, [contextProviderFn]);

    // Construct the "Legacy" context shape
    // The old context exposed: { ...state, ...actions } mixed together
    // Our service does exactly that, so we can pass it directly.
    const contextValue = {
        ...service,
        // Legacy props that were part of state providers
        chatsRef,
        scheduledMessagesRef
    };

    return (
        <ChatContext.Provider value={contextValue}>
            <ChatStateContext.Provider value={contextValue}>
                <ChatActionContext.Provider value={contextValue}>
                    {children}
                </ChatActionContext.Provider>
            </ChatStateContext.Provider>
        </ChatContext.Provider>
    );
};
