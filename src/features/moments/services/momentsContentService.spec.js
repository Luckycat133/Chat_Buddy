import { describe, expect, it } from 'vitest';
import {
    buildCommentSuggestions,
    buildPersonalizedMomentRecommendations,
    createLocalWritingAssist,
    detectMomentLanguage,
    normalizeGeneratedMomentText,
} from './momentsContentService';

describe('momentsContentService', () => {
    it('detects mixed language content', () => {
        expect(detectMomentLanguage('Good morning，今天的空气很好')).toBe('mixed');
        expect(detectMomentLanguage('今天的空气很好')).toBe('zh');
        expect(detectMomentLanguage('The air feels great today')).toBe('en');
    });

    it('falls back when generated text breaks the requested language', () => {
        const fallback = '今天在公园里遇到了一阵很舒服的风。';
        const generated = 'Good morning at the park, 今天很开心';

        expect(normalizeGeneratedMomentText(generated, 'zh', fallback)).toBe(fallback);
    });

    it('builds a polished local assist with hashtags and checks', () => {
        const assist = createLocalWritingAssist({
            content: '刚在面包店买到热乎乎的可颂',
            language: 'zh',
            location: '街角面包店',
        });

        expect(assist.title).toContain('今日');
        expect(assist.polishedContent).toContain('街角面包店');
        expect(assist.hashtags.length).toBeGreaterThan(0);
        expect(assist.quality).toHaveLength(3);
    });

    it('creates personalized recommendations for the feed', () => {
        const recommendations = buildPersonalizedMomentRecommendations([
            { content: '今天在咖啡店偷到了一个安静下午。' },
            { content: '刚运动完，整个人都轻了。' },
        ], 'zh');

        expect(recommendations).toHaveLength(3);
        expect(recommendations[0]).toHaveProperty('prompt');
    });

    it('suggests context-aware comment starters', () => {
        const suggestions = buildCommentSuggestions({
            content: 'The croissant at this bakery was unreal.',
        }, 'en');

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.join(' ')).toMatch(/hungry|scene|moment/i);
    });
});
