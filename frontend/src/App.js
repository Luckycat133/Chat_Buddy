import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import ChatWindow from './components/ChatWindow';
import Settings from './components/Settings';

const AppContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
`;

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);
  const userIdRef = useRef(localStorage.getItem('userId') || 'user-' + Date.now());
  
  // Save userId to localStorage
  if (!localStorage.getItem('userId')) {
    localStorage.setItem('userId', userIdRef.current);
  }
  
  // Check if user has saved settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`http://localhost:5001/api/settings/${userIdRef.current}`);
        if (response.ok) {
          const userSettings = await response.json();
          setSettings(userSettings);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    
    fetchSettings();
  }, []);
  
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };
  
  const handleSettingsSaved = (newSettings) => {
    setSettings(newSettings);
  };
  
  return (
    <AppContainer>
      {showSettings ? (
        <Settings 
          userId={userIdRef.current}
          onClose={toggleSettings}
          onSettingsSaved={handleSettingsSaved}
        />
      ) : (
        <ChatWindow 
          onOpenSettings={toggleSettings}
          userId={userIdRef.current}
        />
      )}
    </AppContainer>
  );
}

export default App;