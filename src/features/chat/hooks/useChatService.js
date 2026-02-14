import { useState, useEffect } from 'react';
import { chatEngine } from '../../../core/chat/ChatEngine';
import { INITIAL_PERSONAS, getAllPersonas } from '../../../data/personas';

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
        typingIndicators: {}
    });

    // Use ALL personas for the full list
    const allPersonas = getAllPersonas();

    useEffect(() => {
        // Initialize engine with ALL personas (includes Task Agents)
        chatEngine.init(allPersonas);

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
        personas: allPersonas, // Includes ALL personas
        currentUser: { id: 'user-me', name: 'You', avatar: null },

        // Actions
        sendMessage: (chatId, content, quotedId) => chatEngine.sendMessage(chatId, content, 'user-me', quotedId),
        deleteMessage: (chatId, msgId) => chatEngine.deleteMessage(chatId, msgId),
        createChat: (name, pIds, avatar) => chatEngine.createChat(name, pIds, avatar),

        // Legacy Parity
        setChats: () => console.warn('setChats deprecated'),
        updateChat: (chatId, updates) => chatEngine.updateChat(chatId, updates),
        pinMessage: (chatId, msgId, isPinned) => chatEngine.pinMessage(chatId, msgId, isPinned),
        votePoll: (chatId, pollId, optionId) => chatEngine.votePoll(chatId, pollId, optionId),

        engine: chatEngine
    };
}
