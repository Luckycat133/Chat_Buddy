import React from 'react';

// Context Imports
import { ChatProvider } from '../features/chat/context/ChatContext';
import { BackgroundProvider } from '../features/background/BackgroundContext';
import { LanguageProvider } from '../context/LanguageContext';
import { DocumentProvider } from '../context/DocumentContext';
import { UserProvider } from '../context/UserContext';
import { FriendProvider } from '../context/FriendContext';
import { MomentsProvider } from '../features/moments/context/MomentsContext';
import { NotificationProvider } from '../context/NotificationContext';
import { SocialProvider } from '../context/SocialContext';
import { ThemeProvider } from '../context/ThemeContext';
import { StickerProvider } from '../context/StickerContext';

/**
 * AppProviders Component
 * Composes all global context providers in the correct order.
 * Reducing "Provider Hell" in the main App component.
 */
export default function AppProviders({ children }) {
    return (
        <LanguageProvider>
            <ThemeProvider>
                <NotificationProvider>
                    <SocialProvider>
                        <StickerProvider>
                            <DocumentProvider>
                                <UserProvider>
                                    <FriendProvider>
                                        <MomentsProvider>
                                            <ChatProvider>
                                                <BackgroundProvider>
                                                    {children}
                                                </BackgroundProvider>
                                            </ChatProvider>
                                        </MomentsProvider>
                                    </FriendProvider>
                                </UserProvider>
                            </DocumentProvider>
                        </StickerProvider>
                    </SocialProvider>
                </NotificationProvider>
            </ThemeProvider>
        </LanguageProvider>
    );
}
