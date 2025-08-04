import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import MarkdownIt from 'markdown-it';
import mdKatex from 'markdown-it-katex';
import 'katex/dist/katex.min.css';

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
    
    // If we've completed the questionnaire, add a friendly greeting message
    if (nextStage === 'completed') {
      const greetingMessage = {
        id: Date.now() + Math.random(),
        text: `Thanks for sharing all that with me, ${userInfo.name}! I feel like I'm getting to know you better already. What's on your mind today? Is there anything particular you'd like to chat about?`,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, greetingMessage]);
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
      
      // Fallback to predefined questions if AI fails
      let questionText = '';
      switch (nextStage) {
        case 'askingAge':
          questionText = `Nice to meet you, ${extractedInfo}! So, how old are you? I'm curious to know!`;
          break;
        case 'askingHobbies':
          questionText = `Awesome! So you're ${extractedInfo}. What do you like to do in your free time? I'm curious about your hobbies!`;
          break;
        case 'askingJob':
          questionText = `That sounds really interesting! I'd love to hear more about ${extractedInfo} sometime. What are you studying at school or what do you want to do in the future?`;
          break;
        default:
          questionText = `What would you like to talk about?`;
      }
      
      const questionMessage = {
        id: Date.now() + Math.random(),
        text: questionText,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, questionMessage]);
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
      
      // Check if user is asking "who are you" during the questionnaire
      if (conversationStage !== 'initial' && /谁是|你是|你是谁|what.*you|who.*you/i.test(userResponse)) {
        // Create a special response for identity questions
        const identityMessage = {
          id: Date.now() + Math.random(),
          text: `Hey there! I'm ${aiName}, your friendly AI companion. I'm here to have a great conversation with you and get to know you better! I noticed you're asking about me, but I'd love to learn more about you first. What should I call you?`,
          isUser: false,
          timestamp: new Date()
        };
        
        // Stay in the current stage and add the identity message
        setMessages(prev => [...prev, identityMessage]);
        return;
      }
      
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