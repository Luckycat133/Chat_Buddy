import { describe, it, expect } from 'vitest';
import { votePoll, buildToolInputSummary } from './ChatPollManager';

describe('votePoll', () => {
  const baseChat = {
    id: 'c1',
    polls: [{
      id: 'p1',
      question: 'Favorite color?',
      options: [
        { id: 'opt-1', text: 'Red', votes: [] },
        { id: 'opt-2', text: 'Blue', votes: [] },
      ],
    }],
  };

  it('votes for an option (switch)', () => {
    const result = votePoll(baseChat, 'p1', 'opt-1', 'switch', 'user-a');
    expect(result.success).toBe(true);
    expect(result.chat.polls[0].options[0].votes).toContain('user-a');
    expect(result.chat.polls[0].options[1].votes).toHaveLength(0);
  });

  it('switches vote (switch)', () => {
    const chatWithVote = {
      ...baseChat,
      polls: [{
        id: 'p1',
        options: [
          { id: 'opt-1', text: 'Red', votes: ['user-a'] },
          { id: 'opt-2', text: 'Blue', votes: [] },
        ],
      }],
    };
    const result = votePoll(chatWithVote, 'p1', 'opt-2', 'switch', 'user-a');
    expect(result.success).toBe(true);
    expect(result.chat.polls[0].options[0].votes).toHaveLength(0);
    expect(result.chat.polls[0].options[1].votes).toContain('user-a');
  });

  it('adds vote (add)', () => {
    const result = votePoll(baseChat, 'p1', 'opt-1', 'add', 'user-b');
    expect(result.success).toBe(true);
    expect(result.chat.polls[0].options[0].votes).toContain('user-b');
  });

  it('removes vote (remove)', () => {
    const chatWithVote = {
      ...baseChat,
      polls: [{
        id: 'p1',
        options: [
          { id: 'opt-1', text: 'Red', votes: ['user-a'] },
          { id: 'opt-2', text: 'Blue', votes: [] },
        ],
      }],
    };
    const result = votePoll(chatWithVote, 'p1', 'opt-1', 'remove', 'user-a');
    expect(result.success).toBe(true);
    expect(result.chat.polls[0].options[0].votes).toHaveLength(0);
  });

  it('returns error for missing poll', () => {
    const result = votePoll(baseChat, 'nonexistent', 'opt-1', 'switch', 'user-a');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Poll not found');
  });

  it('returns error for expired poll', () => {
    const expiredChat = {
      ...baseChat,
      polls: [{
        id: 'p1',
        expiresAt: new Date('2020-01-01').toISOString(),
        options: [{ id: 'opt-1', votes: [] }],
      }],
    };
    const result = votePoll(expiredChat, 'p1', 'opt-1', 'switch', 'user-a');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Poll has expired');
  });
});

describe('buildToolInputSummary', () => {
  it('returns descriptive summary for known tools', () => {
    expect(buildToolInputSummary('run_code', { language: 'js' })).toBe('Running js code…');
    expect(buildToolInputSummary('web_search', { query: 'test' })).toBe('Searching: "test"');
    expect(buildToolInputSummary('fact_check', { claim: 'earth is flat' })).toBe('Fact-checking: "earth is flat"');
  });

  it('returns fallback for unknown tool', () => {
    const result = buildToolInputSummary('unknown_tool', {});
    expect(result).toContain('Running tool: unknown_tool');
  });
});
