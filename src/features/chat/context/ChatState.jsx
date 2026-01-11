import React, { createContext, useContext } from 'react';

const ChatStateContext = createContext();

// Export for use in ChatContext.jsx
export { ChatStateContext };

// eslint-disable-next-line react-refresh/only-export-components
export const useChatState = () => {
    const context = useContext(ChatStateContext);
    if (!context) throw new Error('useChatState must be used within a ChatProvider');
    return context;
};

export const ChatStateProvider = ({ children, chats, personas, currentUser, typingIndicators }) => {
    return (
        <ChatStateContext.Provider value={{ chats, personas, currentUser, typingIndicators }}>
            {children}
        </ChatStateContext.Provider>
    );
};
