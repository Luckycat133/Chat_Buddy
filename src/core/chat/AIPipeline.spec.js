import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callAI: vi.fn(),
  calculateTypingDelay: vi.fn(() => 0),
  getRandomDelay: vi.fn(() => 0),
  executeTool: vi.fn(),
  compressContext: vi.fn(),
  extractMemoriesAsync: vi.fn(),
  buildMemoryBlock: vi.fn(),
  buildGroupContextBlock: vi.fn(),
}));

vi.mock('../../features/chat/services/chatService', () => ({
  callAI: mocks.callAI,
  calculateTypingDelay: mocks.calculateTypingDelay,
  getRandomDelay: mocks.getRandomDelay,
}));

vi.mock('../../features/chat/services/toolService', () => ({
  executeTool: mocks.executeTool,
}));

vi.mock('../memory/ContextCompressor', () => ({
  compressContext: mocks.compressContext,
  extractMemoriesAsync: mocks.extractMemoriesAsync,
}));

vi.mock('../memory/MemoryInjector', () => ({
  buildMemoryBlock: mocks.buildMemoryBlock,
  buildGroupContextBlock: mocks.buildGroupContextBlock,
}));

import { AIPipeline } from './AIPipeline';

function createPipeline() {
  const callbacks = {
    onTyping: vi.fn(),
    onMessage: vi.fn(),
    onSchedule: vi.fn(),
    onLog: vi.fn(),
  };
  const pipeline = new AIPipeline(callbacks);
  pipeline._wait = vi.fn().mockResolvedValue(undefined);
  return { pipeline, callbacks };
}

const personas = [
  {
    id: 'ai-1',
    name: 'Luna',
    personality: 'gentle',
    style: 'casual',
    typingSpeed: 'normal',
    agentType: 'task-specialist',
    tools: [{ name: 'execute_math' }],
  },
];

const baseChat = {
  id: 'chat-1',
  polls: [{ id: 'poll-1', question: 'Pick one', options: [{ text: 'A' }] }],
  messages: [{ id: 'm1', senderId: 'user-me', content: 'hello', timestamp: '2026-02-23T00:00:00.000Z' }],
};

describe('AIPipeline', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset());
    mocks.calculateTypingDelay.mockReturnValue(0);
    mocks.getRandomDelay.mockReturnValue(0);
    mocks.compressContext.mockReturnValue({ compressed: false, messages: baseChat.messages });
    mocks.buildMemoryBlock.mockResolvedValue('');
    mocks.buildGroupContextBlock.mockReturnValue('');
  });

  it('test_when_trigger_ai_not_found_should_exit_early', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'not-found' });

    // Then
    expect(callbacks.onTyping).not.toHaveBeenCalled();
    expect(mocks.callAI).not.toHaveBeenCalled();
  });

  it('test_when_call_ai_returns_null_should_stop_typing', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValue(null);

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'ai-1' });

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith('chat-1', 'ai-1', true);
    expect(callbacks.onTyping).toHaveBeenCalledWith('chat-1', 'ai-1', false);
    expect(callbacks.onMessage).not.toHaveBeenCalled();
  });

  it('test_when_tool_call_success_should_recurse_with_tool_result', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.executeTool.mockResolvedValue('tool output');
    mocks.callAI
      .mockResolvedValueOnce('[TOOL_CALL: execute_math {"expression":"1+1"}]')
      .mockResolvedValueOnce('final answer');

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'ai-1' });

    // Then
    expect(mocks.executeTool).toHaveBeenCalledWith(
      'execute_math',
      { expression: '1+1' },
      { personas, requesterId: 'ai-1' }
    );
    expect(callbacks.onMessage).toHaveBeenCalledWith('chat-1', 'final answer', 'ai-1');
  });

  it('test_when_tool_call_json_invalid_should_recurse_with_tool_error', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI
      .mockResolvedValueOnce('[TOOL_CALL: execute_math {oops}]')
      .mockResolvedValueOnce('fallback answer');

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'ai-1' });

    // Then
    const secondCallMessages = mocks.callAI.mock.calls[1][0];
    expect(secondCallMessages.some((m) => m.content.includes('[TOOL_ERROR]'))).toBe(true);
    expect(callbacks.onMessage).toHaveBeenCalledWith('chat-1', 'fallback answer', 'ai-1');
  });

  it('test_when_memory_request_success_should_recurse_with_memory_result', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.executeTool.mockResolvedValue('memory result');
    mocks.callAI
      .mockResolvedValueOnce('[MEMORY_REQUEST: target=Luna, topic=food]')
      .mockResolvedValueOnce('after memory');

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'ai-1' });

    // Then
    expect(mocks.executeTool).toHaveBeenCalledWith(
      'MEMORY_REQUEST',
      { target: 'Luna', topic: 'food' },
      { personas, requesterId: 'ai-1' }
    );
    expect(callbacks.onMessage).toHaveBeenCalledWith('chat-1', 'after memory', 'ai-1');
  });

  it('test_when_response_contains_silence_should_not_send_message', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValue('[SILENCE]');

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'ai-1' });

    // Then
    expect(callbacks.onMessage).not.toHaveBeenCalled();
    expect(callbacks.onTyping).toHaveBeenCalledWith('chat-1', 'ai-1', false);
  });

  it('test_when_response_contains_multi_and_schedule_should_emit_multiple_messages_and_schedule', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValue('[SCHEDULE:5][MULTI:first|second] tail');

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'ai-1' });

    // Then
    expect(callbacks.onSchedule).toHaveBeenCalledWith('chat-1', personas[0], 5);
    expect(callbacks.onMessage).toHaveBeenNthCalledWith(1, 'chat-1', 'first', 'ai-1');
    expect(callbacks.onMessage).toHaveBeenNthCalledWith(2, 'chat-1', 'second', 'ai-1');
    expect(callbacks.onMessage).toHaveBeenNthCalledWith(3, 'chat-1', 'tail', 'ai-1');
  });

  it('test_when_response_is_empty_should_stop_typing_without_sending_message', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValue('');

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'ai-1' });

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith('chat-1', 'ai-1', false);
    expect(callbacks.onMessage).not.toHaveBeenCalled();
  });

  it('test_when_context_is_compressed_should_trigger_async_memory_extraction', async () => {
    // Given
    const { pipeline } = createPipeline();
    const manyMessages = Array.from({ length: 20 }, (_, idx) => ({
      id: `m-${idx}`,
      senderId: idx % 2 === 0 ? 'user-me' : 'ai-1',
      content: `msg-${idx}`,
      timestamp: `2026-02-23T00:${String(idx).padStart(2, '0')}:00.000Z`,
    }));
    mocks.compressContext.mockReturnValue({
      compressed: true,
      summary: '[summary]',
      recentMessages: manyMessages.slice(-8),
    });
    mocks.callAI.mockResolvedValue('done');

    // When
    await pipeline.processTurn({ ...baseChat, messages: manyMessages }, personas, { id: 'ai-1' });

    // Then
    expect(mocks.extractMemoriesAsync).toHaveBeenCalledWith(
      manyMessages.slice(0, -8),
      'ai-1',
      'Luna'
    );
  });

  it('test_when_memory_request_tool_throws_should_continue_with_tool_error_history', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.executeTool.mockRejectedValue(new Error('memory unavailable'));
    mocks.callAI
      .mockResolvedValueOnce('[MEMORY_REQUEST: target=Luna, topic=history]')
      .mockResolvedValueOnce('fallback after memory error');

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'ai-1' });

    // Then
    const secondCallMessages = mocks.callAI.mock.calls[1][0];
    expect(secondCallMessages.some((m) => m.content.includes('Memory exchange failed'))).toBe(true);
    expect(callbacks.onMessage).toHaveBeenCalledWith('chat-1', 'fallback after memory error', 'ai-1');
  });

  it('test_when_process_turn_dependencies_throw_should_catch_and_stop_typing', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.buildMemoryBlock.mockRejectedValue(new Error('memory db failed'));

    // When
    await pipeline.processTurn(baseChat, personas, { id: 'ai-1' });

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith('chat-1', 'ai-1', false);
  });

  it('test_when_depth_exceeds_limit_should_stop_recursion', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();

    // When
    await pipeline._runReActLoop('chat-1', personas[0], 'sys', [], 4, personas);

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith('chat-1', 'ai-1', false);
    expect(mocks.callAI).not.toHaveBeenCalled();
  });

  it('test_when_handle_final_response_receives_null_should_only_stop_typing', async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();

    // When
    await pipeline._handleFinalResponse('chat-1', personas[0], null);

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith('chat-1', 'ai-1', false);
    expect(callbacks.onMessage).not.toHaveBeenCalled();
  });

  it('test_when_prepare_history_starts_with_assistant_should_prepend_summary_user_message', () => {
    // Given
    const { pipeline } = createPipeline();
    const messages = [
      { id: 'm2', senderId: 'ai-1', content: '[POLL:poll-1]' },
      { id: 'm3', senderId: 'ai-1', content: 'another' },
    ];

    // When
    const history = pipeline._prepareHistory(messages, personas, true, '[summary]', baseChat.polls);

    // Then
    expect(history[0]).toEqual({ role: 'user', content: '[summary]' });
    expect(history[1].content).toContain('Poll created');
  });

  it('test_when_generate_system_prompt_uses_context_should_emit_relationship_mood_and_tool_lines', () => {
    // Given
    const { pipeline } = createPipeline();

    // When
    const soulmate = pipeline._generateSystemPrompt(
      personas[0],
      { intimacyLevel: 5, mood: { promptHint: 'happy' } },
      '\nMEMORY\n',
      '\nGROUP\n'
    );
    const closeFriend = pipeline._generateSystemPrompt(personas[0], { intimacyLevel: 4 }, '', '');
    const goodFriend = pipeline._generateSystemPrompt(personas[0], { intimacyLevel: 3 }, '', '');
    const friend = pipeline._generateSystemPrompt(personas[0], { intimacyLevel: 2 }, '', '');
    const acquaintance = pipeline._generateSystemPrompt(personas[0], { intimacyLevel: 1 }, '', '');

    // Then
    expect(soulmate).toContain('RELATIONSHIP: soulmate');
    expect(soulmate).toContain('CURRENT MOOD: happy');
    expect(soulmate).toContain('[TOOL_CALL: execute_math ...arguments]');
    expect(closeFriend).toContain('RELATIONSHIP: close friend');
    expect(goodFriend).toContain('RELATIONSHIP: good friend');
    expect(friend).toContain('RELATIONSHIP: friend');
    expect(acquaintance).toContain('RELATIONSHIP: acquaintance');
  });

  it('test_when_generate_system_prompt_without_optional_context_should_keep_base_rules_only', () => {
    // Given
    const { pipeline } = createPipeline();

    // When
    const prompt = pipeline._generateSystemPrompt(
      { id: 'ai-x', name: 'Edge', personality: 'calm', style: 'brief', agentType: 'companion' },
      null,
      '',
      ''
    );

    // Then
    expect(prompt).toContain('You are Edge');
    expect(prompt).toContain('RULES: concise');
    expect(prompt.includes('RELATIONSHIP:')).toBe(false);
    expect(prompt.includes('CURRENT MOOD:')).toBe(false);
  });
});
