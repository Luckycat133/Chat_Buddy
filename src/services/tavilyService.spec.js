import { describe, expect, it } from 'vitest';
import { formatTavilyResults } from './tavilyService';

describe('formatTavilyResults token-efficient evidence', () => {
    it('removes documentation chrome and keeps query-relevant evidence', () => {
        const formatted = formatTavilyResults({
            query: 'OpenRouter Free Models Router openrouter/free versus :free model variant',
            answer: '',
            results: [{
                title: 'Free Models Router',
                url: 'https://openrouter.ai/openrouter/free',
                score: 0.9,
                content: 'Favicon for openrouter Favicon for openrouter # Free Models Router. The simplest way to get free inference. openrouter/free selects free models at random and filters for request features. Compare Quick Start filler filler filler filler filler.',
            }],
        }, { maxSnippetChars: 180 });

        expect(formatted).toContain('openrouter/free selects free models');
        expect(formatted).not.toContain('Favicon for openrouter');
        expect(formatted.length).toBeLessThan(420);
    });

    it('puts the strongest matching sentence first so short snippets keep the answer', () => {
        const formatted = formatTavilyResults({
            query: 'OpenRouter Free Models Router openrouter/free model selection',
            answer: '',
            results: [{
                title: 'Free Models Router',
                url: 'https://openrouter.ai/docs/guides/routing/routers/free-router',
                score: 0.9,
                content: 'Availability may vary. Performance can change. The Free Models Router (`openrouter/free`) automatically selects a free model from the available pool and filters for required features.',
            }],
        }, { maxSnippetChars: 120 });

        expect(formatted).toContain('automatically selects a free model');
        expect(formatted).not.toContain('Availability may vary');
    });
});
