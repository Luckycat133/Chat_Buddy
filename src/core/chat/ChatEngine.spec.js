import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeChat, normalizeMessage, getDirectPeerId, getChatActivityTimestamp, isTaskParticipant } from './ChatNormalizer';

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
    chatStorage: {
      migrateFromLocalStorage: vi.fn().mockResolvedValue(undefined),
      loadChats: vi.fn().mockResolvedValue(null),
      saveChats: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../services/storage/ChatStorageService', () => ({
  default: mocks.chatStorage,
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
    mocks.chatStorage.migrateFromLocalStorage.mockReset();
    mocks.chatStorage.migrateFromLocalStorage.mockResolvedValue(undefined);
    mocks.chatStorage.loadChats.mockReset();
    mocks.chatStorage.loadChats.mockResolvedValue(null);
    mocks.chatStorage.saveChats.mockReset();
    mocks.chatStorage.saveChats.mockResolvedValue(undefined);
    mocks.cleanMessageContent.mockReset();
    mocks.cleanMessageContent.mockImplementation((content) => String(content || '').trim());
    mocks.callAI.mockReset();
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
    expect(mocks.callAI).not.toHaveBeenCalled();
    expect(engine.chats[0].name).toBe('hello world');
    expect(mocks.processTurn).toHaveBeenCalled();
  });

  it('test_when_user_message_contains_brackets_should_preserve_the_original_text', () => {
    const engine = createEngineWithChats([
      { id: 'chat-1', name: 'Code Chat', participants: ['user-me', 'ai-1'], messages: [] },
    ]);
    const codeMessage = 'function first(xs) { return xs[1]; }';

    engine.sendMessage('chat-1', codeMessage);

    expect(engine.chats[0].messages[0].content).toBe(codeMessage);
    expect(mocks.cleanMessageContent).not.toHaveBeenCalled();
  });

  it('test_when_ai_message_is_received_should_apply_control_marker_cleaning', () => {
    const engine = createEngineWithChats([
      { id: 'chat-1', name: 'Code Chat', participants: ['user-me', 'ai-1'], messages: [] },
    ]);
    mocks.cleanMessageContent.mockReturnValue('const first = xs[0];');

    engine.sendMessage('chat-1', '[SCHEDULE:1] const first = xs[0];', 'ai-1');

    expect(mocks.cleanMessageContent).toHaveBeenCalledWith('[SCHEDULE:1] const first = xs[0];');
    expect(engine.chats[0].messages[0].content).toBe('const first = xs[0];');
  });

  it('test_when_ai_repeats_its_speaker_label_should_strip_all_leading_labels', () => {
    const engine = createEngineWithChats([
      { id: 'chat-1', name: 'Luna', participants: ['user-me', 'ai-1'], messages: [] },
    ]);
    mocks.cleanMessageContent.mockImplementation((content) => content);

    engine.sendMessage('chat-1', 'Luna: Luna：月光正好。', 'ai-1');

    expect(engine.chats[0].messages[0].content).toBe('月光正好。');
  });

  it('test_when_direct_chat_ai_is_busy_should_keep_the_next_user_message_unsent', () => {
    const engine = createEngineWithChats([
      { id: 'chat-1', name: 'Luna', participants: ['user-me', 'ai-1'], messages: [] },
    ]);
    engine.typingIndicators['chat-1'] = ['ai-1'];

    const result = engine.sendMessage('chat-1', '等你回复完再说');

    expect(result).toEqual({ success: false, error: 'ai_busy' });
    expect(engine.chats[0].messages).toHaveLength(0);
    expect(mocks.processTurn).not.toHaveBeenCalled();
  });

  it('test_when_direct_ai_turn_starts_should_mark_busy_immediately_until_pipeline_finishes', async () => {
    let resolveTurn;
    mocks.processTurn.mockImplementationOnce(() => new Promise(resolve => { resolveTurn = resolve; }));
    const engine = createEngineWithChats([
      { id: 'chat-1', name: 'Luna', participants: ['user-me', 'ai-1'], messages: [] },
    ]);

    engine.sendMessage('chat-1', '第一条');

    expect(engine.typingIndicators['chat-1']).toEqual(['ai-1']);
    expect(engine.sendMessage('chat-1', '第二条')).toEqual({ success: false, error: 'ai_busy' });

    resolveTurn();
    await Promise.resolve();
    await Promise.resolve();
    expect(engine.typingIndicators['chat-1']).toBeUndefined();
  });

  it('test_when_ai_turn_fails_should_store_a_retryable_error_and_retry_the_same_user_turn', async () => {
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        name: 'Luna',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'user-1', senderId: 'user-me', content: '你好', timestamp: '2026-08-13T00:00:00.000Z' }],
      },
    ]);

    engine.aiPipeline.callbacks.onError('chat-1', 'ai-1', {
      status: 504,
      userMessageId: 'user-1',
      language: 'zh',
    });
    const errorMessage = engine.chats[0].messages.at(-1);

    expect(errorMessage).toMatchObject({
      senderId: 'ai-1',
      type: 'ai_error',
      status: 'error',
      retryUserMessageId: 'user-1',
    });
    expect(errorMessage.content).toContain('504');

    const retryResult = engine.retryAIResponse('chat-1', errorMessage.id);
    expect(retryResult).toEqual({ success: true });
    expect(engine.chats[0].messages.some(message => message.id === errorMessage.id)).toBe(false);
    expect(mocks.processTurn).toHaveBeenCalledWith(
      expect.objectContaining({ lastMessage: expect.objectContaining({ id: 'user-1' }) }),
      personas,
      expect.objectContaining({ id: 'ai-1' }),
      expect.any(Object),
    );
  });

  it('test_when_user_moves_on_after_a_failed_turn_should_remove_the_stale_retry_card', () => {
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        name: 'Luna',
        participants: ['user-me', 'ai-1'],
        messages: [
          { id: 'user-1', senderId: 'user-me', content: '第一问', timestamp: '2026-08-13T00:00:00.000Z' },
          { id: 'error-1', senderId: 'ai-1', type: 'ai_error', content: '失败', retryUserMessageId: 'user-1', timestamp: '2026-08-13T00:01:00.000Z' },
        ],
      },
    ]);

    engine.sendMessage('chat-1', '换个话题继续');

    expect(engine.chats[0].messages.map(message => message.id)).not.toContain('error-1');
    expect(engine.chats[0].messages.at(-1).content).toBe('换个话题继续');
  });

  it('test_when_model_only_returns_reasoning_should_show_an_explicit_safe_error', () => {
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        name: 'Luna',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'user-1', senderId: 'user-me', content: '详细分析', timestamp: '2026-08-13T00:00:00.000Z' }],
      },
    ]);

    engine.aiPipeline.callbacks.onError('chat-1', 'ai-1', {
      code: 'reasoning_only_response',
      userMessageId: 'user-1',
      language: 'zh',
    });

    expect(engine.chats[0].messages.at(-1)).toMatchObject({
      type: 'ai_error',
      errorCode: 'reasoning_only_response',
      content: expect.stringContaining('内部推理'),
    });
  });

  it('test_when_ai_streams_should_update_one_ephemeral_message_then_finalize_and_persist_it', () => {
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        name: 'Luna',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'user-1', senderId: 'user-me', content: '请详细回答', timestamp: '2026-08-13T00:00:00.000Z' }],
      },
    ]);

    engine.aiPipeline.callbacks.onStream('chat-1', 'ai-1', '第一段');
    const streamId = engine.chats[0].messages.at(-1).id;
    engine.aiPipeline.callbacks.onStream('chat-1', 'ai-1', '第一段和第二段');

    expect(engine.chats[0].messages).toHaveLength(2);
    expect(engine.chats[0].messages.at(-1)).toMatchObject({
      id: streamId,
      type: 'ai_stream',
      status: 'streaming',
      content: '第一段和第二段',
    });

    engine.aiPipeline.callbacks.onMessage('chat-1', 'ai-1 最终回答', 'ai-1');

    expect(engine.chats[0].messages).toHaveLength(2);
    expect(engine.chats[0].messages.at(-1)).toMatchObject({
      id: streamId,
      status: 'sent',
      content: 'ai-1 最终回答',
    });
    expect(engine.chats[0].messages.at(-1)).not.toHaveProperty('type');
  });

  it('test_when_chat_changes_should_replace_array_reference_for_external_store_subscribers', () => {
    const engine = createEngineWithChats([
      { id: 'chat-1', name: 'Chat', participants: ['user-me', 'ai-2'], messages: [] },
    ]);
    const previousChats = engine.chats;
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.sendMessage('chat-1', 'visible immediately');

    expect(engine.chats).not.toBe(previousChats);
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.lastCall[0].chats).toBe(engine.chats);
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
    expect(result.success).toBe(false);
    expect(result.error).toBe('Poll has expired');
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
    expect(result.success).toBe(true);
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

  it('test_when_clear_chat_messages_with_pending_schedule_should_cancel_timeouts', () => {
    // Given
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'm1', senderId: 'user-me', content: 'old', timestamp: '2020-01-01T00:00:00.000Z' }],
      },
    ]);
    engine._handleAISchedule('chat-1', personas[0], 1);

    // When
    engine.clearChatMessages('chat-1');

    // Then
    expect(engine._scheduledMessages.size).toBe(0);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('test_when_scheduled_callback_runs_after_chat_cleared_should_not_throw', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'm1', senderId: 'user-me', content: 'old', timestamp: '2020-01-01T00:00:00.000Z' }],
      },
    ]);
    engine._handleAISchedule('chat-1', personas[0], 1);
    engine.clearChatMessages('chat-1');

    // When / Then
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow();
    expect(mocks.processTurn).not.toHaveBeenCalled();
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
    // When
    const invalidChat = normalizeChat(null);
    const invalidMessage = normalizeMessage({ id: 'm1', senderId: null, content: 'x' });
    const minimalMessage = normalizeMessage({ id: 'm2', senderId: 'ai-1', content: 'ok' });

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

  it('test_when_pin_and_unread_flags_change_should_update_chat_metadata', () => {
    // Given
    const engine = createEngineWithChats([
      { id: 'chat-1', participants: ['user-me', 'ai-1'], messages: [], isPinned: false, isUnread: false },
    ]);

    // When
    engine.pinChat('chat-1', true);
    engine.markChatUnread('chat-1', true);

    // Then
    expect(engine.chats[0]).toMatchObject({ isPinned: true, isUnread: true });
  });

  it('test_when_helper_guards_and_fallbacks_run_should_return_safe_values', () => {
    // When / Then
    expect(isTaskParticipant('user-me')).toBe(false);
    expect(isTaskParticipant('agent-custom')).toBe(true);
    expect(getDirectPeerId(null)).toBeNull();
    expect(getDirectPeerId({ participants: ['ai-1', 'ai-2'] })).toBeNull();
    expect(getDirectPeerId({ participants: ['user-me', 'ai-2'] })).toBe('ai-2');
    expect(getChatActivityTimestamp({ createdAt: '2024-01-01T00:00:00.000Z' })).toBe('2024-01-01T00:00:00.000Z');
    expect(getChatActivityTimestamp({})).toBe(new Date(0).toISOString());
  });

  it('test_when_init_finds_duplicate_social_direct_chats_should_merge_cluster_and_persist', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-old',
        name: 'New Chat',
        participants: ['user-me', 'ai-2'],
        createdAt: '2026-02-20T00:00:00.000Z',
        updatedAt: '2026-02-20T00:00:00.000Z',
        messages: [{ id: 'm1', senderId: 'user-me', content: 'first', timestamp: '2026-02-20T00:00:00.000Z' }],
      },
      {
        id: 'chat-new',
        name: 'Max',
        avatar: 'max.png',
        participants: ['user-me', 'ai-2'],
        createdAt: '2026-02-21T00:00:00.000Z',
        updatedAt: '2026-02-21T00:00:00.000Z',
        messages: [{ id: 'm2', senderId: 'ai-2', content: 'second', timestamp: '2026-02-21T00:00:00.000Z' }],
      },
      {
        id: 'task-chat',
        name: 'Task',
        participants: ['user-me', 'ai-1'],
        messages: [],
      },
    ]);

    // Then
    expect(engine.chats).toHaveLength(2);
    const merged = engine.chats.find((chat) => chat.participants.includes('ai-2'));
    expect(merged).toMatchObject({ name: 'Max', avatar: 'max.png' });
    expect(merged.messages.map((message) => message.id)).toEqual(['m1', 'm2']);
    expect(mocks.storage.set).toHaveBeenCalledWith('chat-buddy-chats', expect.any(Array));
  });

  it('test_when_indexeddb_snapshot_differs_should_replace_chats_with_hydrated_data', async () => {
    // Given
    mocks.chatStorage.loadChats.mockResolvedValueOnce([
      {
        id: 'chat-indexed',
        participants: ['user-me', 'ai-2'],
        messages: [{ id: 'm9', senderId: 'ai-2', content: 'hydrated', timestamp: '2026-02-24T00:00:00.000Z' }],
      },
    ]);
    seedCanonicalChats([{ id: 'chat-local', participants: ['user-me', 'ai-1'], messages: [] }]);
    const engine = new ChatEngine();
    createdEngines.push(engine);

    // When
    engine.init(personas);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Then
    expect(mocks.chatStorage.migrateFromLocalStorage).toHaveBeenCalledWith(['chat-buddy-chats', 'chat-buddy:chat-buddy-chats']);
    expect(engine.chats).toHaveLength(1);
    expect(engine.chats[0]).toMatchObject({ id: 'chat-indexed' });
    expect(mocks.storage.set).toHaveBeenCalledWith('chat-buddy-chats', expect.arrayContaining([expect.objectContaining({ id: 'chat-indexed' })]));
  });

  it('test_when_user_sends_during_hydration_should_keep_newer_in_memory_state', async () => {
    // Given
    let resolveHydration;
    mocks.chatStorage.loadChats.mockReturnValueOnce(new Promise((resolve) => {
      resolveHydration = resolve;
    }));
    seedCanonicalChats([{ id: 'chat-1', participants: ['user-me', 'ai-1'], messages: [] }]);
    const engine = new ChatEngine();
    createdEngines.push(engine);
    engine.init(personas);

    // When
    engine.sendMessage('chat-1', 'new message');
    resolveHydration([{ id: 'chat-1', participants: ['user-me', 'ai-1'], messages: [] }]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Then
    expect(engine.chats[0].messages).toHaveLength(1);
    expect(engine.chats[0].messages[0].content).toBe('new message');
    expect(mocks.chatStorage.saveChats).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({
        id: 'chat-1',
        messages: expect.arrayContaining([expect.objectContaining({ content: 'new message' })]),
      })]),
    );
  });

  it('test_when_delete_message_should_recompute_summary_and_remove_pin', () => {
    // Given
    const engine = createEngineWithChats([{
      id: 'chat-1',
      createdAt: '2026-02-20T00:00:00.000Z',
      participants: ['user-me', 'ai-1'],
      messages: [
        { id: 'm1', senderId: 'user-me', content: 'first', timestamp: '2026-02-21T00:00:00.000Z' },
        { id: 'm2', senderId: 'ai-1', content: 'second', timestamp: '2026-02-22T00:00:00.000Z' },
      ],
      lastMessage: { id: 'm2', senderId: 'ai-1', content: 'second', timestamp: '2026-02-22T00:00:00.000Z' },
      pinnedMessages: ['m2'],
    }]);

    // When
    engine.deleteMessage('chat-1', 'm2');

    // Then
    expect(engine.chats[0].lastMessage).toMatchObject({ id: 'm1', content: 'first' });
    expect(engine.chats[0].updatedAt).toBe('2026-02-21T00:00:00.000Z');
    expect(engine.chats[0].pinnedMessages).toEqual([]);
  });

  it('test_when_guarded_mutation_methods_receive_missing_targets_should_noop', () => {
    // Given
    const engine = createEngineWithChats([{ id: 'chat-1', participants: ['user-me', 'ai-1'], messages: [] }]);
    mocks.storage.set.mockClear();

    // When
    expect(engine._handleToolStart('missing', 'ai-1', 'execute_math', { expression: '1+1' })).toBeNull();
    engine.updateChat('missing', { name: 'ignored' });
    engine.pinChat('missing', true);
    engine.markChatUnread('missing', true);
    engine.deleteChat('missing');
    engine.clearChatMessages('missing');
    engine.pinMessage('missing', 'm1', true);
    engine.markMessagesAsRead('missing', 'user-me');
    engine._handleToolEnd('missing', 'tool-id', 'ok', null);
    engine._handleToolEnd('chat-1', null, 'ok', null);

    // Then
    expect(mocks.storage.set).not.toHaveBeenCalled();
  });

  it('test_when_pin_message_already_exists_and_messages_are_already_read_should_avoid_extra_mutation', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        pinnedMessages: ['m1'],
        messages: [{ id: 'm1', senderId: 'ai-1', content: 'hi', readBy: ['user-me'] }],
      },
    ]);
    mocks.storage.set.mockClear();

    // When
    engine.pinMessage('chat-1', 'm1', true);
    engine.markMessagesAsRead('chat-1', 'user-me');
    engine.pinMessage('chat-1', 'm1', false);
    vi.advanceTimersByTime(0);

    // Then
    expect(engine.chats[0].pinnedMessages).toEqual([]);
    expect(mocks.storage.set).toHaveBeenCalledTimes(1);
  });

  it('test_when_tool_event_finishes_with_error_or_unknown_tool_should_store_fallback_metadata', () => {
    // Given
    const engine = createEngineWithChats([
      { id: 'chat-1', participants: ['user-me', 'ai-1'], messages: [] },
    ]);

    // When
    const runCodeId = engine._handleToolStart('chat-1', 'ai-1', 'run_code', { language: 'js' });
    const fallbackId = engine._handleToolStart('chat-1', 'ai-1', 'mystery_tool', {});
    engine._handleToolEnd('chat-1', runCodeId, null, 'boom');

    // Then
    const runCodeMessage = engine.chats[0].messages.find((message) => message.id === runCodeId);
    const fallbackMessage = engine.chats[0].messages.find((message) => message.id === fallbackId);
    expect(runCodeMessage).toMatchObject({ status: 'error', inputSummary: 'Running js code…', outputDetail: 'boom' });
    expect(fallbackMessage.inputSummary).toBe('Running tool: mystery_tool…');
  });

  it('test_when_schedule_delay_is_satisfied_should_send_local_template_without_llm', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'm1', senderId: 'user-me', content: 'old', timestamp: '2020-01-01T00:00:00.000Z' }],
      },
    ]);

    // When
    engine._handleAISchedule('chat-1', personas[0], 1);
    vi.advanceTimersByTime(60_000);

    // Then
    expect(mocks.processTurn).not.toHaveBeenCalled();
    expect(engine.chats[0].messages.at(-1)).toMatchObject({
      senderId: 'ai-1',
      content: '回来时跟我说一声，我还在这里。',
    });
  });

  it('test_when_group_chat_has_no_mentions_should_select_exactly_one_responder', () => {
    // Given
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const engine = createEngineWithChats([
      {
        id: 'group-1',
        participants: ['user-me', 'ai-1', 'ai-2'],
        messages: [{ id: 'm1', senderId: 'user-me', content: 'hello everyone', timestamp: '2026-02-23T00:00:00.000Z' }],
        lastMessage: { id: 'm1', senderId: 'user-me', content: 'hello everyone', timestamp: '2026-02-23T00:00:00.000Z' },
      },
    ]);
    mocks.processTurn.mockClear();

    // When
    engine._triggerAIResponse(engine.chats[0]);

    // Then
    expect(mocks.processTurn).toHaveBeenCalledTimes(1);
    expect(mocks.processTurn).toHaveBeenCalledWith(
      engine.chats[0],
      personas,
      expect.objectContaining({ id: 'ai-1' }),
      expect.objectContaining({ isGroupChat: true })
    );
    randomSpy.mockRestore();
  });

  it('test_when_ai_recall_targets_missing_or_already_recalled_messages_should_noop', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'm1', senderId: 'ai-1', content: 'done', recalled: true }],
      },
    ]);
    mocks.storage.set.mockClear();

    // When
    engine._handleAIRecall('missing', 'ai-1');
    engine._handleAIRecall('chat-1', 'ai-1');

    // Then
    expect(mocks.storage.set).not.toHaveBeenCalled();
  });

  it('test_when_delete_chat_runs_should_remove_chat_typing_state_and_schedules', () => {
    // Given
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'm1', senderId: 'user-me', content: 'hello', timestamp: '2026-02-23T00:00:00.000Z' }],
      },
      {
        id: 'chat-2',
        participants: ['user-me', 'ai-2'],
        messages: [],
      },
    ]);
    engine.typingIndicators['chat-1'] = ['ai-1'];
    engine._handleAISchedule('chat-1', personas[0], 1);

    // When
    engine.deleteChat('chat-1');

    // Then
    expect(engine.chats.map((chat) => chat.id)).toEqual(['chat-2']);
    expect(engine.typingIndicators['chat-1']).toBeUndefined();
    expect(engine._scheduledMessages.size).toBe(0);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('test_when_clear_chat_messages_runs_should_reset_messages_last_message_and_pins', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'm1', senderId: 'user-me', content: 'hello', timestamp: '2026-02-23T00:00:00.000Z' }],
        lastMessage: { id: 'm1', senderId: 'user-me', content: 'hello' },
        pinnedMessages: ['m1'],
      },
    ]);

    // When
    engine.clearChatMessages('chat-1');

    // Then
    expect(engine.chats[0].messages).toEqual([]);
    expect(engine.chats[0].lastMessage).toBeNull();
    expect(engine.chats[0].pinnedMessages).toEqual([]);
  });

  it('test_when_create_chat_reuses_existing_social_direct_chat_should_return_existing_id_and_merge_metadata', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        name: 'New Chat',
        avatar: null,
        participants: ['user-me', 'ai-2'],
        messages: [],
        createdAt: '2026-02-20T00:00:00.000Z',
        updatedAt: '2026-02-20T00:00:00.000Z',
      },
    ]);

    // When
    const reusedId = engine.createChat('Max Thread', ['ai-2'], 'max.png');

    // Then
    expect(reusedId).toBe('chat-1');
    expect(engine.chats).toHaveLength(1);
    expect(engine.chats[0]).toMatchObject({ name: 'Max Thread', avatar: 'max.png' });
  });

  it('test_when_bookmark_and_tool_event_helpers_run_should_update_message_metadata', () => {
    // Given
    mocks.addBookmark.mockReturnValue(true);
    mocks.getBookmarks.mockReturnValue([{ messageId: 'm1' }]);
    mocks.isBookmarked.mockReturnValue(true);
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        name: 'Task Chat',
        participants: ['user-me', 'ai-1'],
        messages: [{ id: 'm1', senderId: 'ai-1', content: 'hello', timestamp: '2026-02-23T00:00:00.000Z' }],
      },
    ]);

    // When
    const bookmarkResult = engine.bookmarkMessage('chat-1', 'm1');
    const toolMsgId = engine._handleToolStart('chat-1', 'ai-1', 'execute_math', { expression: '1+1' });
    engine._handleToolEnd('chat-1', toolMsgId, 'x'.repeat(600), null);
    const unbookmarkResult = engine.unbookmarkMessage('m1');

    // Then
    expect(bookmarkResult).toEqual({ success: true, isBookmarked: true });
    expect(engine.getBookmarkedMessages()).toEqual([{ messageId: 'm1' }]);
    expect(engine.isMessageBookmarked('m1')).toBe(true);
    expect(unbookmarkResult).toEqual({ success: true, isBookmarked: false });
    const toolMessage = engine.chats[0].messages.find((msg) => msg.id === toolMsgId);
    expect(toolMessage).toMatchObject({ type: 'tool_event', status: 'success' });
    expect(toolMessage.outputDetail.endsWith('…')).toBe(true);
  });

  it('test_when_ephemeral_ai_state_changes_should_serialize_and_recall_latest_message', () => {
    // Given
    const engine = createEngineWithChats([
      {
        id: 'chat-1',
        participants: ['user-me', 'ai-1'],
        messages: [
          { id: 'm1', senderId: 'ai-1', content: 'older', timestamp: '2026-02-23T00:00:00.000Z', readBy: [] },
          { id: 'm2', senderId: 'ai-1', content: 'latest', timestamp: '2026-02-23T00:01:00.000Z', readBy: [] },
        ],
      },
    ]);

    // When
    engine._handleAITyping('chat-1', 'ai-1', true);
    engine._handleAIEditing('chat-1', 'ai-1', true);
    engine._handleAIRecall('chat-1', 'ai-1');
    const state = engine.getState();
    engine._handleAITyping('chat-1', 'ai-1', false);
    engine._handleAIEditing('chat-1', 'ai-1', false);

    // Then
    expect(state.typingIndicators['chat-1']).toEqual(['ai-1']);
    expect(state.editingIndicators['chat-1']).toEqual(['ai-1']);
    expect(engine.chats[0].messages.find((message) => message.id === 'm2')).toMatchObject({ recalled: true });
    expect(engine.typingIndicators['chat-1']).toBeUndefined();
    expect(engine.editingIndicators['chat-1']).toBeUndefined();
  });

  it('test_when_persona_registration_and_callbacks_change_should_update_runtime_state', () => {
    // Given
    const engine = createEngineWithChats([]);
    const listener = vi.fn();
    const onUserMessage = vi.fn();
    const unsubscribe = engine.subscribe(listener, { emitCurrent: true });

    // When
    engine.addPersona({ id: 'agent-new', name: 'Nova' });
    engine.addPersona({ id: 'agent-new', name: 'Nova Prime' });
    const unregister = engine.registerOnUserMessage(onUserMessage);
    engine.setContextProvider(() => ({ intimacyLevel: 3 }));
    unregister();
    engine.removePersona('agent-new');
    unsubscribe();

    // Then
    expect(listener).toHaveBeenCalled();
    expect(engine.personas.find((persona) => persona.id === 'agent-new')).toBeUndefined();
    expect(engine._onUserMessageCallbacks).toEqual([]);
    expect(engine._contextProvider?.()).toEqual({ intimacyLevel: 3 });
  });
});
