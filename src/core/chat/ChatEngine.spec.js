import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const store = new Map();
  const processTurn = vi.fn();

  return {
    store,
    processTurn,
    storage: {
      get: vi.fn((key, defaultValue = null) => (store.has(key) ? store.get(key) : defaultValue)),
      set: vi.fn((key, value) => {
        store.set(key, value);
      }),
      remove: vi.fn((key) => {
        store.delete(key);
      }),
    },
    cleanMessageContent: vi.fn((content) => String(content || '').trim()),
    callAI: vi.fn(),
    extractGroupMemoriesAsync: vi.fn().mockResolvedValue(undefined),
    getPresenceMap: vi.fn(() => ({ 'ai-1': 'online' })),
    getMoodMap: vi.fn(() => ({ 'ai-1': { promptHint: 'happy' } })),
    checkReEngagement: vi.fn(() => null),
    addBookmark: vi.fn(() => true),
    removeBookmark: vi.fn(() => true),
    getBookmarks: vi.fn(() => []),
    isBookmarked: vi.fn(() => false),
  };
});

vi.mock('../../services/storage/StorageService', () => ({
  storage: mocks.storage,
}));

vi.mock('./AIPipeline', () => ({
  AIPipeline: class {
    constructor(callbacks) {
      this.callbacks = callbacks;
      this.processTurn = mocks.processTurn;
    }
  },
}));

vi.mock('../../features/chat/services/chatService', () => ({
  cleanMessageContent: mocks.cleanMessageContent,
  callAI: mocks.callAI,
}));

vi.mock('../memory/ContextCompressor', () => ({
  extractGroupMemoriesAsync: mocks.extractGroupMemoriesAsync,
}));

vi.mock('../presence/PresenceService', () => ({
  getPresenceMap: mocks.getPresenceMap,
}));

vi.mock('../presence/MoodService', () => ({
  getMoodMap: mocks.getMoodMap,
}));

vi.mock('../presence/GreetingService', () => ({
  checkReEngagement: mocks.checkReEngagement,
}));

vi.mock('../../features/chat/services/BookmarkService', () => ({
  addBookmark: mocks.addBookmark,
  removeBookmark: mocks.removeBookmark,
  getBookmarks: mocks.getBookmarks,
  isBookmarked: mocks.isBookmarked,
}));

import { ChatEngine } from './ChatEngine';

const personas = [
  { id: 'ai-1', name: 'Luna', agentType: 'task-specialist', personality: 'gentle', style: 'casual' },
  { id: 'ai-2', name: 'Max', agentType: 'companion', personality: 'fun', style: 'short' },
];
const createdEngines = [];

function seedCanonicalChats(chats) {
  mocks.store.set('chat-buddy-chats', chats);
}

function createEngineWithChats(chats) {
  seedCanonicalChats(chats);
  const engine = new ChatEngine();
  engine.init(personas);
  createdEngines.push(engine);
  return engine;
}

describe('ChatEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.store.clear();
    mocks.storage.get.mockClear();
    mocks.storage.set.mockClear();
    mocks.cleanMessageContent.mockReset();
    mocks.cleanMessageContent.mockImplementation((content) => String(content || '').trim());
    mocks.callAI.mockReset();
    mocks.callAI.mockResolvedValue('Auto title');
    mocks.extractGroupMemoriesAsync.mockClear();
    mocks.processTurn.mockClear();
    mocks.checkReEngagement.mockReset();
    mocks.checkReEngagement.mockReturnValue(null);
    mocks.addBookmark.mockClear();
    mocks.removeBookmark.mockClear();
    mocks.getBookmarks.mockClear();
    mocks.isBookmarked.mockClear();
  });

  afterEach(() => {
    while (createdEngines.length > 0) {
      const engine = createdEngines.pop();
      engine.destroy();
    }
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('test_when_legacy_storage_key_exists_should_migrate_and_store_metadata', () => {
    // Given
    mocks.store.set('chat-buddy:chat-buddy-chats', [
      { id: 'chat-legacy', participants: ['user-me', 'ai-1'], messages: [] },
    ]);

    // When
    const engine = new ChatEngine();
    engine.init(personas);
    createdEngines.push(engine);

    // Then
    expect(engine.chats).toHaveLength(1);
    expect(mocks.storage.set).toHaveBeenCalledWith('chat-buddy-chats', expect.any(Array));
    expect(mocks.storage.set).toHaveBeenCalledWith(
      'migrations',
      expect.objectContaining({
        chatStorageV2: expect.objectContaining({
          from: 'chat-buddy:chat-buddy-chats',
          to: 'chat-buddy-chats',
        }),
      })
    );
  });

  it('test_when_send_message_with_empty_cleaned_content_should_not_mutate_chat', () => {
    // Given
    const engine = createEngineWithChats([
      { id: 'chat-1', participants: ['user-me', 'ai-1'], messages: [] },
    ]);
    mocks.storage.set.mockClear();
    mocks.cleanMessageContent.mockReturnValue('');

    // When
    engine.sendMessage('chat-1', '   ');

    // Then
    expect(engine.chats[0].messages).toHaveLength(0);
    expect(mocks.storage.set).not.toHaveBeenCalled();
  });

  it('test_when_send_message_to_valid_chat_should_append_message_and_trigger_ai_flow', async () => {
    // Given
    const engine = createEngineWithChats([
      { id: 'chat-1', name: 'Task Chat', participants: ['user-me', 'ai-1'], messages: [] },
    ]);
    const onUserMessage = vi.fn();
    engine.registerOnUserMessage(onUserMessage);

    // When
    engine.sendMessage('chat-1', 'hello world');
    await Promise.resolve();

    // Then
    expect(engine.chats[0].messages).toHaveLength(1);
    expect(onUserMessage).toHaveBeenCalledWith('chat-1', ['ai-1']);
    expect(mocks.callAI).toHaveBeenCalled();
    expect(mocks.processTurn).toHaveBeenCalled();
  });

  it('test_when_group_chat_reaches_threshold_should_trigger_group_memory_extraction', async () => {
    // Given
    const oldMessages = Array.from({ length: 19 }, (_, idx) => ({
      id: `m-${idx}`,
      senderId: idx % 2 === 0 ? 'user-me' : 'ai-1',
      content: `message ${idx}`,
      timestamp: '2026-02-23T00:00:00.000Z',
      readBy: [],
    }));
    const engine = createEngineWithChats([
      {
        id: 'group-1',
        participants: ['user-me', 'ai-1', 'ai-2'],
        messages: oldMessages,
      },
    ]);

    // When
    engine.sendMessage('group-1', 'message 20');
    await Promise.resolve();

    // Then
    expect(mocks.extractGroupMemoriesAsync).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ content: 'message 20' })]),
      'group-1',
      [
        { id: 'ai-1', name: 'Luna' },
        { id: 'ai-2', name: 'Max' },
      ]
    );
  });

  it('test_when_vote_poll_expired_should_return_error', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [],
        polls: [
          {
            id: 'poll-1',
            question: 'Question?',
            expiresAt: '2020-01-01T00:00:00.000Z',
            options: [{ id: 'opt-1', text: 'A', votes: [] }],
          },
        ],
      },
    ]);

    // When
    const result = engine.votePoll('chat-1', 'poll-1', 'opt-1', 'switch');

    // Then
    expect(result).toEqual({ success: false, error: 'Poll has expired' });
  });

  it('test_when_vote_poll_switch_should_toggle_and_clear_other_options', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [],
        polls: [
          {
            id: 'poll-1',
            options: [
              { id: 'opt-1', text: 'A', votes: [] },
              { id: 'opt-2', text: 'B', votes: ['user-me'] },
            ],
          },
        ],
      },
    ]);

    // When
    const result = engine.votePoll('chat-1', 'poll-1', 'opt-1', 'switch');

    // Then
    expect(result).toEqual({ success: true });
    const poll = engine.chats[0].polls[0];
    expect(poll.options[0].votes).toContain('user-me');
    expect(poll.options[1].votes).not.toContain('user-me');
  });

  it('test_when_mark_messages_as_read_should_only_mark_other_senders', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [
          { id: 'u1', senderId: 'user-me', content: 'mine', readBy: [] },
          { id: 'a1', senderId: 'ai-1', content: 'ai', readBy: [] },
        ],
      },
    ]);

    // When
    engine.markMessagesAsRead('chat-1', 'user-me');

    // Then
    const userMsg = engine.chats[0].messages.find((m) => m.id === 'u1');
    const aiMsg = engine.chats[0].messages.find((m) => m.id === 'a1');
    expect(userMsg.readBy).toEqual([]);
    expect(aiMsg.readBy).toEqual(['user-me']);
  });

  it('test_when_schedule_minutes_invalid_should_clamp_and_schedule_once', () => {
    // Given
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'm1', senderId: 'user-me', content: 'old', timestamp: '2020-01-01T00:00:00.000Z' }],
      },
    ]);

    // When
    engine._handleAISchedule('chat-1', personas[0], 0);
    engine._handleAISchedule('chat-1', personas[0], 99_999);
    vi.advanceTimersByTime(60_000);

    // Then
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 86_400_000);
    expect(mocks.processTurn).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('test_when_trigger_ai_response_in_group_should_respect_direct_mention_or_random_gate', () => {
    // Given
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const engine = createEngineWithChats([
      {
        id: 'group-1',
        participants: ['user-me', 'ai-1', 'ai-2'],
        messages: [{ id: 'm1', senderId: 'user-me', content: '@Luna reply please', timestamp: '2026-02-23T00:00:00.000Z' }],
        lastMessage: { id: 'm1', senderId: 'user-me', content: '@Luna reply please', timestamp: '2026-02-23T00:00:00.000Z' },
      },
    ]);

    // When
    engine._triggerAIResponse(engine.chats[0]);

    // Then
    expect(mocks.processTurn).toHaveBeenCalledTimes(1);
    expect(mocks.processTurn).toHaveBeenCalledWith(
      engine.chats[0],
      personas,
      expect.objectContaining({ id: 'ai-1' }),
      expect.objectContaining({ recentGroupMessages: expect.any(Array) })
    );
    randomSpy.mockRestore();
  });

  it('test_when_send_message_receives_null_or_undefined_should_not_mutate_chat', () => {
    // Given
    const engine = createEngineWithChats([
      { id: 'chat-1', participants: ['user-me', 'ai-1'], messages: [] },
    ]);
    mocks.cleanMessageContent.mockReturnValue('');
    mocks.storage.set.mockClear();

    // When
    engine.sendMessage('chat-1', null);
    engine.sendMessage('chat-1', undefined);

    // Then
    expect(engine.chats[0].messages).toHaveLength(0);
    expect(mocks.storage.set).not.toHaveBeenCalled();
  });

  it('test_when_vote_poll_uses_add_and_remove_actions_should_update_votes_consistently', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [],
        polls: [
          {
            id: 'poll-1',
            options: [
              { id: 'opt-1', text: 'A', votes: [] },
              { id: 'opt-2', text: 'B', votes: [] },
            ],
          },
        ],
      },
    ]);

    // When
    engine.votePoll('chat-1', 'poll-1', 'opt-1', 'add');
    engine.votePoll('chat-1', 'poll-1', 'opt-1', 'remove');

    // Then
    const votes = engine.chats[0].polls[0].options.find((o) => o.id === 'opt-1').votes;
    expect(votes).toEqual([]);
  });

  it('test_when_get_message_read_status_receives_missing_chat_or_message_should_return_unread_defaults', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'm1', senderId: 'ai-1', content: 'hi', readBy: [] }],
      },
    ]);

    // When
    const missingChat = engine.getMessageReadStatus('m1', 'chat-missing');
    const missingMessage = engine.getMessageReadStatus('missing', 'chat-1');

    // Then
    expect(missingChat).toEqual({ readBy: [], isRead: false });
    expect(missingMessage).toEqual({ readBy: [], isRead: false });
  });

  it('test_when_check_reengagement_returns_message_should_send_greeting_message', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [],
      },
    ]);
    mocks.checkReEngagement.mockReturnValue({
      chatId: 'chat-1',
      message: 'welcome back',
      personaId: 'ai-1',
    });

    // When
    engine._checkReEngagement();

    // Then
    expect(engine.chats[0].messages).toHaveLength(1);
    expect(engine.chats[0].messages[0].content).toBe('welcome back');
    expect(engine.chats[0].messages[0].senderId).toBe('ai-1');
  });

  it('test_when_normalize_receives_null_or_incomplete_entities_should_return_safe_defaults', () => {
    // Given
    const engine = createEngineWithChats([]);

    // When
    const invalidChat = engine._normalizeChat(null);
    const invalidMessage = engine._normalizeMessage({ id: 'm1', senderId: null, content: 'x' });
    const minimalMessage = engine._normalizeMessage({ id: 'm2', senderId: 'ai-1', content: 'ok' });

    // Then
    expect(invalidChat).toBeNull();
    expect(invalidMessage).toBeNull();
    expect(minimalMessage.status).toBe('sent');
    expect(minimalMessage.readBy).toEqual([]);
  });

  it('test_when_bookmark_target_is_missing_should_return_not_found_error_without_side_effects', () => {
    // Given
    const engine = createEngineWithChats([
      { id: 'chat-1', participants: ['user-me', 'ai-1'], messages: [] },
    ]);

    // When
    const missingChat = engine.bookmarkMessage('missing', 'm1');
    const missingMessage = engine.bookmarkMessage('chat-1', 'missing');

    // Then
    expect(missingChat).toEqual({ success: false, error: 'Chat not found' });
    expect(missingMessage).toEqual({ success: false, error: 'Message not found' });
    expect(mocks.addBookmark).not.toHaveBeenCalled();
  });
});
