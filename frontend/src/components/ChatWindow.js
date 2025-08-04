import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import MarkdownIt from 'markdown-it';
import mdKatex from 'markdown-it-katex';
import 'katex/dist/katex.min.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #F8F7F4;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
`;

const Header = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #FFD8BE 0%, #FFB48A 100%);
  color: #8B4513;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
`;

const Title = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #8B4513;
  letter-spacing: -0.025em;
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
  padding: 18px 20px;
  border-radius: 20px;
  background-color: ${props => props.isUser ? '#FFB48A' : '#FFFFFF'};
  color: ${props => props.isUser ? '#FFFFFF' : '#333333'};
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: ${props => props.isUser ? 'none' : '1px solid #E0E0E0'};
  position: relative;
  font-size: 15px;
  line-height: 1.5;
  transition: all 0.2s ease-in-out;
  
  &:hover {
    box-shadow: 0 6px 8px -1px rgba(0, 0, 0, 0.1), 0 3px 6px -1px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
`;

const MessageTime = styled.div`
  font-size: 11px;
  color: #999;
  margin-top: 8px;
  text-align: ${props => props.isUser ? 'right' : 'left'};
  font-weight: 300;
  letter-spacing: 0.025em;
`;

const InputContainer = styled.div`
  display: flex;
  padding: 20px;
  background-color: #FFFFFF;
  border-top: 1px solid #E0E0E0;
  box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.08), 0 -2px 4px -1px rgba(0, 0, 0, 0.06);
`;

const Input = styled.input`
  flex: 1;
  padding: 15px 20px;
  border: none;
  border-bottom: 2px solid #E0E0E0;
  border-radius: 0;
  font-size: 16px;
  outline: none;
  transition: all 0.2s ease-in-out;
  background-color: transparent;
  color: #333333;
  font-family: 'Inter', sans-serif;
  
  &:focus {
    border-bottom-color: #FFB48A;
    box-shadow: 0 2px 0 0 rgba(255, 180, 138, 0.2);
  }
  
  &::placeholder {
    color: #999999;
    font-weight: 300;
  }
`;

const SendButton = styled.button`
  background: #555555;
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  
  &:hover:not(:disabled) {
    transform: scale(1.08) translateY(-2px);
    background: linear-gradient(135deg, #FFB48A, #FF8C42);
    box-shadow: 0 8px 16px -4px rgba(255, 180, 138, 0.4), 0 4px 8px -2px rgba(255, 180, 138, 0.3);
  }
  
  &:active:not(:disabled) {
    transform: scale(0.95) translateY(0);
    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.06);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    background: #555555;
  }
`;

const LoadingIndicator = styled.div`
  display: flex;
  justify-content: center;
  padding: 10px;
`;

const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px;
  color: #666;
`;

const RobotIcon = styled.div`
  font-size: 48px;
  margin-bottom: 20px;
  animation: wave 2s ease-in-out infinite;
  
  @keyframes wave {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-10deg); }
    75% { transform: rotate(10deg); }
  }
`;

const WelcomeText = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
`;

const SubWelcomeText = styled.div`
  font-size: 14px;
  color: #999;
  font-weight: 300;
`;

const Dot = styled.div`
  width: 8px;
  height: 8px;
  background-color: #555555;
  border-radius: 50%;
  margin: 0 2px;
  animation: bounce 1.5s infinite;
  transition: all 0.2s ease-in-out;
  
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
  
  // Initialize MarkdownIt
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  }).use(mdKatex);
  
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
      text: `Hey there! I'm ${name}. I'm really excited to chat with you today! What should I call you?`,
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
  
  const handleNextQuestion = async (userResponse) => {
    // Extract information from user response based on current stage
    let extractedInfo = userResponse;
    
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
        extractedInfo = finalName;
        break;
        
      case 'askingAge':
        // Extract age from various language inputs
        // Handle patterns like "我15岁", "I'm 15", "15 years old", etc.
        const ageMatch = userResponse.match(/(?:[我Ii].*|\b)(\d{1,2})\s*(?:年|years?\s*old|\b)/i) || 
                         userResponse.match(/\d{1,2}/);
        extractedInfo = ageMatch ? ageMatch[1] : userResponse;
        setUserInfo(prev => ({ ...prev, age: extractedInfo }));
        break;
        
      case 'askingHobbies':
        // Extract hobbies from various language inputs
        // Handle different ways people might describe their hobbies
        let extractedHobbies = userResponse;
        
        // Remove common prefixes
        extractedHobbies = extractedHobbies
          .replace(/^(我喜欢|I\s*like\s*to|I\s*love\s*to|My\s*hobbies\s*are|我喜欢的活动是)\s*/i, '')
          .trim();
        
        setUserInfo(prev => ({ ...prev, hobbies: extractedHobbies }));
        extractedInfo = extractedHobbies;
        break;
        
      case 'askingJob':
        // Extract job/study information from various language inputs
        // Handle different ways people might describe their job or study interests
        let extractedJob = userResponse;
        
        // Remove common prefixes
        extractedJob = extractedJob
          .replace(/^(我是|I\s*am\s*|I'm\s*|我在|我正在|我的目标是|我想成为|我想做|我想要当|我将来想做)\s*/i, '')
          .trim();
        
        setUserInfo(prev => ({ ...prev, job: extractedJob }));
        extractedInfo = extractedJob;
        
        // Send all collected info to backend for context with a special termination marker
        const contextMessage = `[CONTEXT_START]\nUser Information:\nName: ${userInfo.name}\nAge: ${userInfo.age}\nHobbies: ${userInfo.hobbies}\nJob: ${extractedJob}\nAI Name: ${aiName}\nUser Name: ${userInfo.name}\n\nPlease use this information to personalize our conversation. You are ${aiName}, and you are having a friendly chat with ${userInfo.name}.\n[CONTEXT_END]`;
        
        // Send context to backend
        sendContextToBackend(contextMessage);
        break;
        
      default:
        return;
    }
    
    // Determine next stage
    let nextStage = '';
    switch (conversationStage) {
      case 'askingName':
        nextStage = 'askingAge';
        break;
      case 'askingAge':
        nextStage = 'askingHobbies';
        break;
      case 'askingHobbies':
        nextStage = 'askingJob';
        break;
      case 'askingJob':
        nextStage = 'completed';
        break;
      default:
        nextStage = 'completed';
    }
    
    setConversationStage(nextStage);
    
    // If we've completed the questionnaire, ask AI to generate the final greeting message
    if (nextStage === 'completed') {
      setIsLoading(true);
      
      try {
        // Prepare request body with conversation history and current context
        const requestBody = {
          userId: userId,
          message: `Generate a personalized greeting message for ${userInfo.name} after completing the initial information collection. The collected information is: Name: ${userInfo.name}, Age: ${userInfo.age}, Hobbies: ${userInfo.hobbies}, Job/Study: ${userInfo.job || extractedJob}. Ask what they would like to talk about today.`,
          context: {
            currentStage: conversationStage,
            nextStage: nextStage,
            userInfo: userInfo
          }
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
          text: data.message.content,
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error('Error getting final greeting from AI:', error);
        
        // Let AI handle the error gracefully by asking again
        const errorMessage = {
          id: Date.now() + Math.random(),
          text: `Sorry, I'm having trouble generating a response. Let me try again - what's on your mind today?`,
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
      
      return;
    }
    
    // For all other stages, ask AI to generate the next question
    setIsLoading(true);
    
    try {
      // Prepare request body with conversation history and current context
      const requestBody = {
        userId: userId,
        message: `Please ask the next question in the initial conversation template. Current stage: ${conversationStage}, Next stage: ${nextStage}. User's previous response: ${userResponse}`,
        // Add context about what information we're trying to gather
        context: {
          currentStage: conversationStage,
          nextStage: nextStage,
          extractedInfo: extractedInfo,
          userInfo: userInfo
        }
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
        text: data.message.content,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting next question from AI:', error);
      
      // Let AI handle the error gracefully by asking again
      const errorMessage = {
        id: Date.now() + Math.random(),
        text: `Sorry, I'm having trouble generating the next question. Could you tell me more about yourself?`,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
      
      // Let AI handle identity questions naturally through the API
      // No preset responses for identity questions
      
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
        text: data.message.content,
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
        {messages.length === 0 ? (
          <EmptyStateContainer>
            <RobotIcon>🤖</RobotIcon>
            <WelcomeText>Welcome to Chat Buddy!</WelcomeText>
            <SubWelcomeText>Start a conversation with your AI assistant</SubWelcomeText>
          </EmptyStateContainer>
        ) : (
          <>
            {messages.map((message) => (
              <Message key={message.id} isUser={message.isUser}>
                <MessageContent isUser={message.isUser}>
                  {message.isUser ? (
                    message.text
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: md.render(message.text) }} />
                  )}
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
          </>
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