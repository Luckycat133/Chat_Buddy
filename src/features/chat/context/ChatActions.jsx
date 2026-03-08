import React, { createContext, useContext, useCallback } from 'react';

const ChatActionContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useChatActions = () => {
    const context = useContext(ChatActionContext);
    if (!context) throw new Error('useChatActions must be used within a ChatProvider');
    return context;
};

export const ChatActionProvider = ({ children, setChats, scheduledMessagesRef }) => {

    // Logic: Send Message
    const sendMessage = useCallback((chatId, content, senderId = 'user-me') => {
        // Cancel any scheduled proactive messages when user sends a message
        if (scheduledMessagesRef.current) {
            scheduledMessagesRef.current.forEach((timeoutId, key) => {
                if (key.startsWith(chatId)) {
                    clearTimeout(timeoutId);
                    scheduledMessagesRef.current.delete(key);
                }
            });
        }

        setChats(prevChats => prevChats.map(chat => {
            if (chat.id !== chatId) return chat;

            const newMessage = {
                id: crypto.randomUUID(),
                senderId,
                content,
                timestamp: new Date().toISOString(),
                status: 'sent'
            };

            return {
                ...chat,
                messages: [...chat.messages, newMessage],
                lastMessage: newMessage
            };
        }));
    }, [setChats, scheduledMessagesRef]);

    // Logic: Create Chat
    const createChat = useCallback((name, selectedPersonaIds) => {
        const newChat = {
            id: crypto.randomUUID(),
            name,
            participants: ['user-me', ...selectedPersonaIds],
            messages: [],
            createdAt: new Date().toISOString()
        };
        setChats(prev => [newChat, ...prev]);
        return newChat.id;
    }, [setChats]);

    // Logic: Update Chat
    const updateChat = useCallback((chatId, updates) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, ...updates } : chat
        ));
    }, [setChats]);

    // Logic: Delete Chat
    const deleteChat = useCallback((id) => {
        // Clear scheduled messages for this chat
        if (scheduledMessagesRef.current) {
            scheduledMessagesRef.current.forEach((timeoutId, key) => {
                if (key.startsWith(id)) {
                    clearTimeout(timeoutId);
                    scheduledMessagesRef.current.delete(key);
                }
            });
        }
        setChats(prev => prev.filter(c => c.id !== id));
    }, [setChats, scheduledMessagesRef]);

    // Logic: Delete/Recall Message
    const deleteMessage = useCallback((chatId, messageId) => {
        setChats(prev => prev.map(chat => {
            if (chat.id !== chatId) return chat;
            const updatedMessages = chat.messages.filter(m => m.id !== messageId);
            return {
                ...chat,
                messages: updatedMessages,
                lastMessage: updatedMessages[updatedMessages.length - 1] || null
            };
        }));
    }, [setChats]);

    // Logic: Clear Chat History
    const clearChatMessages = useCallback((chatId) => {
        setChats(prev => prev.map(chat => {
            if (chat.id !== chatId) return chat;
            return {
                ...chat,
                messages: [],
                lastMessage: null,
                pinnedMessages: []
            };
        }));
    }, [setChats]);

    // Logic: Pin/Unpin Chat
    const pinChat = useCallback((chatId, isPinned) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, isPinned } : chat
        ));
    }, [setChats]);

    // Logic: Mark Chat as Unread
    const markChatUnread = useCallback((chatId, isUnread = true) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, isUnread } : chat
        ));
    }, [setChats]);

    // Logic: Set Chat Category
    const setChatCategory = useCallback((chatId, category) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, category } : chat
        ));
    }, [setChats]);

    // Logic: Pin/Unpin Message
    const pinMessage = useCallback((chatId, messageId, isPinned = true) => {
        setChats(prev => prev.map(chat => {
            if (chat.id !== chatId) return chat;
            const pinnedMessages = chat.pinnedMessages || [];
            if (isPinned && !pinnedMessages.includes(messageId)) {
                return { ...chat, pinnedMessages: [...pinnedMessages, messageId] };
            } else if (!isPinned) {
                return { ...chat, pinnedMessages: pinnedMessages.filter(id => id !== messageId) };
            }
            return chat;
        }));
    }, [setChats]);

    // Logic: Vote on Poll
    const votePoll = useCallback((chatId, pollId, optionId) => {
        setChats(prev => prev.map(chat => {
            if (chat.id !== chatId) return chat;
            const polls = chat.polls || [];
            const pollIndex = polls.findIndex(p => p.id === pollId);
            if (pollIndex === -1) return chat;

            const poll = { ...polls[pollIndex] };
            const userId = 'user-me';

            if (poll.isMultiChoice) {
                const newOptions = poll.options.map(opt => {
                    if (opt.id === optionId) {
                        const votes = opt.votes || [];
                        if (votes.includes(userId)) {
                            return { ...opt, votes: votes.filter(id => id !== userId) };
                        } else {
                            return { ...opt, votes: [...votes, userId] };
                        }
                    }
                    return opt;
                });
                poll.options = newOptions;

            } else {
                const newOptions = poll.options.map(opt => {
                    const votes = opt.votes || [];
                    if (opt.id === optionId) {
                        if (!votes.includes(userId)) {
                            return { ...opt, votes: [...votes, userId] };
                        }
                        return opt;
                    } else {
                        return { ...opt, votes: votes.filter(id => id !== userId) };
                    }
                });
                poll.options = newOptions;
            }

            const newPolls = [...polls];
            newPolls[pollIndex] = poll;
            return { ...chat, polls: newPolls };
        }));
    }, [setChats]);

    const value = {
        sendMessage,
        createChat,
        updateChat,
        deleteChat,
        deleteMessage,
        clearChatMessages,
        pinChat,
        markChatUnread,
        setChatCategory,
        pinMessage,
        votePoll
    };

    return (
        <ChatActionContext.Provider value={value}>
            {children}
        </ChatActionContext.Provider>
    );
};
