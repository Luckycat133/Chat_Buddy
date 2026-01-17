import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppProviders from './providers/AppProviders';
import Layout from './components/Layout';

// Pages
import ChatList from './features/chat/ChatList';
import ChatWindow from './features/chat/ChatWindow';
import CreateChat from './features/chat/CreateChat';
import GroupDetails from './features/chat/GroupDetails';
import Settings from './pages/Settings';
import Help from './pages/Help';
import About from './pages/About';
import UserProfile from './pages/UserProfile';
import ProfileEditor from './pages/ProfileEditor';
import FriendsPage from './pages/FriendsPage';
import FriendGroups from './pages/FriendGroups';
import AgentsPage from './pages/AgentsPage';
import AgentWorkspace from './pages/AgentWorkspace';
import MomentsPage from './features/moments/MomentsPage';
import AchievementsPage from './pages/AchievementsPage';

export default function App() {
  return (
    <AppProviders>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ChatList />} />
            <Route path="chat/:id" element={<ChatWindow />} />
            <Route path="chat/:id/details" element={<GroupDetails />} />
            <Route path="create" element={<CreateChat />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="agents/:agentId" element={<AgentWorkspace />} />
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
    </AppProviders>
  );
}
