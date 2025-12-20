import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChatProvider } from './context/ChatContext';
import { LanguageProvider } from './context/LanguageContext';
import { DocumentProvider } from './context/DocumentContext';
import { UserProvider } from './context/UserContext';
import { FriendProvider } from './context/FriendContext';
import { MomentsProvider } from './context/MomentsContext';
import { NotificationProvider } from './context/NotificationContext';
import { SocialProvider } from './context/SocialContext';
import { ThemeProvider } from './context/ThemeContext';
import { StickerProvider } from './context/StickerContext';
import Layout from './components/Layout';
// Pages
import ChatList from './pages/ChatList';
import ChatWindow from './pages/ChatWindow';
import CreateChat from './pages/CreateChat';
import GroupDetails from './pages/GroupDetails';
import Settings from './pages/Settings';
import Help from './pages/Help';
import About from './pages/About';
import UserProfile from './pages/UserProfile';
import ProfileEditor from './pages/ProfileEditor';
import FriendsPage from './pages/FriendsPage';
import FriendGroups from './pages/FriendGroups';
import MomentsPage from './pages/MomentsPage';
import AchievementsPage from './pages/AchievementsPage';

export default function App() {
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
                        <Router>
                          <Routes>
                            <Route path="/" element={<Layout />}>
                              <Route index element={<ChatList />} />
                              <Route path="chat/:id" element={<ChatWindow />} />
                              <Route path="chat/:id/details" element={<GroupDetails />} />
                              <Route path="create" element={<CreateChat />} />
                              <Route path="friends" element={<FriendsPage />} />
                              <Route path="friends/groups" element={<FriendGroups />} />
                              <Route path="moments" element={<MomentsPage />} />
                              <Route path="achievements" element={<AchievementsPage />} />
                              <Route path="groups" element={<Navigate to="/" replace />} />
                              <Route path="settings" element={<Settings />} />
                              <Route path="profile" element={<UserProfile />} />
                              <Route path="profile/edit" element={<ProfileEditor />} />
                              <Route path="help" element={<Help />} />
                              <Route path="about" element={<About />} />
                            </Route>
                          </Routes>
                        </Router>
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
