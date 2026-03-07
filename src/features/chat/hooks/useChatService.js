import { useState, useEffect } from 'react';
import { chatEngine } from '../../../core/chat/ChatEngine';
import { getAllPersonas } from '../../../data/personas';
import { memoryStore } from '../../../core/memory/MemoryStore'; // T12: Decay on startup

/**
 * Application Layer: Chat Service Hook
 * Connects the React View to the Domain ChatEngine.
 * 
 * Responsibilities:
 * - Initialize Engine
 * - Subscribe to Engine updates
 * - Expose Engine methods
 */
export function useChatService() {
    const [state, setState] = useState({
        chats: [],
        typingIndicators: {},
        editingIndicators: {},
        presenceMap: {},
        moodMap: {}
    });

    // Use ALL personas for the full list
    const allPersonas = getAllPersonas();

    useEffect(() => {
        // Initialize engine with ALL personas (includes Task Agents)
        chatEngine.init(allPersonas);

        // T12: Apply memory decay on startup (fire-and-forget)
        memoryStore.applyDecay().catch(() => { });

        // Subscribe to updates
        const unsubscribe = chatEngine.subscribe((newState) => {
            setState(newState);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    return {
        chats: state.chats,
        typingIndicators: state.typingIndicators,
        editingIndicators: state?.editingIndicators || {}, // Phase 3: Expose editing state
        presenceMap: state?.presenceMap || {}, // T05: Expose presence
        moodMap: state?.moodMap || {},          // T06: Expose moods
        personas: allPersonas, // Includes ALL personas
        currentUser: { id: 'user-me', name: 'You', avatar: null },

        // Actions
        sendMessage: (chatId, content, quotedId) => chatEngine.sendMessage(chatId, content, 'user-me', quotedId),
        deleteMessage: (chatId, msgId) => chatEngine.deleteMessage(chatId, msgId),
        createChat: (name, pIds, avatar) => chatEngine.createChat(name, pIds, avatar),
        addPersona: (persona) => chatEngine.addPersona(persona),
        removePersona: (personaId) => chatEngine.removePersona(personaId),
        triggerGreeting: (chatId, msg, pId) => chatEngine.triggerGreeting(chatId, msg, pId), // T05: Exposed for debugging/testing

        // Legacy Parity
        setChats: () => console.warn('setChats deprecated'),
        updateChat: (chatId, updates) => chatEngine.updateChat(chatId, updates),
        pinChat: (chatId, isPinned) => chatEngine.pinChat(chatId, isPinned),
        markChatUnread: (chatId, isUnread) => chatEngine.markChatUnread(chatId, isUnread),
        deleteChat: (chatId) => chatEngine.deleteChat(chatId),
        clearChatMessages: (chatId) => chatEngine.clearChatMessages(chatId),
        pinMessage: (chatId, msgId, isPinned) => chatEngine.pinMessage(chatId, msgId, isPinned),
        votePoll: (chatId, pollId, optionId, action) => chatEngine.votePoll(chatId, pollId, optionId, action),

        // T07: Message Bookmarks
        bookmarkMessage: (chatId, msgId) => chatEngine.bookmarkMessage(chatId, msgId),
        unbookmarkMessage: (msgId) => chatEngine.unbookmarkMessage(msgId),
        getBookmarkedMessages: () => chatEngine.getBookmarkedMessages(),
        isMessageBookmarked: (msgId) => chatEngine.isMessageBookmarked(msgId),

        // T07: Read Receipts
        markMessagesAsRead: (chatId, readerId) => chatEngine.markMessagesAsRead(chatId, readerId),
        getMessageReadStatus: (msgId, chatId) => chatEngine.getMessageReadStatus(msgId, chatId),

        engine: chatEngine
    };
}
