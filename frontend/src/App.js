import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import ChatWindow from './components/ChatWindow';
import RoleSidebar from './components/RoleSidebar';
import MemoryManager from './components/MemoryManager';

const AppContainer = styled.div`
  height: 100vh;
  display: flex;
`;

function App() {
  const userIdRef = useRef(localStorage.getItem('userId') || 'user-' + Date.now());
  
  // Save userId to localStorage
  if (!localStorage.getItem('userId')) {
    localStorage.setItem('userId', userIdRef.current);
  }

  const [currentRole, setCurrentRole] = useState('');
  const [showMemory, setShowMemory] = useState(false);

  return (
    <AppContainer>
      <RoleSidebar
        currentRole={currentRole}
        onSelect={setCurrentRole}
        onShowMemory={() => setShowMemory(true)}
      />
      <ChatWindow userId={userIdRef.current} role={currentRole} />
      {showMemory && (
        <MemoryManager
          userId={userIdRef.current}
          onClose={() => setShowMemory(false)}
        />
      )}
    </AppContainer>
  );
}

export default App;