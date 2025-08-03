import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f0f4f8;
  padding: 20px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  margin-bottom: 20px;
  border-bottom: 1px solid #e1e5e9;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
`;

const CloseButton = styled.button`
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.3s;
  
  &:hover {
    background: #5a6fd8;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 600px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-weight: 500;
  color: #333;
`;

const Input = styled.input`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.3s;
  
  &:focus {
    border-color: #667eea;
  }
`;

const Select = styled.select`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.3s;
  
  &:focus {
    border-color: #667eea;
  }
`;

const TextArea = styled.textarea`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.3s;
  min-height: 100px;
  resize: vertical;
  
  &:focus {
    border-color: #667eea;
  }
`;

const Button = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: transform 0.2s;
  
  &:hover {
    transform: scale(1.02);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const Settings = ({ userId, onClose, onSettingsSaved }) => {
  const [settings, setSettings] = useState({
    provider: 'openai',
    providerUrl: '',
    providerName: '',
    modelName: '',
    apiKey: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(`http://localhost:5001/api/settings/${userId}`);
        if (response.ok) {
          const existingSettings = await response.json();
          setSettings(existingSettings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    
    loadSettings();
  }, [userId]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch(`http://localhost:5001/api/settings/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Notify parent component that settings were saved
      if (onSettingsSaved) {
        onSettingsSaved(settings);
      }
      
      // Close the settings panel
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert(`Failed to save settings: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <SettingsContainer>
      <Header>
        <Title>Settings</Title>
        <CloseButton onClick={onClose}>Close</CloseButton>
      </Header>
      
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="provider">Provider</Label>
          <Select
            id="provider"
            name="provider"
            value={settings.provider}
            onChange={handleChange}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">Custom</option>
          </Select>
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="providerUrl">Provider URL</Label>
          <Input
            type="url"
            id="providerUrl"
            name="providerUrl"
            value={settings.providerUrl}
            onChange={handleChange}
            placeholder="https://api.openai.com/v1"
          />
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="providerName">Provider Name</Label>
          <Input
            type="text"
            id="providerName"
            name="providerName"
            value={settings.providerName}
            onChange={handleChange}
            placeholder="OpenAI"
          />
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="modelName">Model Name</Label>
          <Input
            type="text"
            id="modelName"
            name="modelName"
            value={settings.modelName}
            onChange={handleChange}
            placeholder="gpt-3.5-turbo"
          />
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            type="password"
            id="apiKey"
            name="apiKey"
            value={settings.apiKey}
            onChange={handleChange}
            placeholder="Enter your API key"
          />
        </FormGroup>
        
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </Form>
    </SettingsContainer>
  );
};

export default Settings;