/**
 * Translation Glossary System
 * Provides terminology consistency across translations
 * 
 * Features:
 * - Built-in technical terms for common domains
 * - User-customizable glossary stored in localStorage
 * - Dynamic term injection into prompts
 */

const GLOSSARY_STORAGE_KEY = 'muse_translation_glossary';

// ========== Built-in Technical Terms (Chinese) ==========
export const DEFAULT_GLOSSARY_ZH = [
    // React/JavaScript
    { source: 'component', target: '组件', domain: 'technical' },
    { source: 'state', target: '状态', domain: 'technical' },
    { source: 'props', target: 'props', domain: 'technical', note: 'React专用术语，保持原文' },
    { source: 'hook', target: 'Hook', domain: 'technical', note: '首字母大写' },
    { source: 'render', target: '渲染', domain: 'technical' },
    { source: 'lifecycle', target: '生命周期', domain: 'technical' },
    { source: 'context', target: '上下文', domain: 'technical' },
    { source: 'reducer', target: 'reducer', domain: 'technical', note: 'Redux术语，保持原文' },

    // Async Programming
    { source: 'Promise', target: 'Promise', domain: 'technical', note: '不翻译' },
    { source: 'async/await', target: 'async/await', domain: 'technical', note: '不翻译' },
    { source: 'callback', target: '回调函数', domain: 'technical' },
    { source: 'Observable', target: '可观察对象', domain: 'technical' },
    { source: 'stream', target: '流', domain: 'technical' },

    // Web Development
    { source: 'API', target: 'API', domain: 'technical', note: '不翻译' },
    { source: 'endpoint', target: '端点', domain: 'technical' },
    { source: 'request', target: '请求', domain: 'technical' },
    { source: 'response', target: '响应', domain: 'technical' },
    { source: 'middleware', target: '中间件', domain: 'technical' },
    { source: 'routing', target: '路由', domain: 'technical' },
    { source: 'authentication', target: '身份验证', domain: 'technical' },
    { source: 'authorization', target: '授权', domain: 'technical' },

    // Git/Version Control
    { source: 'repository', target: '仓库', domain: 'technical' },
    { source: 'commit', target: 'commit', domain: 'technical', note: 'Git术语，保持原文' },
    { source: 'branch', target: '分支', domain: 'technical' },
    { source: 'merge', target: '合并', domain: 'technical' },
    { source: 'pull request', target: 'Pull Request', domain: 'technical', note: '保持原文' },
    { source: 'fork', target: 'fork', domain: 'technical', note: '保持原文' },

    // Database
    { source: 'query', target: '查询', domain: 'technical' },
    { source: 'schema', target: '模式/架构', domain: 'technical' },
    { source: 'migration', target: '迁移', domain: 'technical' },
    { source: 'transaction', target: '事务', domain: 'technical' },

    // AI/ML
    { source: 'model', target: '模型', domain: 'technical' },
    { source: 'training', target: '训练', domain: 'technical' },
    { source: 'inference', target: '推理', domain: 'technical' },
    { source: 'prompt', target: '提示词', domain: 'technical' },
    { source: 'token', target: 'token', domain: 'technical', note: 'LLM术语，保持原文' },
    { source: 'embedding', target: '嵌入/向量', domain: 'technical' },
];

// ========== Built-in Literary Terms ==========
export const DEFAULT_GLOSSARY_LITERARY = [
    { source: 'narrator', target: '叙述者', domain: 'literary' },
    { source: 'protagonist', target: '主角', domain: 'literary' },
    { source: 'antagonist', target: '反派', domain: 'literary' },
    { source: 'foreshadowing', target: '伏笔', domain: 'literary' },
    { source: 'metaphor', target: '隐喻', domain: 'literary' },
    { source: 'symbolism', target: '象征', domain: 'literary' },
];

/**
 * Build terms prompt section from glossary array
 * @param {Array} terms - Array of {source, target, note} objects
 * @returns {string} Formatted prompt section for injection
 */
export function buildTermsPrompt(terms = []) {
    if (!terms || terms.length === 0) return '';

    const termLines = terms.map(t => {
        if (t.note) {
            return `- "${t.source}" → "${t.target}" (${t.note})`;
        }
        return `- "${t.source}" → "${t.target}"`;
    });

    return `## Terminology Constraints (术语约束)
The following terms MUST be translated consistently as specified:

${termLines.join('\n')}

⚠️ CRITICAL: Adhere strictly to these mappings throughout your translation.`;
}

/**
 * Get user's custom glossary from localStorage
 * @returns {Array} User's custom terms
 */
export function getUserGlossary() {
    try {
        const stored = localStorage.getItem(GLOSSARY_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('[Glossary] Error reading user glossary:', e);
        return [];
    }
}

/**
 * Save user's custom glossary to localStorage
 * @param {Array} glossary - Array of term objects
 * @returns {boolean} Success status
 */
export function saveUserGlossary(glossary) {
    try {
        localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify(glossary));
        return true;
    } catch (e) {
        console.error('[Glossary] Error saving user glossary:', e);
        return false;
    }
}

/**
 * Add a term to user's custom glossary
 * @param {string} source - Source term
 * @param {string} target - Target translation
 * @param {string} domain - Domain ('technical', 'literary', 'general')
 * @param {string} note - Optional note
 * @returns {Array} Updated glossary
 */
export function addToGlossary(source, target, domain = 'general', note = '') {
    const glossary = getUserGlossary();
    const existing = glossary.findIndex(t => t.source.toLowerCase() === source.toLowerCase());

    const newTerm = { source, target, domain, ...(note && { note }) };

    if (existing >= 0) {
        glossary[existing] = newTerm;
    } else {
        glossary.push(newTerm);
    }

    saveUserGlossary(glossary);
    return glossary;
}

/**
 * Remove a term from user's custom glossary
 * @param {string} source - Source term to remove
 * @returns {Array} Updated glossary
 */
export function removeFromGlossary(source) {
    const glossary = getUserGlossary();
    const filtered = glossary.filter(t => t.source.toLowerCase() !== source.toLowerCase());
    saveUserGlossary(filtered);
    return filtered;
}

/**
 * Get combined glossary (default + user) filtered by domain
 * User terms override default terms with the same source
 * @param {string} domain - Domain filter ('technical', 'literary', 'general', or 'all')
 * @param {string} targetLang - Target language code ('zh', 'en', etc.)
 * @returns {Array} Combined and deduplicated glossary
 */
export function getCombinedGlossary(domain = 'general', targetLang = 'zh') {
    // Get default glossary based on target language
    let defaults = [];
    if (targetLang === 'zh' || targetLang === 'Chinese') {
        defaults = [...DEFAULT_GLOSSARY_ZH];
        if (domain === 'literary') {
            defaults = [...defaults, ...DEFAULT_GLOSSARY_LITERARY];
        }
    }

    // Get user's custom terms
    const userTerms = getUserGlossary();

    // Filter by domain if not 'all'
    const filterByDomain = (terms) => {
        if (domain === 'all') return terms;
        return terms.filter(t => !t.domain || t.domain === domain || t.domain === 'general');
    };

    const filteredDefaults = filterByDomain(defaults);
    const filteredUserTerms = filterByDomain(userTerms);

    // Merge with user terms taking precedence
    const termMap = new Map();
    filteredDefaults.forEach(t => termMap.set(t.source.toLowerCase(), t));
    filteredUserTerms.forEach(t => termMap.set(t.source.toLowerCase(), t));

    return Array.from(termMap.values());
}

/**
 * Extract potential terms from text that might need consistent translation
 * Simple heuristic: looks for capitalized words, camelCase, technical patterns
 * @param {string} text - Source text to analyze
 * @returns {Array} Potential terms found
 */
export function extractPotentialTerms(text) {
    const terms = new Set();

    // Match CamelCase words (likely code/technical terms)
    const camelCasePattern = /\b([A-Z][a-z]+[A-Z][a-zA-Z]*)\b/g;
    let match;
    while ((match = camelCasePattern.exec(text)) !== null) {
        terms.add(match[1]);
    }

    // Match ALL_CAPS words (constants, acronyms)
    const capsPattern = /\b([A-Z]{2,})\b/g;
    while ((match = capsPattern.exec(text)) !== null) {
        terms.add(match[1]);
    }

    // Match words inside backticks (inline code)
    const codePattern = /`([^`]+)`/g;
    while ((match = codePattern.exec(text)) !== null) {
        // Only add if it looks like a single term (no spaces)
        if (!match[1].includes(' ') && match[1].length < 30) {
            terms.add(match[1]);
        }
    }

    return Array.from(terms);
}

/**
 * Find matching glossary terms in the given text
 * @param {string} text - Text to search
 * @param {string} domain - Domain for glossary lookup
 * @param {string} targetLang - Target language
 * @returns {Array} Matching terms from glossary
 */
export function findMatchingTerms(text, domain = 'technical', targetLang = 'zh') {
    const glossary = getCombinedGlossary(domain, targetLang);

    return glossary.filter(term => {
        const sourceLower = term.source.toLowerCase();
        // Check if the term appears as a whole word
        const regex = new RegExp(`\\b${sourceLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(text);
    });
}

export default {
    buildTermsPrompt,
    getUserGlossary,
    saveUserGlossary,
    addToGlossary,
    removeFromGlossary,
    getCombinedGlossary,
    extractPotentialTerms,
    findMatchingTerms,
    DEFAULT_GLOSSARY_ZH,
    DEFAULT_GLOSSARY_LITERARY
};
