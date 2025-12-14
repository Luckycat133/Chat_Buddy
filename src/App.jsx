import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChatProvider } from './context/ChatContext';
import { LanguageProvider } from './context/LanguageContext';
import { DocumentProvider } from './context/DocumentContext';
import Layout from './components/Layout';
// Lazy load pages eventually, import placeholders for now
import ChatList from './pages/ChatList';
import ChatWindow from './pages/ChatWindow';
import CreateChat from './pages/CreateChat';
import GroupDetails from './pages/GroupDetails';
import Settings from './pages/Settings';
import Help from './pages/Help';
import About from './pages/About';

export default function App() {
  return (
    <LanguageProvider>
      <DocumentProvider>
        <ChatProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<ChatList />} />
                <Route path="chat/:id" element={<ChatWindow />} />
                <Route path="chat/:id/details" element={<GroupDetails />} />
                <Route path="create" element={<CreateChat />} />
                <Route path="groups" element={<Navigate to="/" replace />} />
                <Route path="settings" element={<Settings />} />
                <Route path="help" element={<Help />} />
                <Route path="about" element={<About />} />
              </Route>
            </Routes>
          </Router>
        </ChatProvider>
      </DocumentProvider>
    </LanguageProvider>
  );
}
