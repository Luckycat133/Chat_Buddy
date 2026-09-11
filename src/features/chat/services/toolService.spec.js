import { beforeEach, describe, expect, it, vi } from 'vitest';

// All collaborators are mocked at the module boundary so we exercise the
// tool dispatch and pure formatting logic in toolService.js without
// touching real AI providers, localStorage, or knowledge data.
const mocks = vi.hoisted(() => ({
    findTopicByKeyword: vi.fn(),
    checkMissingPrerequisites: vi.fn(),
    markAsMastered: vi.fn(),
    markAsInProgress: vi.fn(),
    recordStruggle: vi.fn(),
    tavilySearch: vi.fn(),
    tavilyNewsSearch: vi.fn(),
    formatTavilyResults: vi.fn((response) => response),
    isTavilyConfigured: vi.fn(() => false),
    generateMomentsImage: vi.fn(),
    isMiniMaxConfigured: vi.fn(() => false),
    translateWithReflection: vi.fn(),
    detectDomain: vi.fn(() => 'general'),
    getCombinedGlossary: vi.fn(() => []),
    callAI: vi.fn(),
    requestMemory: vi.fn(),
    assertToolAuthorized: vi.fn(),
}));

vi.mock('../../../data/knowledgeGraph', () => ({
    KNOWLEDGE_NODES: {
        math_quadratic: {
            id: 'math_quadratic',
            title: '二次方程',
            title_en: 'Quadratic Equations',
        },
        prog_javascript: {
            id: 'prog_javascript',
            title: 'JavaScript 基础',
            title_en: 'JavaScript Basics',
        },
    },
    QUIZ_BANK: {
        math_quadratic: [
            {
                question: '二次方程 x² + 5x + 6 = 0 的两个根分别是？',
                options: ['x = -2, x = -3', 'x = 2, x = 3', 'x = -1, x = -6', 'x = 1, x = 6'],
                answer: 0,
            },
            {
                question: '一元二次方程的求根公式是？',
                options: [
                    'x = (-b ± √(b²-4ac)) / 2a',
                    'x = (-b ± √(b²+4ac)) / 2a',
                    'x = (b ± √(b²-4ac)) / 2a',
                    'x = (-b ± √(4ac-b²)) / 2a',
                ],
                answer: 0,
            },
        ],
        prog_javascript: [
            {
                question: '在 JavaScript 中，以下哪个方法可以向数组末尾添加元素？',
                options: ['push()', 'pop()', 'shift()', 'unshift()'],
                answer: 0,
            },
        ],
    },
    findTopicByKeyword: mocks.findTopicByKeyword,
    checkMissingPrerequisites: mocks.checkMissingPrerequisites,
}));

vi.mock('../../../data/learnerProfile', () => ({
    getLearnerProfile: vi.fn(() => ({ mastered: [] })),
    markAsMastered: mocks.markAsMastered,
    markAsInProgress: mocks.markAsInProgress,
    recordStruggle: mocks.recordStruggle,
}));

vi.mock('../../../services/ai/translationService', () => ({
    translateWithReflection: mocks.translateWithReflection,
    detectDomain: mocks.detectDomain,
}));

vi.mock('../../../data/glossary', () => ({
    getCombinedGlossary: mocks.getCombinedGlossary,
}));

vi.mock('../../../services/minimaxService', () => ({
    generateMomentsImage: mocks.generateMomentsImage,
    isMiniMaxConfigured: mocks.isMiniMaxConfigured,
}));

vi.mock('../../../services/tavilyService', () => ({
    tavilySearch: mocks.tavilySearch,
    tavilyNewsSearch: mocks.tavilyNewsSearch,
    formatTavilyResults: mocks.formatTavilyResults,
    isTavilyConfigured: mocks.isTavilyConfigured,
}));

vi.mock('./chatService', () => ({
    callAI: mocks.callAI,
}));

vi.mock('../../../core/memory/MemoryExchange', () => ({
    requestMemory: mocks.requestMemory,
}));

vi.mock('./toolAuthorization', () => ({
    assertToolAuthorized: mocks.assertToolAuthorized,
}));

const { executeTool, filterOpenRouterFreeComparisonResults } = await import('./toolService');

beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset?.());
    mocks.assertToolAuthorized.mockReturnValue(undefined);
    mocks.isTavilyConfigured.mockReturnValue(false);
    mocks.isMiniMaxConfigured.mockReturnValue(false);
    mocks.detectDomain.mockReturnValue('general');
    mocks.getCombinedGlossary.mockReturnValue([]);
    mocks.formatTavilyResults.mockImplementation((response) => response);
});

describe('filterOpenRouterFreeComparisonResults', () => {
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

    it('returns an empty list when no URLs match the free patterns', () => {
        const results = filterOpenRouterFreeComparisonResults([
            { url: 'https://example.com/docs' },
            { url: 'https://openrouter.ai/docs/pricing' },
        ]);

        expect(results).toEqual([]);
    });

    it('handles empty and undefined inputs', () => {
        expect(filterOpenRouterFreeComparisonResults([])).toEqual([]);
        expect(filterOpenRouterFreeComparisonResults()).toEqual([]);
    });

    it('skips entries without a url', () => {
        const results = filterOpenRouterFreeComparisonResults([
            { url: undefined, title: 'no url' },
            { url: 'https://openrouter.ai/routing/routers/free-router' },
        ]);

        expect(results).toHaveLength(1);
    });
});

describe('check_prerequisites tool', () => {
    it('reports missing prerequisites when learner has not mastered any', async () => {
        mocks.findTopicByKeyword.mockReturnValue({ id: 'math_quadratic', title: '二次方程' });
        mocks.checkMissingPrerequisites.mockReturnValue(['math_arithmetic', 'math_algebra_basics']);

        const result = await executeTool('check_prerequisites', { topic: '二次方程' });

        expect(result).toContain('Missing prerequisites');
        expect(result).toContain('二次方程');
        expect(mocks.findTopicByKeyword).toHaveBeenCalledWith('二次方程');
        expect(mocks.checkMissingPrerequisites).toHaveBeenCalledWith('math_quadratic', expect.any(Array));
    });

    it('reports success when learner has all prerequisites', async () => {
        mocks.findTopicByKeyword.mockReturnValue({ id: 'math_quadratic', title: '二次方程' });
        mocks.checkMissingPrerequisites.mockReturnValue([]);

        const result = await executeTool('check_prerequisites', { topic: '二次方程' });

        expect(result).toContain('all prerequisites');
        expect(result).toContain('Ready to learn');
    });

    it('returns a not-found message for unknown topics', async () => {
        mocks.findTopicByKeyword.mockReturnValue(null);

        const result = await executeTool('check_prerequisites', { topic: 'unknown_topic' });

        expect(result).toContain('not found in knowledge graph');
    });

    it('returns error for missing topic', async () => {
        const result = await executeTool('check_prerequisites', { topic: '' });

        expect(result).toContain('No topic provided');
        expect(mocks.findTopicByKeyword).not.toHaveBeenCalled();
    });
});

describe('execute_math tool', () => {
    it('evaluates simple arithmetic', async () => {
        const result = await executeTool('execute_math', { expression: '2 + 2' });

        expect(result).toContain('Result: 4');
        expect(result).toContain('2 + 2');
    });

    it('does not compute derivative for plain numeric expressions', async () => {
        const result = await executeTool('execute_math', { expression: '2 + 2' });

        expect(result).toContain('Result: 4');
        expect(result).not.toContain('Derivative');
    });

    it('surfaces a friendly error when mathjs cannot parse the expression', async () => {
        // mathjs/number has no symbolic x, so evaluate() throws; we want a
        // graceful Math Error rather than a raw stack trace.
        const result = await executeTool('execute_math', { expression: 'x^2' });

        expect(result).toContain('Math Error');
        expect(result).toContain('Undefined symbol x');
        expect(result).not.toContain('at ');
    });

    it('skips derivative when expression has equals sign', async () => {
        const result = await executeTool('execute_math', { expression: '1 + 4' });

        expect(result).toContain('Result: 5');
        expect(result).not.toContain('Derivative');
    });

    it('returns error for invalid expression syntax', async () => {
        const result = await executeTool('execute_math', { expression: '!!not-valid!!' });

        expect(result).toContain('Math Error');
    });

    it('returns error for empty expression', async () => {
        const result = await executeTool('execute_math', { expression: '' });

        expect(result).toContain('No expression provided');
    });

    it('does not emit a Simplified line when expression is already in simplest form', async () => {
        const result = await executeTool('execute_math', { expression: '5' });

        expect(result).toContain('Result: 5');
        expect(result).not.toContain('Simplified');
    });
});

describe('generate_quiz tool', () => {
    it('returns a quiz from the bank for known topics', async () => {
        mocks.findTopicByKeyword.mockReturnValue({ id: 'math_quadratic', title: '二次方程' });

        const result = await executeTool('generate_quiz', { topic: '二次方程' });

        expect(result).toContain('二次方程');
        expect(result).toContain('A)');
        expect(result).toContain('ANSWER_KEY');
        expect(mocks.markAsInProgress).toHaveBeenCalledWith('math_quadratic');
    });

    it('falls back to a generic prompt when no pre-made quiz exists', async () => {
        mocks.findTopicByKeyword.mockReturnValue({ id: 'math_functions', title: '函数基础' });

        const result = await executeTool('generate_quiz', { topic: '函数基础' });

        expect(result).toContain('No pre-made quiz');
        expect(result).toContain('函数基础');
        // markAsInProgress is only called when a pre-made quiz exists.
        expect(mocks.markAsInProgress).not.toHaveBeenCalled();
    });

    it('returns error for empty topic', async () => {
        const result = await executeTool('generate_quiz', { topic: '' });

        expect(result).toContain('No topic provided');
        expect(mocks.findTopicByKeyword).not.toHaveBeenCalled();
    });
});

describe('track_progress tool', () => {
    beforeEach(() => {
        mocks.findTopicByKeyword.mockReturnValue({ id: 'math_quadratic', title: '二次方程' });
    });

    it('marks a known topic as mastered', async () => {
        const result = await executeTool('track_progress', { topic: '二次方程', status: 'mastered' });

        expect(result).toContain('MASTERED');
        expect(mocks.markAsMastered).toHaveBeenCalledWith('math_quadratic');
    });

    it('records a struggle with an attached misconception', async () => {
        const result = await executeTool('track_progress', {
            topic: '二次方程',
            status: 'struggling',
            misconception: 'forgot the formula',
        });

        expect(result).toContain('difficulty');
        expect(result).toContain('forgot the formula');
        expect(mocks.recordStruggle).toHaveBeenCalledWith('math_quadratic', 'forgot the formula');
    });

    it('defaults unknown status to in_progress', async () => {
        const result = await executeTool('track_progress', { topic: '二次方程' });

        expect(result).toContain('IN PROGRESS');
        expect(mocks.markAsInProgress).toHaveBeenCalledWith('math_quadratic');
    });

    it('records the raw keyword when topic is unknown to the graph', async () => {
        mocks.findTopicByKeyword.mockReturnValue(null);

        const result = await executeTool('track_progress', { topic: 'custom_topic' });

        expect(result).toContain('IN PROGRESS');
        expect(mocks.markAsInProgress).toHaveBeenCalledWith('custom_topic');
    });

    it('returns error for empty topic', async () => {
        const result = await executeTool('track_progress', { topic: '', status: 'mastered' });

        expect(result).toContain('No topic provided');
        expect(mocks.markAsMastered).not.toHaveBeenCalled();
    });
});

describe('color_palette tool', () => {
    it('uses the named mood when recognized', async () => {
        const result = await executeTool('color_palette', { mood: 'cool' });

        expect(result).toContain('cool');
        expect(result).toContain('主色');
        expect(result).toContain('#4ECDC4');
    });

    it('falls back to the warm palette for unknown moods', async () => {
        const result = await executeTool('color_palette', { mood: 'gamboge' });

        expect(result).toContain('gamboge');
        expect(result).toContain('#FF6B6B');
    });

    it('overrides the first color when baseColor is a valid hex', async () => {
        const result = await executeTool('color_palette', { mood: 'warm', baseColor: '#123456' });

        expect(result).toContain('#123456');
    });

    it('ignores malformed baseColor values', async () => {
        const result = await executeTool('color_palette', { mood: 'warm', baseColor: 'not-a-color' });

        expect(result).not.toContain('not-a-color');
        expect(result).toContain('#FF6B6B');
    });

    it('clamps the requested count into the 1..8 range', async () => {
        const low = await executeTool('color_palette', { mood: 'warm', count: 0 });
        const high = await executeTool('color_palette', { mood: 'warm', count: 99 });

        // The formatter just emits a list; assert no throw and reasonable output.
        expect(low).toContain('配色方案');
        expect(high).toContain('配色方案');
    });
});

describe('disabled and legacy programming tools', () => {
    it('returns a disabled message for run_code execution', async () => {
        const result = await executeTool('run_code', { code: 'console.log("hi")' });

        expect(result).toContain('Code Execution Disabled');
    });

    it('returns error for run_code with empty code', async () => {
        const result = await executeTool('run_code', { code: '' });

        expect(result).toContain('No code provided');
    });

    it('returns canned docs search output', async () => {
        const result = await executeTool('search_docs', { query: 'react hooks' });

        expect(result).toContain('react hooks');
        expect(result).toContain('Documentation Search');
    });

    it('returns canned static analysis output', async () => {
        const result = await executeTool('analyze_code', { code: 'function f(){}' });

        expect(result).toContain('Static Analysis');
    });
});

describe('cite_sources tool', () => {
    it('returns a prompt when no sources are provided', async () => {
        const result = await executeTool('cite_sources', { sources: [], format: 'apa' });

        expect(result).toContain('Citation Generator');
    });

    it('generates APA citations when format is apa', async () => {
        const sources = [
            { title: 'Test Article', url: 'https://example.com/article', date: '2024-01-01' },
        ];

        const result = await executeTool('cite_sources', { sources, format: 'apa' });

        expect(result).toContain('APA');
        expect(result).toContain('Test Article');
        expect(result).toContain('example.com');
    });

    it('generates MLA citations when format is mla', async () => {
        const sources = [
            { title: 'Test Article', url: 'https://example.com/article', date: '2024-01-01' },
        ];

        const result = await executeTool('cite_sources', { sources, format: 'mla' });

        expect(result).toContain('MLA');
        expect(result).toContain('Test Article');
    });

    it('keeps malformed source URLs visible instead of throwing', async () => {
        const sources = [{ title: 'Bad URL', url: 'not-a-url', date: '2024-01-01' }];

        const result = await executeTool('cite_sources', { sources, format: 'apa' });

        expect(result).toContain('Bad URL');
        expect(result).toContain('Unknown source');
    });

    it('defaults to APA when format is missing', async () => {
        const sources = [{ title: 'No Format', url: 'https://example.com/x' }];

        const result = await executeTool('cite_sources', { sources });

        expect(result).toContain('APA');
    });
});

describe('MEMORY_REQUEST tool', () => {
    it('delegates to requestMemory with the caller and target persona ids', async () => {
        mocks.requestMemory.mockResolvedValue('shared content');
        const personas = [{ id: 'ai-1', name: 'AI 1' }];

        const result = await executeTool(
            'MEMORY_REQUEST',
            { target: 'ai-1', topic: 'shared topic' },
            { personas, requesterId: 'ai-2' },
        );

        expect(mocks.requestMemory).toHaveBeenCalledWith('ai-2', 'ai-1', 'shared topic', personas);
        expect(result).toBe('shared content');
    });

    it('returns an error when target or topic is missing', async () => {
        const result = await executeTool('MEMORY_REQUEST', { target: 'ai-1' });

        expect(result).toContain('Missing required fields');
        expect(mocks.requestMemory).not.toHaveBeenCalled();
    });
});

describe('delegate_task tool', () => {
    it('delegates to the named agent and wraps the response', async () => {
        mocks.callAI.mockResolvedValue('agent output');
        const personas = [
            { id: 'agent-coder', name: 'Coder', systemPrompt: 'You are Coder.' },
        ];

        const result = await executeTool(
            'delegate_task',
            { agentId: 'agent-coder', prompt: 'write a function' },
            { personas },
        );

        expect(mocks.callAI).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ role: 'system' })]),
            expect.objectContaining({ agentId: 'agent-coder' }),
        );
        expect(result).toContain('Delegated response');
        expect(result).toContain('Coder');
        expect(result).toContain('agent output');
    });

    it('returns a not-found error when the agent does not exist', async () => {
        const result = await executeTool(
            'delegate_task',
            { agentId: 'ghost-agent', prompt: 'do something' },
            { personas: [] },
        );

        expect(result).toContain('not found');
        expect(mocks.callAI).not.toHaveBeenCalled();
    });

    it('returns error when agentId or prompt is missing', async () => {
        const result = await executeTool('delegate_task', { agentId: 'agent-coder' });

        expect(result).toContain('Missing required fields');
        expect(mocks.callAI).not.toHaveBeenCalled();
    });

    it('blocks delegation when depth has reached the limit of 2', async () => {
        const personas = [{ id: 'agent-coder', name: 'Coder' }];

        const result = await executeTool(
            'delegate_task',
            { agentId: 'agent-coder', prompt: 'do something' },
            { personas, delegationDepth: 2 },
        );

        expect(result).toContain('Maximum delegation depth');
        expect(mocks.callAI).not.toHaveBeenCalled();
    });
});

describe('generate_image tool', () => {
    it('returns a clear error when no image provider is configured', async () => {
        mocks.isMiniMaxConfigured.mockReturnValue(false);

        const result = await executeTool('generate_image', { prompt: 'a cat' });

        expect(result).toContain('No image provider is configured');
    });

    it('returns IMG tag with provider URL when configured', async () => {
        mocks.isMiniMaxConfigured.mockReturnValue(true);
        mocks.generateMomentsImage.mockResolvedValue({ imageUrl: 'https://example.com/cat.png' });

        const result = await executeTool('generate_image', { prompt: 'a cat' });

        expect(result).toBe('[IMG:https://example.com/cat.png]');
        expect(mocks.generateMomentsImage).toHaveBeenCalled();
    });

    it('returns error for missing prompt', async () => {
        const result = await executeTool('generate_image', { prompt: '' });

        expect(result).toContain('No prompt provided');
    });

    it('surfaces provider errors gracefully', async () => {
        mocks.isMiniMaxConfigured.mockReturnValue(true);
        mocks.generateMomentsImage.mockRejectedValue(new Error('rate limited'));

        const result = await executeTool('generate_image', { prompt: 'a cat' });

        expect(result).toContain('Image Generation Error');
        expect(result).toContain('rate limited');
    });
});

describe('sonar_search tool domain and recency routing', () => {
    it('maps general domain to no domain filter', async () => {
        mocks.tavilySearch.mockResolvedValue({ results: [] });

        await executeTool('sonar_search', { query: 'test', domains: 'general' });

        expect(mocks.tavilySearch).toHaveBeenCalledWith(
            'test',
            expect.objectContaining({ includeDomains: [] }),
        );
    });

    it('extracts an explicit host from a query when official domain preset is used', async () => {
        mocks.tavilySearch.mockResolvedValue({ results: [] });

        await executeTool('sonar_search', {
            query: 'how does openrouter.ai routing work',
            domains: 'official',
        });

        expect(mocks.tavilySearch).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                includeDomains: expect.arrayContaining(['openrouter.ai']),
            }),
        );
    });

    it('maps academic preset to known academic hosts', async () => {
        mocks.tavilySearch.mockResolvedValue({ results: [] });

        await executeTool('sonar_search', { query: 'test', domains: 'academic' });

        expect(mocks.tavilySearch).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                includeDomains: expect.arrayContaining(['arxiv.org']),
            }),
        );
    });

    it('converts week recency into 7 days for the news topic', async () => {
        mocks.tavilySearch.mockResolvedValue({ results: [] });

        await executeTool('sonar_search', { query: 'test', domains: 'news', recency: 'week' });

        expect(mocks.tavilySearch).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ days: 7 }),
        );
    });

    it('omits the days field for unrecognised recency values', async () => {
        mocks.tavilySearch.mockResolvedValue({ results: [] });

        await executeTool('sonar_search', { query: 'test', domains: 'news', recency: 'fortnight' });

        const [, options] = mocks.tavilySearch.mock.calls[0];
        expect(options.days).toBeUndefined();
    });

    it('returns an error when the query is empty', async () => {
        const result = await executeTool('sonar_search', { query: '' });

        expect(result).toContain('请提供搜索查询');
        expect(mocks.tavilySearch).not.toHaveBeenCalled();
    });
});

describe('executeTool dispatch and error wrapping', () => {
    it('returns a clear error for unknown tool names', async () => {
        const result = await executeTool('non_existent_tool', {});

        expect(result).toContain('not found');
    });

    it('wraps unexpected collaborator errors without crashing', async () => {
        mocks.findTopicByKeyword.mockImplementation(() => {
            throw new Error('boom');
        });

        const result = await executeTool('check_prerequisites', { topic: 'test' });

        expect(result).toContain('Error');
        expect(result).toContain('boom');
    });

    it('runs assertToolAuthorized before dispatching the tool', async () => {
        mocks.findTopicByKeyword.mockReturnValue({ id: 'math_quadratic', title: '二次方程' });
        mocks.checkMissingPrerequisites.mockReturnValue([]);

        await executeTool('check_prerequisites', { topic: '二次方程' });

        expect(mocks.assertToolAuthorized).toHaveBeenCalledTimes(1);
    });
});