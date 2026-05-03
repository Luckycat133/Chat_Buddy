import { describe, it, expect } from 'vitest';
import {
  normalizeMessage,
  normalizeChat,
  getDirectPeerId,
  getChatActivityTimestamp,
  isTaskParticipant,
} from './ChatNormalizer';

describe('normalizeMessage', () => {
  it('returns null for invalid input', () => {
    expect(normalizeMessage(null)).toBeNull();
    expect(normalizeMessage(undefined)).toBeNull();
    expect(normalizeMessage({})).toBeNull();
    expect(normalizeMessage({ id: '1', senderId: 's1' })).toBeNull();
  });

  it('normalizes a valid message', () => {
    const msg = { id: 'm1', senderId: 's1', content: 'hello' };
    const result = normalizeMessage(msg);
    expect(result).toMatchObject({ id: 'm1', senderId: 's1', content: 'hello' });
    expect(result.timestamp).toBeDefined();
    expect(result.status).toBe('sent');
    expect(Array.isArray(result.readBy)).toBe(true);
  });

  it('preserves existing timestamp and status', () => {
    const msg = { id: 'm2', senderId: 's2', content: 'hi', timestamp: '2024-01-01', status: 'delivered' };
    const result = normalizeMessage(msg);
    expect(result.timestamp).toBe('2024-01-01');
    expect(result.status).toBe('delivered');
  });
});

describe('normalizeChat', () => {
  it('returns null for invalid input', () => {
    expect(normalizeChat(null)).toBeNull();
    expect(normalizeChat({})).toBeNull();
  });

  it('normalizes chat with defaults', () => {
    const chat = { id: 'c1' };
    const result = normalizeChat(chat);
    expect(result.id).toBe('c1');
    expect(result.name).toBe('New Chat');
    expect(Array.isArray(result.messages)).toBe(true);
    expect(Array.isArray(result.participants)).toBe(true);
    expect(result.participants).toContain('user-me');
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('normalizes messages inside chat', () => {
    const chat = {
      id: 'c2',
      messages: [{ id: 'm1', senderId: 's1', content: 'hello' }],
    };
    const result = normalizeChat(chat);
    expect(result.messages).toHaveLength(1);
    expect(result.lastMessage.id).toBe('m1');
  });
});

describe('getDirectPeerId', () => {
  it('returns peer id for direct chat', () => {
    const chat = { participants: ['user-me', 'bot-a'] };
    expect(getDirectPeerId(chat)).toBe('bot-a');
  });

  it('returns null for group chat', () => {
    const chat = { participants: ['user-me', 'bot-a', 'bot-b'] };
    expect(getDirectPeerId(chat)).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(getDirectPeerId(null)).toBeNull();
    expect(getDirectPeerId({})).toBeNull();
  });
});

describe('getChatActivityTimestamp', () => {
  it('returns lastMessage timestamp', () => {
    const chat = { lastMessage: { timestamp: '2024-06-01' }, updatedAt: '2024-05-01' };
    expect(getChatActivityTimestamp(chat)).toBe('2024-06-01');
  });

  it('falls back to updatedAt', () => {
    const chat = { updatedAt: '2024-05-01' };
    expect(getChatActivityTimestamp(chat)).toBe('2024-05-01');
  });

  it('falls back to epoch for empty chat', () => {
    expect(getChatActivityTimestamp({})).toBe(new Date(0).toISOString());
  });
});

describe('isTaskParticipant', () => {
  it('returns true for task specialist agents', () => {
    const personas = [{ id: 'agent-1', agentType: 'task-specialist' }];
    expect(isTaskParticipant('agent-1', personas)).toBe(true);
  });

  it('returns true for agent-prefixed ids', () => {
    expect(isTaskParticipant('agent-abc', [])).toBe(true);
  });

  it('returns false for non-agent, non-specialist', () => {
    const personas = [{ id: 'persona-1', agentType: 'social' }];
    expect(isTaskParticipant('persona-1', personas)).toBe(false);
  });

  it('returns false for user-me', () => {
    expect(isTaskParticipant('user-me')).toBe(false);
  });
});
