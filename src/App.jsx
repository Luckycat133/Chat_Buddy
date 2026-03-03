import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppProviders from './providers/AppProviders';
import Layout from './components/Layout';

const ChatList = lazy(() => import('./features/chat/ChatList'));
const ChatWindow = lazy(() => import('./features/chat/ChatWindow'));
const CreateChat = lazy(() => import('./features/chat/CreateChat'));
const GroupDetails = lazy(() => import('./features/chat/GroupDetails'));
const Settings = lazy(() => import('./pages/Settings'));
const Help = lazy(() => import('./pages/Help'));
const About = lazy(() => import('./pages/About'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const ProfileEditor = lazy(() => import('./pages/ProfileEditor'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const FriendGroups = lazy(() => import('./pages/FriendGroups'));
const AgentsPage = lazy(() => import('./pages/AgentsPage'));
const AgentWorkspace = lazy(() => import('./pages/AgentWorkspace'));
const MomentsPage = lazy(() => import('./features/moments/MomentsPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

const RouteLoadingFallback = () => (
  <div className="flex h-full items-center justify-center bg-[var(--color-bg-app)] text-[var(--color-text-muted)]">
    Loading...
  </div>
);

export default function App() {
  return (
    <AppProviders>
      <Router>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<ChatList />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="chat/:id" element={<ChatWindow />} />
              <Route path="chat/:id/search" element={<ChatWindow />} />
              <Route path="chat/:id/details" element={<GroupDetails />} />
              <Route path="create" element={<CreateChat />} />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="agents/:agentId" element={<AgentWorkspace />} />
              <Route path="friends" element={<FriendsPage />} />
              <Route path="friends/groups" element={<FriendGroups />} />
              <Route path="moments" element={<MomentsPage />} />
              <Route path="achievements" element={<AchievementsPage />} />
              <Route path="leaderboard" element={<LeaderboardPage />} />
              <Route path="groups" element={<Navigate to="/" replace />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="profile/edit" element={<ProfileEditor />} />
              <Route path="help" element={<Help />} />
              <Route path="about" element={<About />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </AppProviders>
  );
}
