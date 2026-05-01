import { useSyncExternalStore, useMemo, useCallback, useEffect, useRef } from 'react';
import { chatEngine } from '../../../core/chat/ChatEngine';
import { getAllPersonas } from '../../../data/personas';
import { memoryStore } from '../../../core/memory/MemoryStore';

// Cached snapshot for useSyncExternalStore
// React 19 requires stable references from getSnapshot - cache and only update when state actually changes
let _cached = null;
let _prev = null;

function getSnapshot() {
    const next = chatEngine.getState();

    // Only create a new reference when something actually changed
    if (!_prev ||
        _prev.chats !== next.chats ||
        JSON.stringify(_prev.typingIndicators) !== JSON.stringify(next.typingIndicators) ||
        JSON.stringify(_prev.editingIndicators) !== JSON.stringify(next.editingIndicators) ||
        JSON.stringify(_prev.presenceMap) !== JSON.stringify(next.presenceMap) ||
        JSON.stringify(_prev.moodMap) !== JSON.stringify(next.moodMap)
    ) {
        _prev = next;
        _cached = next;
    }
    return _cached;
}

// Helper to force cache refresh externally (e.g., when typing indicators change)
export function refreshChatSnapshot() {
    _prev = null; // Force next call to return fresh state
}

function getServerSnapshot() {
    return {
        chats: [],
        typingIndicators: {},
        editingIndicators: {},
        presenceMap: {},
        moodMap: {},
    };
}

function subscribe(callback) {
    return chatEngine.subscribe(callback);
}

export function useChatService() {
    const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const allPersonas = useMemo(() => getAllPersonas(), []);
    const initDoneRef = useRef(false);

    useEffect(() => {
        if (!initDoneRef.current) {
            initDoneRef.current = true;
            chatEngine.init(allPersonas);
            memoryStore.applyDecay().catch(() => {});
        }
    }, [allPersonas]);

    const sendMessage = useCallback((chatId, content, quotedId) => chatEngine.sendMessage(chatId, content, 'user-me', quotedId), []);
    const deleteMessage = useCallback((chatId, msgId) => chatEngine.deleteMessage(chatId, msgId), []);
    const createChat = useCallback((name, pIds, avatar) => chatEngine.createChat(name, pIds, avatar), []);
    const addPersona = useCallback((persona) => chatEngine.addPersona(persona), []);
    const removePersona = useCallback((personaId) => chatEngine.removePersona(personaId), []);
    const triggerGreeting = useCallback((chatId, msg, pId) => chatEngine.triggerGreeting(chatId, msg, pId), []);
    const updateChat = useCallback((chatId, updates) => chatEngine.updateChat(chatId, updates), []);
    const pinChat = useCallback((chatId, isPinned) => chatEngine.pinChat(chatId, isPinned), []);
    const markChatUnread = useCallback((chatId, isUnread) => chatEngine.markChatUnread(chatId, isUnread), []);
    const deleteChat = useCallback((chatId) => chatEngine.deleteChat(chatId), []);
    const clearChatMessages = useCallback((chatId) => chatEngine.clearChatMessages(chatId), []);
    const pinMessage = useCallback((chatId, msgId, isPinned) => chatEngine.pinMessage(chatId, msgId, isPinned), []);
    const votePoll = useCallback((chatId, pollId, optionId, action) => chatEngine.votePoll(chatId, pollId, optionId, action), []);
    const bookmarkMessage = useCallback((chatId, msgId) => chatEngine.bookmarkMessage(chatId, msgId), []);
    const unbookmarkMessage = useCallback((msgId) => chatEngine.unbookmarkMessage(msgId), []);
    const getBookmarkedMessages = useCallback(() => chatEngine.getBookmarkedMessages(), []);
    const isMessageBookmarked = useCallback((msgId) => chatEngine.isMessageBookmarked(msgId), []);
    const markMessagesAsRead = useCallback((chatId, readerId) => chatEngine.markMessagesAsRead(chatId, readerId), []);
    const getMessageReadStatus = useCallback((msgId, chatId) => chatEngine.getMessageReadStatus(msgId, chatId), []);

    return {
        chats: state.chats,
        typingIndicators: state.typingIndicators,
        editingIndicators: state.editingIndicators || {},
        presenceMap: state.presenceMap || {},
        moodMap: state.moodMap || {},
        personas: allPersonas,
        currentUser: { id: 'user-me', name: 'You', avatar: null },

        sendMessage,
        deleteMessage,
        createChat,
        addPersona,
        removePersona,
        triggerGreeting,

        setChats: () => console.warn('setChats deprecated'),
        updateChat,
        pinChat,
        markChatUnread,
        deleteChat,
        clearChatMessages,
        pinMessage,
        votePoll,

        bookmarkMessage,
        unbookmarkMessage,
        getBookmarkedMessages,
        isMessageBookmarked,

        markMessagesAsRead,
        getMessageReadStatus,

        engine: chatEngine,
    };
}
