export const mockPersonas = [
  {
    id: 'ai-1',
    name: 'TestAI',
    name_zh: '测试AI',
    avatar: '/avatars/test.png',
    personality: 'Test personality',
    personality_zh: '测试性格',
    interests: ['testing'],
    style: 'Professional',
    color: 'bg-blue-100 text-blue-800',
    responseDelay: { min: 100, max: 200 },
    readDelay: { min: 50, max: 100 },
    typingSpeed: 'fast'
  }
];

export const mockTaskAgent = {
  id: 'agent-test',
  name: 'TestAgent',
  agentType: 'task-specialist',
  category: 'productivity',
  systemPrompt: 'You are a test agent',
  skills: ['testing'],
  tools: [
    {
      name: 'test_tool',
      description: 'A test tool'
    }
  ],
  toolsEnabled: true,
  responseDelay: { min: 100, max: 200 },
  readDelay: { min: 50, max: 100 },
  typingSpeed: 'fast'
};
