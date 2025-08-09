import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import ChatWindow from './components/ChatWindow';
import RoleSidebar from './components/RoleSidebar';
import MemoryManager from './components/MemoryManager';

const AppContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
`;

const MainLayout = styled.div`
  display: flex;
  height: 100%;
`;

const SidebarWrapper = styled.div`
  width: 200px;
`;

const MemoryWrapper = styled.div`
  width: 260px;
`;

function App() {
  const userIdRef = useRef(localStorage.getItem('userId') || 'user-' + Date.now());
  const [role, setRole] = useState('assistant');
  
  // Save userId to localStorage
  if (!localStorage.getItem('userId')) {
    localStorage.setItem('userId', userIdRef.current);
  }

  return (
    <AppContainer>
      <MainLayout>
        <SidebarWrapper>
          <RoleSidebar selectedRole={role} onSelect={setRole} />
        </SidebarWrapper>
        <ChatWindow userId={userIdRef.current} role={role} />
        <MemoryWrapper>
          <MemoryManager userId={userIdRef.current} role={role} />
        </MemoryWrapper>
      </MainLayout>
    </AppContainer>
  );
}

export default App;