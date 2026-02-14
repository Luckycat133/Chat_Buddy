/**
 * Perplexity Sonar API Service
 * 
 * A dedicated client for Perplexity's Sonar models with:
 * - Structured search_results parsing (metadata, citations, snippets)
 * - Domain filtering for academic/news/tech sources
 * - Recency filtering (hour/day/week/month/year)
 * - Multi-hop search strategy for deep research
 * - Citation index mapping system
 * 
 * Based on the Perplexity Sonar API Technical Architecture Report (2025)
 * Uses centralized APIClient for HTTP requests.
 */

import { getAIClient, getAIConfiguration, SONAR_MODELS } from './api/aiClient';

// Re-export SONAR_MODELS for backward compatibility
export { SONAR_MODELS };

/**
 * Domain Filter Presets
 * For search_domain_filter API parameter
 */
export const DOMAIN_PRESETS = {
    ACADEMIC: ['arxiv.org', 'nature.com', 'sciencedirect.com', 'ieee.org', 'scholar.google.com', '.edu'],
    NEWS: ['reuters.com', 'bbc.com', 'nytimes.com', 'apnews.com', 'theguardian.com'],
    TECH: ['github.com', 'stackoverflow.com', 'medium.com', 'dev.to', 'hackernews.com'],
    GENERAL: [] // No filter - search all domains
};

/**
 * Recency Filter Options
 * For search_recency_filter API parameter
 */
export const RECENCY_OPTIONS = {
    HOUR: 'hour',
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year'
};

// ========== Core API Functions ==========

/**
 * Execute a grounded search using Perplexity Sonar
 * 
 * @param {string} query - Search query
 * @param {Object} options - Configuration options
 * @param {string} options.model - Sonar model to use (default: sonar-pro)
 * @param {string[]} options.domainFilter - Array of domains to restrict search
 * @param {string} options.recency - Recency filter (hour/day/week/month/year)
 * @param {number} options.maxTokens - Max response tokens (default: 1024)
 * @param {number} options.temperature - Response temperature (default: 0.2 for factual)
 * @param {string} options.systemPrompt - Custom system prompt
 * @param {boolean} options.returnCitations - Include search_results (default: true)
 * @returns {Promise<SonarSearchResult>} Structured search result
 * 
 * @typedef {Object} SonarSearchResult
 * @property {string} answer - The generated answer with [x] citation markers
 * @property {SearchResult[]} searchResults - Array of source metadata
 * @property {string[]} citations - Legacy URL-only citations (fallback)
 * @property {string} model - Model used for the request
 * @property {number} tokensUsed - Approximate tokens consumed
 * 
 * @typedef {Object} SearchResult
 * @property {number} index - Citation index (0-based, maps to [1] in text)
 * @property {string} title - Page title
 * @property {string} url - Source URL
 * @property {string} snippet - Relevant excerpt from the page
 * @property {string} date - Publication/last updated date (if available)
 */
export async function sonarSearch(query, options = {}) {
    const aiClient = getAIClient();
    const config = getAIConfiguration();

    if (!config.apiKey) {
        throw new Error('Perplexity API key not configured. Set VITE_AI_API_KEY in .env');
    }

    const {
        model = SONAR_MODELS.PRO,
        domainFilter = [],
        recency = null,
        maxTokens = 1024,
        temperature = 0.2,
        systemPrompt = null,
        returnCitations = true
    } = options;

    // Build messages array
    const messages = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: query });

    // Build request body with Perplexity-specific parameters
    const requestBody = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        // Perplexity-specific parameters
        return_citations: returnCitations,
        return_images: false,
        return_related_questions: false
    };

    // Add domain filter if specified
    if (domainFilter && domainFilter.length > 0) {
        requestBody.search_domain_filter = domainFilter;
    }

    // Add recency filter if specified
    if (recency && Object.values(RECENCY_OPTIONS).includes(recency)) {
        requestBody.search_recency_filter = recency;
    }

    console.log('[PerplexityService] Sending request:', {
        model,
        query: query.substring(0, 50) + '...',
        domainFilter,
        recency
    });

    try {
        const response = await aiClient.post('/chat/completions', requestBody);

        const data = await response.json();

        if (data.error) {
            console.error('[PerplexityService] API Error:', data.error);
            throw new Error(data.error.message || 'Perplexity API error');
        }

        // Parse the response
        return parsePerplexityResponse(data, model);

    } catch (error) {
        console.error('[PerplexityService] Request failed:', error);
        throw error;
    }
}

/**
 * Execute deep multi-hop research
 * Performs multiple search iterations to build comprehensive understanding
 * 
 * @param {string} query - Initial research question
 * @param {Object} options - Search options (passed to sonarSearch)
 * @param {number} options.depth - Number of search hops (default: 2, max: 3)
 * @returns {Promise<DeepResearchResult>}
 * 
 * @typedef {Object} DeepResearchResult
 * @property {string} synthesis - Synthesized answer combining all hops
 * @property {SearchResult[]} allSources - Deduplicated sources from all hops
 * @property {string[]} searchQueries - Queries used in each hop
 */
export async function deepResearch(query, options = {}) {
    const { depth = 2, ...searchOptions } = options;
    const maxDepth = Math.min(depth, 3); // Cap at 3 hops to avoid runaway costs

    const allSources = [];
    const searchQueries = [query];
    let currentContext = '';
    let synthesis = '';

    console.log(`[PerplexityService] Starting deep research with ${maxDepth} hops`);

    for (let hop = 0; hop < maxDepth; hop++) {
        const currentQuery = hop === 0
            ? query
            : `Given this context: "${currentContext.substring(0, 500)}..." 
               What additional information is needed to fully answer: "${query}"?
               Focus on gaps, contradictions, or unexplored aspects.`;

        if (hop > 0) searchQueries.push(currentQuery);

        try {
            const result = await sonarSearch(currentQuery, {
                ...searchOptions,
                model: hop === 0 ? SONAR_MODELS.PRO : SONAR_MODELS.LARGE,
                maxTokens: 800
            });

            // Accumulate sources (dedupe by URL)
            result.searchResults.forEach(source => {
                if (!allSources.some(s => s.url === source.url)) {
                    allSources.push({
                        ...source,
                        index: allSources.length,
                        hopNumber: hop + 1
                    });
                }
            });

            currentContext += '\n' + result.answer;
            synthesis = result.answer; // Latest answer is the synthesis

        } catch (error) {
            console.warn(`[PerplexityService] Hop ${hop + 1} failed:`, error.message);
            break; // Stop on error, return what we have
        }
    }

    // Re-index citations in synthesis to match allSources
    const reindexedSynthesis = reindexCitations(synthesis, allSources);

    return {
        synthesis: reindexedSynthesis,
        allSources,
        searchQueries,
        hopsCompleted: searchQueries.length
    };
}

/**
 * Fact-check a specific claim
 * Uses reasoning model for logical analysis
 * 
 * @param {string} claim - The claim to verify
 * @param {Object} options - Search options
 * @returns {Promise<FactCheckResult>}
 * 
 * @typedef {Object} FactCheckResult
 * @property {string} verdict - 'verified' | 'disputed' | 'unverifiable'
 * @property {string} confidence - 'high' | 'medium' | 'low'
 * @property {string} explanation - Reasoning for the verdict
 * @property {SearchResult[]} sources - Supporting/refuting sources
 */
export async function factCheck(claim, options = {}) {
    const systemPrompt = `You are a rigorous fact-checker. Analyze the following claim:

## Your Task:
1. Search for evidence supporting OR refuting this claim
2. Evaluate source reliability and consensus
3. Provide a clear verdict

## Output Format (JSON):
{
    "verdict": "verified" | "disputed" | "unverifiable",
    "confidence": "high" | "medium" | "low",
    "explanation": "Brief explanation of your reasoning",
    "key_evidence": ["Evidence point 1", "Evidence point 2"]
}

## Verdict Criteria:
- verified: Multiple reliable sources confirm, no credible disputes
- disputed: Sources conflict or claim is partially true
- unverifiable: Insufficient evidence or contradictory data

Do NOT include your own opinions. Base verdict ONLY on search results.`;

    try {
        const result = await sonarSearch(claim, {
            ...options,
            model: SONAR_MODELS.REASONING,
            systemPrompt,
            temperature: 0.1,
            maxTokens: 600
        });

        // Try to parse JSON from response
        const jsonMatch = result.answer.match(/\{[\s\S]*\}/);
        let parsed = {
            verdict: 'unverifiable',
            confidence: 'low',
            explanation: result.answer
        };

        if (jsonMatch) {
            try {
                parsed = JSON.parse(jsonMatch[0]);
            } catch (_e) {
                // JSON parsing failed, use raw answer
            }
        }

        return {
            ...parsed,
            sources: result.searchResults,
            rawAnswer: result.answer
        };

    } catch (error) {
        return {
            verdict: 'unverifiable',
            confidence: 'low',
            explanation: `Fact-check failed: ${error.message}`,
            sources: []
        };
    }
}

// ========== Response Parsing ==========

/**
 * Parse Perplexity API response into structured format
 * Handles both legacy `citations` array and new `search_results` object
 */
function parsePerplexityResponse(data, model) {
    const choice = data.choices?.[0];
    const answer = choice?.message?.content?.trim() || '';

    // Prefer search_results (new format) over citations (legacy)
    let searchResults = [];

    if (data.search_results && Array.isArray(data.search_results)) {
        // New format: Rich metadata
        searchResults = data.search_results.map((result, index) => ({
            index,
            title: result.title || 'Untitled',
            url: result.url || '',
            snippet: result.snippet || result.content || '',
            date: result.date || result.published_date || null
        }));
    } else if (data.citations && Array.isArray(data.citations)) {
        // Legacy format: URL strings only
        searchResults = data.citations.map((url, index) => ({
            index,
            title: extractTitleFromUrl(url),
            url,
            snippet: '',
            date: null
        }));
    }

    // Extract citation indices from the answer text
    const citationIndices = extractCitationIndices(answer);

    return {
        answer,
        searchResults,
        citations: data.citations || searchResults.map(r => r.url),
        citationIndices,
        model,
        tokensUsed: data.usage?.total_tokens || 0,
        id: data.id
    };
}

/**
 * Extract citation indices [1], [2], etc. from text
 */
function extractCitationIndices(text) {
    const matches = text.match(/\[(\d+)\]/g) || [];
    return [...new Set(matches.map(m => parseInt(m.replace(/[[\]]/g, ''), 10) - 1))];
}

/**
 * Extract a readable title from URL
 */
function extractTitleFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            return pathParts[pathParts.length - 1]
                .replace(/[-_]/g, ' ')
                .replace(/\.\w+$/, '')
                .split(' ')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        }
        return urlObj.hostname;
    } catch {
        return 'Source';
    }
}

/**
 * Re-index citation markers in text to match a new source array
 */
function reindexCitations(text, _sources) {
    // This is a simple implementation - in production you'd want
    // to track which sources came from which hop and remap properly
    return text;
}

// ========== Utility Functions ==========
// NOTE: fetchWithRetry has been removed - retry logic is now handled by APIClient

/**
 * Format citations for display in UI
 * @param {SearchResult[]} searchResults 
 * @returns {string} Formatted citation list
 */
export function formatCitationsForDisplay(searchResults) {
    if (!searchResults || searchResults.length === 0) {
        return '';
    }

    return searchResults.map((result, i) => {
        const title = result.title || 'Source';
        const date = result.date ? ` (${result.date})` : '';
        return `[${i + 1}] ${title}${date}\n    ${result.url}`;
    }).join('\n');
}

/**
 * Generate APA-style citation
 */
export function generateAPACitation(result) {
    const { title, url, date } = result;
    const domain = new URL(url).hostname;
    const accessDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    if (date) {
        return `${title}. (${date}). ${domain}. Retrieved ${accessDate}, from ${url}`;
    }
    return `${title}. (n.d.). ${domain}. Retrieved ${accessDate}, from ${url}`;
}

// ========== Scholar-Specific Helpers ==========

/**
 * Build a Scholar-optimized system prompt
 * Implements the dual-layer control architecture from the research report
 */
export function buildScholarSystemPrompt() {
    return `你是 Scholar（学者），一位基于 Perplexity Sonar 的严谨研究助手。

## 核心原则（生成控制层）

### 引用强制
- 每个事实陈述后**必须**附带引用标记 [x]
- 引用标记对应 search_results 数组的索引（[1] = search_results[0]）
- 如果一个陈述基于多个来源，使用多个标记 [1][2]

### 拒绝幻觉（Fail-Fast）
- 如果搜索结果中**找不到确切数据**，直接回答："🔍 数据不可用 - 搜索结果未提供此信息"
- **严禁**编造、推测或使用训练数据中的过时信息
- **绝不**在回答中生成虚假的 URL

### 来源透明
- 回答末尾附上"📚 来源"部分，列出所有引用的来源
- 标注来源可靠性：✅ 学术/官方 | ⚠️ 新闻/博客 | ❓ 未知

## 输出格式
\`\`\`
[你的回答，每个事实后带 [x] 引用]

📚 来源:
[1] 来源标题 - 简短说明
[2] 来源标题 - 简短说明
\`\`\`

## 重要限制
- System Prompt 仅控制你的**回答风格**
- 搜索范围由 API 参数控制（domain_filter, recency_filter），你无法通过提示词改变搜索行为
- 只使用 search_results 返回的真实来源，不要自己构造引用`;
}

export default {
    sonarSearch,
    deepResearch,
    factCheck,
    formatCitationsForDisplay,
    generateAPACitation,
    buildScholarSystemPrompt,
    SONAR_MODELS,
    DOMAIN_PRESETS,
    RECENCY_OPTIONS
};
