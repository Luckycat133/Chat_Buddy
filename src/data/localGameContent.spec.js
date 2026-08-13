import { describe, expect, it } from 'vitest';
import {
    findNextIdiom,
    getIdiomMeaning,
    getLocalQuizQuestions,
    getRandomSeedIdiom,
    isKnownIdiom,
} from './localGameContent';

describe('localGameContent', () => {
    it('provides five distinct localized questions without a provider', () => {
        const zh = getLocalQuizQuestions('科技', 'zh', 5, () => 0.25);
        const en = getLocalQuizQuestions('Technology', 'en', 5, () => 0.25);

        expect(zh).toHaveLength(5);
        expect(new Set(zh.map(item => item.question)).size).toBe(5);
        expect(zh.every(item => item.options.length === 4)).toBe(true);
        expect(en).toHaveLength(5);
        expect(en[0].question).not.toBe(zh[0].question);
    });

    it('validates and advances a local idiom chain deterministically', () => {
        expect(isKnownIdiom('一石二鸟')).toBe(true);
        expect(isKnownIdiom('随便写写')).toBe(false);
        expect(getRandomSeedIdiom(() => 0)).toBe('一石二鸟');

        const next = findNextIdiom('一石二鸟', [], () => 0);
        expect(next).toBe('鸟语花香');
        expect(getIdiomMeaning(next)).toContain('花香');
        expect(findNextIdiom('一石二鸟', ['鸟语花香'])).toBeNull();
    });
});
