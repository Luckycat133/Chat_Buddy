import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getRelevantFacts: vi.fn(),
}));

vi.mock('./MemoryStore', () => ({
    memoryStore: { getRelevantFacts: mocks.getRelevantFacts },
}));

import { buildMemoryBlock } from './MemoryInjector';

describe('MemoryInjector token budget', () => {
    beforeEach(() => mocks.getRelevantFacts.mockReset());

    it('does not inject a memory that repeats the latest user message', async () => {
        mocks.getRelevantFacts.mockResolvedValue([
            { fact: '用户曾说：“我在做一个 React 搜索框，旧请求会覆盖新结果。”' },
        ]);

        const block = await buildMemoryBlock('agent-coder', {
            recentUserText: '我在做一个 React 搜索框，旧请求会覆盖新结果。',
        });

        expect(block).toBe('');
    });

    it('keeps distinct durable memories and caps count', async () => {
        mocks.getRelevantFacts.mockResolvedValue([
            { fact: '用户的猫叫豆包。' },
            { fact: '用户准备搬去厦门。' },
        ]);

        const block = await buildMemoryBlock('ai-1', { recentUserText: '今天聊聊纸箱吧。' });

        expect(block).toContain('豆包');
        expect(block).toContain('厦门');
        expect(mocks.getRelevantFacts).toHaveBeenCalledWith('ai-1', 4);
    });
});
