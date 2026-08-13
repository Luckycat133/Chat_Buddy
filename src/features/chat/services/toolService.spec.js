import { describe, expect, it } from 'vitest';
import { filterOpenRouterFreeComparisonResults } from './toolService';

describe('Scholar official evidence filtering', () => {
    it('keeps both current OpenRouter free-router and fixed-variant documentation', () => {
        const results = filterOpenRouterFreeComparisonResults([
            { url: 'https://openrouter.ai/docs/guides/routing/routers/free-router' },
            { url: 'https://openrouter.ai/docs/guides/routing/model-variants/free' },
            { url: 'https://openrouter.ai/docs/faq' },
        ]);

        expect(results.map((result) => result.url)).toEqual([
            'https://openrouter.ai/docs/guides/routing/routers/free-router',
            'https://openrouter.ai/docs/guides/routing/model-variants/free',
        ]);
    });
});
