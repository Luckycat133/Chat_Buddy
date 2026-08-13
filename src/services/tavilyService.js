/**
 * Tavily Web Search Service
 *
 * Provides real-time web search for AI systems via the Tavily API.
 * Features:
 *  - Rate limiting (max 5 req/s, 1000 req/day by default)
 *  - One network attempt per explicit search; the UI owns any retry
 *  - Relevance score filtering (discard low-quality results)
 *  - Encrypted HTTPS transport (enforced by the Tavily endpoint)
 *  - Secure key retrieval from Vite environment variables
 *  - Search result deduplication by URL
 *
 * API reference: https://docs.tavily.com/docs/rest-api/api-reference
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const TAVILY_BASE_URL = 'https://api.tavily.com';
const TAVILY_SEARCH_ENDPOINT = '/search';

/** Minimum relevance score (0-1) to include a result. */
const DEFAULT_RELEVANCE_THRESHOLD = 0.3;

/** Default max results returned to the caller. */
const DEFAULT_MAX_RESULTS = 5;

/** Maximum results available from the API in one call. */
const API_MAX_RESULTS = 10;

/** Rate limit: requests per second window. */
const RATE_LIMIT_RPS = 5;
const RATE_LIMIT_WINDOW_MS = 1000;

/** Daily soft limit — warn when approaching. */
const DAILY_SOFT_LIMIT = 950;

// ─── Rate-Limiter State ───────────────────────────────────────────────────────

const _rl = {
    requestsInWindow: 0,
    windowStart: Date.now(),
    dailyCount: 0,
    dailyDate: new Date().toDateString(),
};

/**
 * Check and enforce the per-second and daily rate limits.
 * Throws if limits are exceeded.
 * @returns {Promise<void>} resolves once a slot is available
 */
async function checkRateLimit() {
    const now = Date.now();

    // Reset per-second window
    if (now - _rl.windowStart >= RATE_LIMIT_WINDOW_MS) {
        _rl.requestsInWindow = 0;
        _rl.windowStart = now;
    }

    // Reset daily counter if date rolled over
    const today = new Date().toDateString();
    if (today !== _rl.dailyDate) {
        _rl.dailyCount = 0;
        _rl.dailyDate = today;
    }

    // Hard-block if over 5 req/s — wait for next window
    if (_rl.requestsInWindow >= RATE_LIMIT_RPS) {
        const waitMs = RATE_LIMIT_WINDOW_MS - (now - _rl.windowStart) + 10;
        console.warn(`[TavilyService] Rate limit reached, waiting ${waitMs}ms…`);
        await new Promise(r => setTimeout(r, waitMs));
        // Recurse to re-check after waiting
        return checkRateLimit();
    }

    // Soft-warn on daily limit approach
    if (_rl.dailyCount >= DAILY_SOFT_LIMIT) {
        console.warn(`[TavilyService] ⚠️  Approaching daily limit (${_rl.dailyCount} requests today)`);
    }

    _rl.requestsInWindow++;
    _rl.dailyCount++;
}

// ─── Key Access ───────────────────────────────────────────────────────────────

/**
 * Return the Tavily API key from Vite env.
 * Throws a descriptive error if the key is not configured.
 */
function getTavilyApiKey() {
    const key = import.meta.env.VITE_TAVILY_API_KEY || '';
    if (!key || key.startsWith('tvly-xxxx')) {
        throw new Error(
            '[TavilyService] API key not configured. ' +
            'Add VITE_TAVILY_API_KEY=tvly-... to your .env file.'
        );
    }
    return key;
}

// ─── Core Fetch ───────────────────────────────────────────────────────────────

/**
 * Low-level POST to Tavily API. A search action has a strict one-request budget.
 * @param {Object} body - JSON request body
 * @param {number} [retriesLeft=0] - remaining retries (non-zero only for an explicit caller override)
 * @returns {Promise<Object>} parsed JSON response
 */
async function tavilyPost(body, retriesLeft = 0) {
    const apiKey = getTavilyApiKey();
    const url = `${TAVILY_BASE_URL}${TAVILY_SEARCH_ENDPOINT}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Key sent securely in Authorization header over HTTPS
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        // Rate limited or server error → exponential backoff retry
        if ((response.status === 429 || response.status >= 500) && retriesLeft > 0) {
            const backoffMs = 1000 + Math.random() * 500;
            console.warn(`[TavilyService] HTTP ${response.status}, retrying in ${Math.round(backoffMs)}ms…`);
            await new Promise(r => setTimeout(r, backoffMs));
            return tavilyPost(body, retriesLeft - 1);
        }

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(
                errBody?.detail || errBody?.message || `HTTP ${response.status} from Tavily`
            );
        }

        return await response.json();

    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('[TavilyService] Request timed out after 15 s', { cause: err });
        }
        if (retriesLeft > 0 && err.name !== 'AbortError') {
            console.warn(`[TavilyService] Network error (${err.message}), retrying…`);
            await new Promise(r => setTimeout(r, 1000));
            return tavilyPost(body, retriesLeft - 1);
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ─── Relevance Filtering ──────────────────────────────────────────────────────

/**
 * Filter and deduplicate search results by relevance score and URL uniqueness.
 * @param {Array} results - raw results from Tavily
 * @param {number} threshold - minimum relevance score (0–1)
 * @returns {Array} filtered, deduplicated results
 */
function filterResults(results, threshold) {
    if (!Array.isArray(results)) return [];

    const seen = new Set();

    return results
        .filter(r => {
            // Must meet relevance threshold
            const score = typeof r.score === 'number' ? r.score : 0;
            if (score < threshold) return false;

            // Deduplicate by URL
            if (seen.has(r.url)) return false;
            seen.add(r.url);

            return true;
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); // highest score first
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TavilyResult
 * @property {string} title        - Page title
 * @property {string} url          - Source URL
 * @property {string} content      - Relevant page excerpt
 * @property {number} score        - Relevance score (0–1)
 * @property {string|null} publishedDate - ISO date string or null
 */

/**
 * @typedef {Object} TavilySearchResponse
 * @property {string} query             - The query that was searched
 * @property {string} answer            - AI-generated direct answer (if requested)
 * @property {TavilyResult[]} results   - Filtered, ranked results
 * @property {string[]} images          - Image URLs (if requested)
 * @property {number} responseTime      - API response time in seconds
 * @property {Object} _meta             - Internal metadata
 */

/**
 * Perform a web search using Tavily.
 *
 * @param {string} query - The search query
 * @param {Object} [options]
 * @param {'basic'|'advanced'} [options.searchDepth='basic']
 *   'basic' is fast and cheap; 'advanced' runs deeper crawling (costs 2 credits).
 * @param {number} [options.maxResults=5] - Max results to return (1–10)
 * @param {number} [options.relevanceThreshold=0.3] - Minimum score to include (0–1)
 * @param {boolean} [options.includeAnswer=true] - Include AI direct answer
 * @param {boolean} [options.includeRawContent=false] - Include full page content
 * @param {string[]} [options.includeDomains=[]] - Whitelist specific domains
 * @param {string[]} [options.excludeDomains=[]] - Blacklist specific domains
 * @param {'general'|'news'|'finance'|'science'} [options.topic='general']
 *   Search topic category for better results.
 * @param {string} [options.days] - Limit to results from last N days (news topic)
 *
 * @returns {Promise<TavilySearchResponse>}
 */
export async function tavilySearch(query, options = {}) {
    if (!query || typeof query !== 'string' || !query.trim()) {
        throw new Error('[TavilyService] Search query must be a non-empty string');
    }

    const {
        searchDepth = 'basic',
        maxResults = DEFAULT_MAX_RESULTS,
        relevanceThreshold = DEFAULT_RELEVANCE_THRESHOLD,
        includeAnswer = true,
        includeRawContent = false,
        includeDomains = [],
        excludeDomains = [],
        topic = 'general',
        days,
    } = options;

    // Enforce rate limit before sending request
    await checkRateLimit();

    const clampedMax = Math.max(1, Math.min(API_MAX_RESULTS, maxResults));

    const requestBody = {
        query: query.trim(),
        search_depth: searchDepth,
        max_results: clampedMax,
        include_answer: includeAnswer,
        include_raw_content: includeRawContent,
        topic,
    };

    if (includeDomains.length > 0) requestBody.include_domains = includeDomains;
    if (excludeDomains.length > 0) requestBody.exclude_domains = excludeDomains;
    if (topic === 'news' && days) requestBody.days = days;

    console.log(`[TavilyService] Search: "${query.substring(0, 60)}" | depth=${searchDepth} | topic=${topic}`);

    const raw = await tavilyPost(requestBody);

    const filteredResults = filterResults(raw.results, relevanceThreshold);

    return {
        query: raw.query || query,
        answer: raw.answer || '',
        results: filteredResults,
        images: raw.images || [],
        responseTime: raw.response_time || 0,
        _meta: {
            rawResultCount: (raw.results || []).length,
            filteredResultCount: filteredResults.length,
            searchDepth,
            relevanceThreshold,
            dailyRequestCount: _rl.dailyCount,
        },
    };
}

/**
 * Perform a news-focused search (auto-selects topic='news').
 *
 * @param {string} query
 * @param {Object} [options] - Same as tavilySearch, topic is forced to 'news'
 * @param {number} [options.days=7] - Limit to last N days
 * @returns {Promise<TavilySearchResponse>}
 */
export async function tavilyNewsSearch(query, options = {}) {
    return tavilySearch(query, {
        ...options,
        topic: 'news',
        days: options.days ?? 7,
        searchDepth: options.searchDepth ?? 'basic',
    });
}

/**
 * Format Tavily search results into a human-readable string for AI consumption.
 *
 * @param {TavilySearchResponse} searchResponse
 * @param {Object} [options]
 * @param {boolean} [options.includeSnippets=true] - Include content excerpts
 * @param {boolean} [options.includeUrls=true] - Include source URLs
 * @param {number} [options.maxSnippetChars=300] - Per-result excerpt cap
 * @returns {string}
 */
export function formatTavilyResults(searchResponse, options = {}) {
    const { includeSnippets = true, includeUrls = true, maxSnippetChars = 300 } = options;
    const { query, answer, results } = searchResponse;

    if (!results || results.length === 0) {
        return `[网络搜索] 未找到关于"${query}"的相关结果。`;
    }

    const parts = [`🔍 **网络搜索结果** | Query: "${query}"\n`];

    // Direct answer block (AI-synthesized)
    if (answer) {
        parts.push(`**直接回答:**\n${answer}\n`);
        parts.push('---\n');
    }

    // Individual results
    parts.push(`**搜索来源 (${results.length} 条):**\n`);
    results.forEach((r, i) => {
        const scoreLabel = typeof r.score === 'number'
            ? `相关度 ${Math.round(r.score * 100)}%`
            : '相关度未知';
        const date = r.publishedDate ? ` (${r.publishedDate.slice(0, 10)})` : '';

        parts.push(`[${i + 1}] ${scoreLabel} — **${r.title || 'Untitled'}**${date}`);
        if (includeUrls) parts.push(`    ${r.url}`);
        if (includeSnippets && r.content) {
            const cap = Math.max(80, Math.min(Number(maxSnippetChars) || 300, 600));
            const snippet = buildRelevantSnippet(r.content, query, cap);
            parts.push(`    ${snippet}`);
        }
        parts.push('');
    });

    return parts.join('\n');
}

function buildRelevantSnippet(content, query, cap) {
    const cleaned = String(content || '')
        .replace(/> ## Documentation Index[\s\S]*?exploring further\.\s*/i, '')
        .replace(/Favicon for openrouter/gi, '')
        .replace(/OpenRouter \| Documentation home page(?:light logo)?(?:dark logo)?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (cleaned.length <= cap) return cleaned;

    const queryTerms = [...new Set(
        String(query || '')
            .toLocaleLowerCase()
            .match(/[a-z0-9][a-z0-9:/.-]{2,}/g) || []
    )].filter(term => !['versus', 'official', 'documentation'].includes(term));

    const segments = cleaned
        .split(/(?<=[.!?。！？])\s+|\s+(?=#+\s)|\s+(?=##\s)/)
        .map(segment => segment.trim())
        .filter(segment => segment.length >= 24);
    const scored = segments.map((segment, index) => {
        const lower = segment.toLocaleLowerCase();
        const score = queryTerms.reduce(
            (sum, term) => sum + (lower.includes(term) ? 1 : 0),
            0
        );
        return { segment, index, score };
    });
    const relevant = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, 2)
        .map(item => item.segment)
        .join(' ');
    const selected = relevant || cleaned;
    return selected.length > cap ? `${selected.slice(0, cap - 1)}…` : selected;
}

/**
 * Determine if a user message likely requires a real-time web search.
 * Used to auto-trigger search when the AI system needs current information.
 *
 * Heuristics checked:
 *  - Temporal keywords (today, latest, current, news, …)
 *  - Explicit search intent (search for, find out, look up, …)
 *  - Real-time data requests (stock price, weather, score, …)
 *  - Question patterns about recent events
 *
 * @param {string} message - User message text
 * @returns {{ shouldSearch: boolean, suggestedQuery: string | null, reason: string }}
 */
export function analyzeSearchIntent(message) {
    if (!message || typeof message !== 'string') {
        return { shouldSearch: false, suggestedQuery: null, reason: 'empty_message' };
    }

    const text = message.toLowerCase().trim();

    const TEMPORAL_PATTERNS = [
        /\b(today|tonight|yesterday|this week|this month|this year)\b/,
        /\b(latest|recent|current|now|right now|at the moment)\b/,
        /\b(breaking|live|just happened|just announced)\b/,
        /\b(\d{4})\b/, // year mention
        /\b(news|update|announcement|release)\b/,
    ];

    const SEARCH_INTENT_PATTERNS = [
        /\b(search for|look up|find out|google|tell me about|what is|who is|where is)\b/,
        /\b(how (much|many|long|far|old|tall)|what (time|date|day|year))\b/,
        /\b(price of|cost of|rate of|value of)\b/,
    ];

    const REAL_TIME_PATTERNS = [
        /\b(stock|crypto|bitcoin|market|exchange rate|forex)\b/,
        /\b(weather|temperature|forecast|rain|snow)\b/,
        /\b(score|result|match|game|tournament|standings)\b/,
        /\b(election|vote|poll|president|prime minister|chancellor)\b/,
        /\b(covid|pandemic|epidemic|outbreak|virus)\b/,
    ];

    const allPatterns = [...TEMPORAL_PATTERNS, ...SEARCH_INTENT_PATTERNS, ...REAL_TIME_PATTERNS];
    const matchedPatterns = allPatterns.filter(p => p.test(text));

    if (matchedPatterns.length === 0) {
        return { shouldSearch: false, suggestedQuery: null, reason: 'no_search_signal' };
    }

    // Build a cleaned query from the message
    const cleanedQuery = message
        .replace(/^(please|can you|could you|would you|help me)\s+/i, '')
        .replace(/[?!]+$/, '')
        .trim()
        .slice(0, 200); // keep query manageable

    return {
        shouldSearch: true,
        suggestedQuery: cleanedQuery,
        reason: `matched_patterns: ${matchedPatterns.length}`,
    };
}

/**
 * Get current daily request statistics.
 * Useful for monitoring usage in the UI.
 * @returns {{ dailyCount: number, dailyDate: string, windowCount: number }}
 */
export function getTavilyUsageStats() {
    return {
        dailyCount: _rl.dailyCount,
        dailyDate: _rl.dailyDate,
        windowCount: _rl.requestsInWindow,
    };
}

/**
 * Check if the Tavily API key is configured (without throwing).
 * @returns {boolean}
 */
export function isTavilyConfigured() {
    try {
        getTavilyApiKey();
        return true;
    } catch (e) {
        console.warn('[tavilyService] API key check failed:', e?.message);
        return false;
    }
}

export default {
    tavilySearch,
    tavilyNewsSearch,
    formatTavilyResults,
    analyzeSearchIntent,
    getTavilyUsageStats,
    isTavilyConfigured,
};
