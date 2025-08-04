import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f0f4f8;
`;

const Header = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 600;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

const Message = styled.div`
  display: flex;
  margin-bottom: 20px;
  flex-direction: ${props => props.isUser ? 'row-reverse' : 'row'};
`;

const MessageContent = styled.div`
  max-width: 70%;
  padding: 15px;
  border-radius: 18px;
  background-color: ${props => props.isUser ? '#667eea' : '#ffffff'};
  color: ${props => props.isUser ? '#ffffff' : '#333333'};
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  position: relative;
`;

const MessageTime = styled.div`
  font-size: 12px;
  color: #999;
  margin-top: 5px;
  text-align: ${props => props.isUser ? 'right' : 'left'};
`;

const InputContainer = styled.div`
  display: flex;
  padding: 20px;
  background-color: #ffffff;
  border-top: 1px solid #e1e5e9;
`;

const Input = styled.input`
  flex: 1;
  padding: 15px;
  border: 2px solid #e1e5e9;
  border-radius: 25px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.3s;
  
  &:focus {
    border-color: #667eea;
  }
`;

const SendButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  margin-left: 10px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
  
  &:hover {
    transform: scale(1.05);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const LoadingIndicator = styled.div`
  display: flex;
  justify-content: center;
  padding: 10px;
`;

const Dot = styled.div`
  width: 8px;
  height: 8px;
  background-color: #667eea;
  border-radius: 50%;
  margin: 0 2px;
  animation: bounce 1.5s infinite;
  
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
`;

const ChatWindow = ({ userId }) => {
  // State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiName, setAiName] = useState('');
  const [conversationStage, setConversationStage] = useState('initial'); // initial, askingName, askingAge, askingHobbies, askingJob, completed
  const [userInfo, setUserInfo] = useState({});
  const messagesEndRef = useRef(null);
  
  // Send user context information to backend
  const sendContextToBackend = async (contextMessage) => {
    try {
      const requestBody = {
        userId: userId,
        message: contextMessage
      };
      
      const response = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Context sent successfully:', data);
    } catch (error) {
      console.error('Error sending context to backend:', error);
    }
  };
  
  // Generate a random English name for the AI
  const generateRandomName = () => {
    const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Skyler', 'Cameron', 'Dakota', 'Reese', 'Rowan', 'Emerson', 'Finley', 'Harper', 'Hayden', 'Jamie', 'Kendall', 'Peyton'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    
    const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    return `${randomFirstName} ${randomLastName}`;
  };
  
  // Initialize the AI name and first message
  useEffect(() => {
    const name = generateRandomName();
    setAiName(name);
    
    // Add the first AI message asking for the user's name
    const firstMessage = {
      id: Date.now(),
      text: `Hi there! I'm ${name}. What's your name?`,
      isUser: false,
      timestamp: new Date()
    };
    
    setMessages([firstMessage]);
    setConversationStage('askingName');
  }, []);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleNextQuestion = (userResponse) => {
    let nextStage = '';
    let questionText = '';
    
    switch (conversationStage) {
      case 'askingName':
        // Extract name from various language inputs
        // Handle patterns like "我是Jack", "I'm Jack", "Je suis Jack", "Ich bin Jack", etc.
        const extractedName = userResponse
          .replace(/^\s*[我Ii]|^\s*[是sS]\s*/i, '')  // Remove leading "我" or "I" or "s" (for "is")
          .replace(/^\s*[是sS]\s*/i, '')  // Remove any remaining "是" or "s"
          .replace(/^[\s\W]+/, '')  // Remove leading spaces and non-word characters
          .trim() || userResponse;
        
        // If the extracted name is still in a phrase format, try to get the last word
        const finalName = extractedName.split(/\s+/).pop() || extractedName;
        
        setUserInfo(prev => ({ ...prev, name: finalName }));
        nextStage = 'askingAge';
        questionText = `Nice to meet you, ${finalName}! How old are you?`;
        break;
        
      case 'askingAge':
        setUserInfo(prev => ({ ...prev, age: userResponse }));
        nextStage = 'askingHobbies';
        questionText = 'What are your hobbies or interests?';
        break;
        
      case 'askingHobbies':
        setUserInfo(prev => ({ ...prev, hobbies: userResponse }));
        nextStage = 'askingJob';
        questionText = 'What do you do for work or what would you like to do?';
        break;
        
      case 'askingJob':
        setUserInfo(prev => ({ ...prev, job: userResponse }));
        nextStage = 'completed';
        
        // Send all collected info to backend for context
        const contextMessage = `User Information:\nName: ${userInfo.name}\nAge: ${userInfo.age}\nHobbies: ${userInfo.hobbies}\nJob: ${userResponse}\n\nPlease use this information to personalize our conversation.`;
        
        // Send context to backend
        sendContextToBackend(contextMessage);
        
        // Add a friendly greeting message
        questionText = `Thanks for sharing that with me, ${userInfo.name}! I'm looking forward to our conversation. What would you like to chat about today?`;
        break;
        
      default:
        return;
    }
    
    setConversationStage(nextStage);
    
    if (nextStage !== 'completed') {
      const questionMessage = {
        id: Date.now() + Math.random(),
        text: questionText,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, questionMessage]);
    } else {
      // Add the final greeting message
      const greetingMessage = {
        id: Date.now() + Math.random(),
        text: questionText,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, greetingMessage]);
    }
  };
  
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now() + Math.random(),
      text: inputValue,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // If we're in the initial conversation phase, handle the next question
    if (conversationStage !== 'completed') {
      const userResponse = inputValue;
      setInputValue('');
      handleNextQuestion(userResponse);
      return;
    }
    
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Prepare request body
      const requestBody = {
        userId: userId,
        message: inputValue
      };
      
      const response = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const aiMessage = {
        id: Date.now() + Math.random(),
        text: data.message.text,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage = {
        id: Date.now() + Math.random(),
        text: `Sorry, I encountered an error: ${error.message}`,
        isUser: false,
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  return (
    <ChatContainer>
      <Header>
        <Title>{aiName || 'Chat Buddy'}</Title>
      </Header>
      
      <MessagesContainer>
        {messages.map((message) => (
          <Message key={message.id} isUser={message.isUser}>
            <MessageContent isUser={message.isUser}>
              {message.text}
              <MessageTime isUser={message.isUser}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </MessageTime>
            </MessageContent>
          </Message>
        ))}
        {isLoading && (
          <LoadingIndicator>
            <Dot />
            <Dot />
            <Dot />
          </LoadingIndicator>
        )}
        <div ref={messagesEndRef} />
      </MessagesContainer>
      
      <InputContainer>
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <SendButton onClick={sendMessage} disabled={isLoading || !inputValue.trim()}>
          ➤
        </SendButton>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatWindow;

  // Send user context information to backend
  const sendContextToBackend = async (contextMessage) => {
    try {
      const requestBody = {
        userId: userId,
        message: contextMessage
      };
      
      const response = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Context sent successfully:', data);
    } catch (error) {
      console.error('Error sending context to backend:', error);
    }
  };