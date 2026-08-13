import { describe, expect, it } from 'vitest';
import { MemoryStore } from './MemoryStore';

describe('MemoryStore Chinese deduplication', () => {
    it('recognizes punctuation and small wording changes as the same fact', () => {
        const store = new MemoryStore();

        expect(store._similarity(
            '用户曾说：“我的橘猫叫豆包。”',
            '用户曾说 我的橘猫叫豆包',
        )).toBeGreaterThan(0.78);
        expect(store._similarity(
            '用户准备从杭州搬去厦门。',
            '用户喜欢安静的女声音乐。',
        )).toBeLessThan(0.5);
    });
});
