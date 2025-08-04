import React, { useRef } from 'react';
import styled from 'styled-components';
import ChatWindow from './components/ChatWindow';

const AppContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
`;

function App() {
  const userIdRef = useRef(localStorage.getItem('userId') || 'user-' + Date.now());
  
  // Save userId to localStorage
  if (!localStorage.getItem('userId')) {
    localStorage.setItem('userId', userIdRef.current);
  }

  return (
    <AppContainer>
      <ChatWindow 
        userId={userIdRef.current}
      />
    </AppContainer>
  );
}

export default App;