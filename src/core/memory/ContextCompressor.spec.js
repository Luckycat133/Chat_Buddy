import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    saveFact: vi.fn(),
}));

vi.mock('./MemoryStore', () => ({
    memoryStore: {
        saveFact: mocks.saveFact,
    },
}));

import {
    compressContext,
    extractGroupMemoriesAsync,
    extractLocalMemoryItems,
    extractMemoriesAsync,
} from './ContextCompressor';

describe('ContextCompressor request-efficient memory', () => {
    beforeEach(() => {
        mocks.saveFact.mockReset();
        mocks.saveFact.mockResolvedValue('memory-id');
    });

    it('extracts durable natural user statements locally and skips ordinary small talk', () => {
        const items = extractLocalMemoryItems([
            { senderId: 'user-me', content: '我月底准备从杭州搬去厦门，带着叫豆包的橘猫。' },
            { senderId: 'ai-1', content: '路上注意安全。' },
            { senderId: 'user-me', content: '它最离不开蓝色小鱼玩具。' },
            { senderId: 'user-me', content: '今天天气还行。' },
        ]);

        expect(items).toHaveLength(2);
        expect(items[0]).toMatchObject({ category: 'event', importance: expect.any(Number) });
        expect(items[0].fact).toContain('豆包');
        expect(items[0].fact).not.toContain('应该先准备什么');
        expect(items[1].fact).toContain('蓝色小鱼玩具');
    });

    it('does not store a transient task description as a user profile fact', () => {
        expect(extractLocalMemoryItems([
            { senderId: 'user-me', content: '我在做一个 React 搜索框，旧请求会覆盖新结果。' },
        ])).toEqual([]);
    });

    it('does not store a recall command as a new fact when it has no question mark', () => {
        expect(extractLocalMemoryItems([{
            senderId: 'user-me',
            content: '不要猜，请逐项告诉我名字、猫的玩具和工作日回家时间。',
        }])).toEqual([]);
    });

    it('keeps durable statements but never stores follow-up questions as facts', () => {
        const items = extractLocalMemoryItems([{
            senderId: 'user-me',
            content: '我计划下周第一次做公开演讲。我担心上台忘词。我习惯带绿色钢笔。你还记得我最担心什么吗？',
        }]);

        expect(items).toHaveLength(3);
        expect(items.map(item => item.fact).join(' ')).toContain('公开演讲');
        expect(items.map(item => item.fact).join(' ')).toContain('绿色钢笔');
        expect(items.map(item => item.fact).join(' ')).not.toContain('还记得');
        expect(items.map(item => item.fact).join(' ')).not.toContain('什么吗');
    });

    it('extracts every durable fact from realistic semicolon-separated Chinese', () => {
        const items = extractLocalMemoryItems([{
            senderId: 'user-me',
            content: '这关系到之后的安排：我叫林禾；9月14日从成都搬到苏州；会带一只叫栗子的黑猫；它最离不开黄色羽毛玩具；我工作日早上7点20出门、晚上6点40回家。',
        }]);
        const facts = items.map(item => item.fact).join('\n');

        expect(items).toHaveLength(5);
        expect(facts).toContain('林禾');
        expect(facts).toContain('成都搬到苏州');
        expect(facts).toContain('栗子的黑猫');
        expect(facts).toContain('黄色羽毛玩具');
        expect(facts).toContain('早上7点20');
    });

    it('persists memories through IndexedDB store only', async () => {
        const count = await extractMemoriesAsync([
            { senderId: 'user-me', content: '我喜欢女声、安静一点的歌。' },
        ], 'ai-1', 'Luna');

        expect(count).toBe(1);
        expect(mocks.saveFact).toHaveBeenCalledTimes(1);
        expect(mocks.saveFact).toHaveBeenCalledWith(
            'ai-1',
            expect.stringContaining('女声'),
            expect.any(Number),
            'preference',
        );
    });

    it('keeps a long recent window and bounds older Chinese context summaries', () => {
        const messages = Array.from({ length: 70 }, (_, index) => ({
            id: `m-${index}`,
            senderId: index % 2 === 0 ? 'user-me' : 'ai-1',
            content: `第${index}条${'很长的中文内容'.repeat(40)}`,
        }));

        const result = compressContext(messages);

        expect(result.compressed).toBe(true);
        expect(result.recentMessages).toHaveLength(48);
        expect(result.summary.length).toBeLessThan(1500);
        expect(result.summary).toContain('Earlier user context');
        expect(result.recentMessages.at(-1).content).toContain('第69条');
    });

    it('does not compress an ordinary 48-message conversation', () => {
        const messages = Array.from({ length: 48 }, (_, index) => ({
            id: `m-${index}`,
            senderId: index % 2 === 0 ? 'user-me' : 'ai-1',
            content: `message-${index}`,
        }));

        expect(compressContext(messages)).toEqual({ compressed: false, messages });
    });

    it('shares group memories locally with every participant without model fan-out', async () => {
        const count = await extractGroupMemoriesAsync(
            [{ senderId: 'user-me', content: '我的猫叫豆包。' }],
            'group-1',
            [{ id: 'ai-1', name: 'Luna' }, { id: 'ai-2', name: 'Max' }],
        );

        expect(count).toBe(2);
        expect(mocks.saveFact).toHaveBeenCalledTimes(2);
        expect(mocks.saveFact.mock.calls.map((call) => call[0])).toEqual(['ai-1', 'ai-2']);
    });
});
