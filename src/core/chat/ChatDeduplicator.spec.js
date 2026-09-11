import { describe, expect, it } from 'vitest';
import { dedupeDirectSocialChats } from './ChatDeduplicator';

const CURRENT_USER = 'user-me';
const PEER_A = 'ai-alpha';
const PEER_B = 'ai-beta';
const TASK_AGENT = 'agent-coder';

const makeMessage = (overrides = {}) => ({
    id: 'm-default',
    senderId: CURRENT_USER,
    content: 'hello',
    timestamp: '2024-01-01T00:00:00Z',
    status: 'sent',
    readBy: [],
    ...overrides,
});

const makeChat = (overrides = {}) => ({
    id: 'chat-default',
    name: 'Test Chat',
    participants: [CURRENT_USER, PEER_A],
    messages: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    polls: [],
    pinnedMessages: [],
    settings: { muteValues: {} },
    ...overrides,
});

describe('dedupeDirectSocialChats', () => {
    it('returns an empty result for an empty array', () => {
        expect(dedupeDirectSocialChats([])).toEqual({ chats: [], changed: false });
    });

    it('returns an empty result for non-array input', () => {
        expect(dedupeDirectSocialChats(null)).toEqual({ chats: [], changed: false });
        expect(dedupeDirectSocialChats(undefined)).toEqual({ chats: [], changed: false });
    });

    it('passes through chats that are not 1:1 direct', () => {
        const groupChat = makeChat({
            id: 'group-1',
            participants: [CURRENT_USER, PEER_A, PEER_B],
        });

        const result = dedupeDirectSocialChats([groupChat]);

        expect(result.changed).toBe(false);
        expect(result.chats).toHaveLength(1);
        expect(result.chats[0].id).toBe('group-1');
    });

    it('does not flag a single direct chat as changed', () => {
        const direct = makeChat({ id: 'direct-1' });

        const result = dedupeDirectSocialChats([direct]);

        expect(result.changed).toBe(false);
        expect(result.chats).toHaveLength(1);
        expect(result.chats[0].id).toBe('direct-1');
    });

    it('merges duplicate direct chats sharing the same peer', () => {
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            messages: [makeMessage({ id: 'm1', content: 'first', timestamp: '2024-01-02T00:00:00Z' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            messages: [makeMessage({ id: 'm2', content: 'second', timestamp: '2024-01-01T00:00:00Z' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB]);

        expect(result.changed).toBe(true);
        expect(result.chats).toHaveLength(1);
        // The most recently active chat becomes canonical.
        expect(result.chats[0].updatedAt).toBe('2024-01-02T00:00:00Z');
        expect(result.chats[0].messages.map((m) => m.id)).toEqual(['m2', 'm1']);
    });

    it('deduplicates messages by id across merged chats', () => {
        const shared = makeMessage({ id: 'shared' });
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            messages: [shared, makeMessage({ id: 'a-only' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            messages: [shared, makeMessage({ id: 'b-only' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB]);

        const ids = result.chats[0].messages.map((m) => m.id);
        expect(ids).toHaveLength(3);
        expect(new Set(ids)).toEqual(new Set(['shared', 'a-only', 'b-only']));
    });

    it('keeps task-specialist chats as separate entries (never merges)', () => {
        const personas = [{ id: TASK_AGENT, agentType: 'task-specialist' }];
        const taskA = makeChat({ id: 'task-a', participants: [CURRENT_USER, TASK_AGENT] });
        const taskB = makeChat({ id: 'task-b', participants: [CURRENT_USER, TASK_AGENT] });

        const result = dedupeDirectSocialChats([taskA, taskB], personas);

        expect(result.changed).toBe(false);
        expect(result.chats.map((c) => c.id).sort()).toEqual(['task-a', 'task-b']);
    });

    it('treats agent-* ids as task participants even without persona metadata', () => {
        const taskA = makeChat({ id: 'task-a', participants: [CURRENT_USER, TASK_AGENT] });
        const taskB = makeChat({ id: 'task-b', participants: [CURRENT_USER, TASK_AGENT] });

        const result = dedupeDirectSocialChats([taskA, taskB]);

        expect(result.changed).toBe(false);
        expect(result.chats).toHaveLength(2);
    });

    it('groups duplicates per peer id', () => {
        const peer1A = makeChat({ id: 'p1-a', participants: [CURRENT_USER, PEER_A] });
        const peer1B = makeChat({ id: 'p1-b', participants: [CURRENT_USER, PEER_A] });
        const peer2A = makeChat({ id: 'p2-a', participants: [CURRENT_USER, PEER_B] });
        const peer2B = makeChat({ id: 'p2-b', participants: [CURRENT_USER, PEER_B] });

        const result = dedupeDirectSocialChats([peer1A, peer1B, peer2A, peer2B]);

        expect(result.changed).toBe(true);
        expect(result.chats).toHaveLength(2);
    });

    it('sorts the final list by activity timestamp, newest first', () => {
        const old = makeChat({
            id: 'old',
            participants: [CURRENT_USER, PEER_A],
            updatedAt: '2024-01-01T00:00:00Z',
            lastMessage: makeMessage({ timestamp: '2024-01-01T00:00:00Z' }),
        });
        const newer = makeChat({
            id: 'newer',
            participants: [CURRENT_USER, PEER_B],
            updatedAt: '2024-01-02T00:00:00Z',
            lastMessage: makeMessage({ timestamp: '2024-01-02T00:00:00Z' }),
        });

        const result = dedupeDirectSocialChats([old, newer]);

        expect(result.chats.map((c) => c.id)).toEqual(['newer', 'old']);
    });

    it('keeps current user in admins and prepends them when missing', () => {
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            admins: ['ai-other'],
            messages: [makeMessage({ id: 'm1' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            admins: ['ai-other', 'someone-else'],
            messages: [makeMessage({ id: 'm2' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB]);

        const admins = result.chats[0].admins;
        expect(admins).toContain(CURRENT_USER);
        expect(admins).toContain('ai-other');
        expect(admins).toContain('someone-else');
        expect(admins[0]).toBe(CURRENT_USER);
    });

    it('dedupes pinned message ids across merged chats', () => {
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            pinnedMessages: ['m1', 'm2'],
            messages: [makeMessage({ id: 'm1' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            pinnedMessages: ['m2', 'm3'],
            messages: [makeMessage({ id: 'm2' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB]);

        expect(new Set(result.chats[0].pinnedMessages)).toEqual(new Set(['m1', 'm2', 'm3']));
    });

    it('merges per-persona mute values across the cluster', () => {
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            settings: { muteValues: { [PEER_A]: true } },
            messages: [makeMessage({ id: 'm1' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            settings: { muteValues: { [PEER_B]: true } },
            messages: [makeMessage({ id: 'm2' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB]);

        expect(result.chats[0].settings.muteValues).toEqual({
            [PEER_A]: true,
            [PEER_B]: true,
        });
    });

    it('uses the earliest createdAt across the cluster', () => {
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            createdAt: '2024-01-05T00:00:00Z',
            messages: [makeMessage({ id: 'm1' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            createdAt: '2024-01-01T00:00:00Z',
            messages: [makeMessage({ id: 'm2' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB]);

        expect(result.chats[0].createdAt).toBe('2024-01-01T00:00:00Z');
    });

    it('keeps polls deduplicated by poll id', () => {
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            polls: [{ id: 'p1', question: 'A?' }, { id: 'p2', question: 'B?' }],
            messages: [makeMessage({ id: 'm1' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            polls: [{ id: 'p2', question: 'B?' }, { id: 'p3', question: 'C?' }],
            messages: [makeMessage({ id: 'm2' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB]);

        const pollIds = result.chats[0].polls.map((p) => p.id);
        expect(new Set(pollIds)).toEqual(new Set(['p1', 'p2', 'p3']));
    });

    it('preserves isPinned and isUnread flags when any cluster member has them', () => {
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            isPinned: true,
            messages: [makeMessage({ id: 'm1' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            isUnread: true,
            messages: [makeMessage({ id: 'm2' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB]);

        expect(result.chats[0].isPinned).toBe(true);
        expect(result.chats[0].isUnread).toBe(true);
    });

    it('normalises participants to user-me and the direct peer after merge', () => {
        // Both chats must be valid 1:1 chats so getDirectPeerId groups them.
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            messages: [makeMessage({ id: 'm1' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            messages: [makeMessage({ id: 'm2' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB]);

        expect(result.chats[0].participants).toEqual([CURRENT_USER, PEER_A]);
    });

    it('respects a non-default currentUserId', () => {
        const altUser = 'user-alt';
        const chatA = makeChat({
            id: 'direct-a',
            updatedAt: '2024-01-02T00:00:00Z',
            participants: [altUser, PEER_A],
            admins: [PEER_A],
            messages: [makeMessage({ id: 'm1' })],
        });
        const chatB = makeChat({
            id: 'direct-b',
            updatedAt: '2024-01-01T00:00:00Z',
            participants: [altUser, PEER_A],
            admins: [PEER_A],
            messages: [makeMessage({ id: 'm2' })],
        });

        const result = dedupeDirectSocialChats([chatA, chatB], [], altUser);

        expect(result.changed).toBe(true);
        expect(result.chats[0].participants).toEqual([altUser, PEER_A]);
        expect(result.chats[0].admins).toContain(altUser);
        expect(result.chats[0].admins[0]).toBe(altUser);
    });
});