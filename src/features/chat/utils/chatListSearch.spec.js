import { describe, expect, it } from 'vitest';
import { filterChatListEntries, matchesChatListSearch } from './chatListSearch.js';

const personas = [
  { id: 'ai-1', name: 'Mira', name_zh: '米拉' },
  { id: 'ai-2', name: 'Luna', name_zh: '露娜' },
];

describe('chat list lightweight search', () => {
  it('matches chat names, localized friend names, and cached remarks', () => {
    const chat = { id: 'c1', name: 'Weekend plans', participants: ['user-me', 'ai-1'] };
    const meta = { name: '米拉', type: 'social' };
    const friendMeta = { 'ai-1': { remark: 'Doctor' } };
    expect(matchesChatListSearch(chat, meta, 'weekend', personas, friendMeta)).toBe(true);
    expect(matchesChatListSearch(chat, meta, 'mira', personas, friendMeta)).toBe(true);
    expect(matchesChatListSearch(chat, meta, 'doctor', personas, friendMeta)).toBe(true);
    expect(matchesChatListSearch(chat, meta, 'luna', personas, friendMeta)).toBe(false);
  });

  it('filters entries using the active tab and sorts pinned chats first', () => {
    const entries = [
      { chat: { id: 'a', createdAt: '2026-01-01', participants: ['ai-1'] }, meta: { type: 'social' }, searchText: 'mira' },
      { chat: { id: 'b', isPinned: true, createdAt: '2026-01-02', participants: ['ai-2'] }, meta: { type: 'social' }, searchText: 'luna' },
      { chat: { id: 'c', createdAt: '2026-01-03', participants: ['ai-1'] }, meta: { type: 'task' }, searchText: 'mira' },
    ];
    const result = filterChatListEntries(entries, 'a', 'all', ({ meta }) => meta.type === 'social');
    expect(result.map(({ chat }) => chat.id)).toEqual(['b', 'a']);
  });
});
