import React from 'react';
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
import { ToastProvider } from '../components/ToastProvider';

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
                                                    <ToastProvider>
                                                        {children}
                                                    </ToastProvider>
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
