import React, { useState } from 'react';
import styled from 'styled-components';

const SetupContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const SetupCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  text-align: center;
`;

const Title = styled.h1`
  color: #333;
  margin-bottom: 10px;
  font-size: 28px;
  font-weight: 600;
`;

const Description = styled.p`
  color: #666;
  margin-bottom: 30px;
  font-size: 16px;
  line-height: 1.5;
`;

const Instructions = styled.div`
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  text-align: left;
`;

const InstructionTitle = styled.h3`
  color: #333;
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 16px;
`;

const InstructionList = styled.ol`
  padding-left: 20px;
  margin: 0;
  font-size: 14px;
  color: #555;
`;

const InstructionItem = styled.li`
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 15px;
  margin-bottom: 20px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const ApiKeySetup = ({ onSubmit }) => {
  const [apiKey, setApiKey] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onSubmit(apiKey);
    }
  };
  
  return (
    <SetupContainer>
      <SetupCard>
        <Title>Welcome to Vibe Coding</Title>
        <Description>Enter your API key to start chatting with our AI model. Your conversations will be securely stored with accurate timestamps.</Description>
        
        <Instructions>
          <InstructionTitle>How to get your API key:</InstructionTitle>
          <InstructionList>
            <InstructionItem>Sign up for an account with an AI service provider (e.g., OpenAI, Anthropic)</InstructionItem>
            <InstructionItem>Navigate to the API section of your account dashboard</InstructionItem>
            <InstructionItem>Generate a new API key</InstructionItem>
            <InstructionItem>Copy and paste the API key into the field below</InstructionItem>
          </InstructionList>
        </Instructions>
        
        <form onSubmit={handleSubmit}>
          <Input
            type="password"
            placeholder="Enter your API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Button type="submit">Get Started</Button>
        </form>
      </SetupCard>
    </SetupContainer>
  );
};

export default ApiKeySetup;