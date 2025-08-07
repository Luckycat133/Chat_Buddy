import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import MarkdownIt from 'markdown-it';
import mdKatex from 'markdown-it-katex';
import 'katex/dist/katex.min.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import DOMPurify from 'dompurify';

// Styled components
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
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #FFD8BE 0%, #FFB48A 100%);
  color: #8B4513;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
`;

const TitleContainer = styled.div`
  height: 30px;
  display: flex;
  align-items: center;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  transition: all 0.3s ease-in-out;
  transform: translateX(${props => props.show ? '0' : '-30px'});
  opacity: ${props => props.show ? '1' : '0'};
`;

const TypingTitle = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: #ffffff;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.3s ease-in-out;
  transform: translateX(${props => props.show ? '0' : '-30px'});
  opacity: ${props => props.show ? '1' : '0'};
`;

const PulseDot = styled.div`
  width: 6px;
  height: 6px;
  background-color: #ffffff;
  border-radius: 50%;
  animation: pulse 1.5s infinite ease-in-out;
  
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes pulse {
    0%, 100% { 
      opacity: 0.4;
      transform: scale(0.8);
    }
    50% { 
      opacity: 1;
      transform: scale(1.2);
    }
  }
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
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

// Message components
const Message = styled.div`
  display: flex;
  margin-bottom: 20px;
  flex-direction: ${props => props.isUser ? 'row-reverse' : 'row'};
`;

const MessageContent = styled.div`
  max-width: 70%;
  padding: 18px 20px;
  border-radius: 20px;
  background-color: ${props => props.isUser ? '#FFB48A' : props.isError ? '#FFECEB' : '#FFFFFF'};
  color: ${props => props.isUser ? '#FFFFFF' : '#333333'};
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: ${props => props.isUser ? 'none' : props.isError ? '1px solid #FFCCC9' : '1px solid #E0E0E0'};
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

const MessageActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  ${MessageContent}:hover & {
    opacity: 1;
  }
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease-in-out;
  
  &:hover {
    background-color: #f0f0f0;
    color: #333;
  }
`;

const EditedIndicator = styled.span`
  font-size: 10px;
  color: #999;
  margin-left: 8px;
  font-style: italic;
`;

// Typing indicator components
const TypingIndicator = styled.div`
  display: flex;
  justify-content: flex-start;
  margin: 10px 0;
  opacity: ${props => props.show ? 1 : 0};
  transform: translateX(${props => props.show ? '0' : '-30px'});
  transition: all 0.5s ease;
  height: ${props => props.show ? 'auto' : '0'};
  overflow: hidden;
`;

const TypingContent = styled.div`
  background-color: #f1f1f1;
  padding: 12px 16px;
  border-radius: 18px;
  max-width: 70%;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TypingDots = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const TypingDot = styled.div`
  width: 8px;
  height: 8px;
  background-color: #666;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
  
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
`;

const TypingText = styled.span`
  color: #666;
  font-size: 14px;
  margin-right: 4px;
`;

// Empty state components
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

// Loading indicator
const LoadingIndicator = styled.div`
  display: flex;
  justify-content: center;
  padding: 10px;
`;

// Dot component
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

// Role names
const roleNames = {
  evelyn: "Dr. Evelyn Lin"
};

// MessageItem component
const MessageItem = ({ message, md, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  
  const handleSaveEdit = () => {
    onEdit(message.id, editText);
    setIsEditing(false);
  };
  
  return (
    <Message isUser={message.isUser}>
      <MessageContent isUser={message.isUser} isError={message.isError}>
        {isEditing ? (
          <>
            <Input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              style={{ marginBottom: '10px', width: '100%' }}
            />
            <MessageActions>
              <ActionButton onClick={handleSaveEdit}>Save</ActionButton>
              <ActionButton onClick={() => setIsEditing(false)}>Cancel</ActionButton>
            </MessageActions>
          </>
        ) : (
          <>
            {message.isUser ? (
              message.text
            ) : (
              <>
                {message.isError && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px', marginRight: '8px' }}>⚠️</span>
                    <span style={{ fontWeight: '600', color: '#E53E3E' }}>Error</span>
                  </div>
                )}
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(md.render(message.text)) }} />
              </>
            )}
            <MessageTime isUser={message.isUser}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {message.edited && <EditedIndicator>(edited)</EditedIndicator>}
            </MessageTime>
            {message.isUser && (
              <MessageActions>
                <ActionButton onClick={() => setIsEditing(true)}>Edit</ActionButton>
                <ActionButton onClick={() => onDelete(message.id)}>Delete</ActionButton>
              </MessageActions>
            )}
          </>
        )}
      </MessageContent>
    </Message>
  );
};

// TypingIndicator component
const TypingIndicatorComponent = ({ show }) => {
  return (
    <TypingIndicator show={show}>
      <TypingContent>
        <TypingText>对方正在输入中</TypingText>
        <TypingDots>
          <TypingDot />
          <TypingDot />
          <TypingDot />
        </TypingDots>
      </TypingContent>
    </TypingIndicator>
  );
};

// EmptyState component
const EmptyState = () => {
  return (
    <EmptyStateContainer>
      <RobotIcon>🤖</RobotIcon>
      <WelcomeText>Welcome to Chat Buddy!</WelcomeText>
      <SubWelcomeText>Start a conversation with your AI assistant</SubWelcomeText>
    </EmptyStateContainer>
  );
};

// ChatWindow component
const ChatWindow = ({ userId }) => {
  // State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const [titleKey, setTitleKey] = useState('evelyn');
  const messagesEndRef = useRef(null);
  
  // Initialize MarkdownIt
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  }).use(mdKatex);
  

  
  // Load conversation history from backend
  useEffect(() => {
    const loadConversation = async () => {
      try {
        const response = await fetch(`http://localhost:5001/api/conversation/${userId}`);
        if (response.ok) {
          const data = await response.json();
          // Convert timestamp strings to Date objects
          const conversationWithDates = data.conversation.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(conversationWithDates);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      }
    };

    loadConversation();
  }, [userId]);

  useEffect(() => {
    setTitleKey('evelyn');
  }, []);
  
  // Delete a message
  const deleteMessage = async (messageId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/conversation/${userId}/message/${messageId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Remove the message from state
        setMessages(prevMessages => prevMessages.filter(msg => msg.id != messageId));
      } else {
        console.error('Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };
  
  // Edit a message
  const editMessage = async (messageId, newText) => {
    try {
      const response = await fetch(`http://localhost:5001/api/conversation/${userId}/message/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newText })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update the message in state
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id == messageId ? { ...msg, content: newText, edited: true } : msg
          )
        );
        
        // If the edited message is the last user message, re-send it to get a new AI response
        const lastUserMessage = messages.filter(msg => msg.isUser).pop();
        if (lastUserMessage && lastUserMessage.id == messageId) {
          // Remove the last AI response if it exists
          const lastMessage = messages[messages.length - 1];
          if (!lastMessage.isUser) {
            setMessages(prevMessages => prevMessages.slice(0, -1));
          }
          
          // Re-send the edited message
          await resendMessage(newText);
        }
      } else {
        console.error('Failed to edit message');
      }
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };
  
  // Re-send a message to get a new AI response
  const resendMessage = async (messageText) => {
    if (isLoading) return;
    
    setIsTyping(true);
    
    try {
      // 更真实的延迟模拟：思考时间 + 打字时间
      const thinkTime = 800 + Math.random() * 1200; // 0.8-2秒思考时间
      await delay(thinkTime);
      
      const requestBody = {
        userId: userId,
        message: inputValue,
        promptType: 'evelyn',
        isEdited: true
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
      
      // 基于消息长度计算打字时间（模拟真人打字速度）
      const words = data.message.content.split(/\s+/).length;
      const typingTime = Math.max(400, words * 180 + Math.random() * 400); // 每个词约180ms + 随机变化
      await delay(typingTime);
      
      setIsTyping(false);
      
      const aiMessage = {
        id: Date.now() + Math.random(),
        text: data.message.content,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Save conversation to backend
      await saveConversation([...messages, { 
        id: Date.now() + Math.random(), 
        text: messageText, 
        isUser: true, 
        timestamp: new Date(),
        edited: true
      }, aiMessage]);
    } catch (error) {
      console.error('Error resending message:', error);
      
      setIsTyping(false);
      
      const errorMessage = {
        id: Date.now() + Math.random(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Save conversation to backend even if there's an error
      await saveConversation([...messages, { 
        id: Date.now() + Math.random(), 
        text: messageText, 
        isUser: true, 
        timestamp: new Date(),
        edited: true
      }, errorMessage]);
    }
  };
  
  // Helper function for delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Add messageId to userMessage and aiMessage objects
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now() + Math.random(),
      text: inputValue,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    setIsTyping(true);
    
    try {
      // 更真实的延迟模拟：思考时间 + 打字时间
      const thinkTime = 800 + Math.random() * 1200; // 0.8-2秒思考时间
      await delay(thinkTime);
      
      const requestBody = {
        userId: userId,
        message: inputValue,
        promptType: 'evelyn',
        isEdited: true
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
      
      // 基于消息长度计算打字时间（模拟真人打字速度）
      const words = data.message.content.split(/\s+/).length;
      const typingTime = Math.max(400, words * 180 + Math.random() * 400); // 每个词约180ms + 随机变化
      await delay(typingTime);
      
      setIsTyping(false);
      
      const aiMessage = {
        id: Date.now() + Math.random(),
        text: data.message.content,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Save conversation to backend
      await saveConversation([...messages, userMessage, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      setIsTyping(false);
      
      const errorMessage = {
        id: Date.now() + Math.random(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Save conversation to backend even if there's an error
      await saveConversation([...messages, userMessage, errorMessage]);
    }
  };
  
  // Save conversation to backend
  const saveConversation = async (conversation) => {
    try {
      // Remove Date objects for JSON serialization
      const conversationToSave = conversation.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      }));
      
      const response = await fetch(`http://localhost:5001/api/import/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation: conversationToSave,
          context: {}
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to save conversation');
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
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
        <TitleContainer>
           {isTyping ? (
             <TypingTitle show={true}>
               对方正在输入中
               <PulseDot />
               <PulseDot />
               <PulseDot />
             </TypingTitle>
           ) : (
             <Title show={true}>{roleNames[titleKey] || "Chat Buddy"}</Title>
           )}
         </TitleContainer>
      </Header>
      
      <MessagesContainer>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} md={md} onDelete={deleteMessage} onEdit={editMessage} />
            ))}
            <TypingIndicatorComponent show={isTyping} />
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
          disabled={isTyping}
        />
        <SendButton onClick={sendMessage} disabled={isTyping || !inputValue.trim()}>
          ➤
        </SendButton>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatWindow;