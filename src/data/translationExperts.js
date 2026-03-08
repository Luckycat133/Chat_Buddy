/**
 * Translation Experts - Domain-specific system prompts for immersive translation
 * Based on "Immersive Translate" architecture patterns
 * 
 * Each expert provides optimized prompts for different content types:
 * - Technical: Code preservation, markdown formatting, terminology
 * - Literary: Cultural adaptation, emotional resonance, style transfer
 * - General: Balanced accuracy and fluency
 * - Bilingual: Language learning with mixed content
 */

export const TRANSLATION_EXPERTS = {
    technical: {
        id: 'technical',
        name: 'Technical Document Expert',
        name_zh: '技术文档专家',
        description: 'Optimized for code, API docs, and technical content',
        description_zh: '针对代码、API文档和技术内容优化',

        /**
         * Build system prompt with variable substitution
         * @param {Object} vars - Variables to substitute
         * @param {string} vars.targetLang - Target language
         * @param {string} vars.termsPrompt - Terminology constraints
         * @returns {string} Complete system prompt
         */
        buildPrompt: (vars = {}) => {
            const targetLang = vars.targetLang || 'Chinese';
            const termsPrompt = vars.termsPrompt || '';

            return `You are a native ${targetLang} translator for technical content.

Hard rules:
1. Never translate code, commands, paths, identifiers, or API/class/function names.
2. Keep Markdown/HTML structure unchanged (headings, lists, links, tables, code fences, inline code).
3. Keep common technical/platform terms in source form unless glossary overrides.
4. If unsure, preserve the original token.

Workflow:
- step1: literal faithful translation (no omission/addition).
- step2: natural ${targetLang} polish based on step1; only rewrite prose.

${termsPrompt}

Return YAML only:
- id: "0"
  step1: "..."
  step2: "..."`;
        }
    },

    literary: {
        id: 'literary',
        name: 'Literary Translation Expert',
        name_zh: '文学意译专家',
        description: 'Optimized for creative writing, novels, and emotional content',
        description_zh: '针对创意写作、小说和情感内容优化',

        buildPrompt: (vars = {}) => {
            const targetLang = vars.targetLang || 'Chinese';
            const termsPrompt = vars.termsPrompt || '';

            return `You are a native ${targetLang} literary translator.

Hard rules:
1. Keep all meaning; no omission or invention.
2. Preserve voice, tone, rhythm, and emotional effect.
3. Adapt idioms/cultural references naturally for ${targetLang} readers.
4. If literal and expressive conflict, keep meaning first, then optimize impact.

Workflow:
- step1: literal semantic anchor with key tone cues.
- step2: fluent literary rewrite in ${targetLang} with equivalent impact.

${termsPrompt}

Return YAML only:
- id: "0"
  step1: "..."
  step2: "..."`;
        }
    },

    general: {
        id: 'general',
        name: 'General Translation Expert',
        name_zh: '通用翻译专家',
        description: 'Balanced translation for mixed content',
        description_zh: '适用于混合内容的平衡翻译',

        buildPrompt: (vars = {}) => {
            const targetLang = vars.targetLang || 'Chinese';
            const termsPrompt = vars.termsPrompt || '';

            return `You are a native ${targetLang} translator.

Hard rules:
1. Preserve meaning completely; no omission/addition.
2. Keep tone/register aligned with source.
3. Preserve numbers, dates, names, and structure.

Workflow:
- step1: direct accurate translation.
- step2: natural ${targetLang} polish while preserving meaning.

${termsPrompt}

Return YAML only:
- id: "0"
  step1: "..."
  step2: "..."`;
        }
    },

    bilingual: {
        id: 'bilingual',
        name: 'Bilingual Mix Expert',
        name_zh: '双语混合专家',
        description: 'Creates mixed-language content for language learning',
        description_zh: '创建适合语言学习的双语混合内容',

        buildPrompt: (vars = {}) => {
            const targetLang = vars.targetLang || 'Chinese';
            const sourceLang = vars.sourceLang || 'English';
            const termsPrompt = vars.termsPrompt || '';

            return `You create bilingual learning text (${sourceLang} + ${targetLang}).

Rules:
1. Keep key terms/proper nouns/specialized vocabulary in ${sourceLang}.
2. Translate common words into ${targetLang} for comprehension.
3. Keep sentences natural in ${targetLang} syntax.
4. Keep meaning complete and accurate.

Workflow:
- step1: full translation with key ${sourceLang} terms retained/marked.
- step2: smoother mixed-language learning version.

${termsPrompt}

Return YAML only:
- id: "0"
  step1: "..."
  step2: "..."`;
        }
    }
};

/**
 * Get expert by domain ID
 * @param {string} domain - 'technical' | 'literary' | 'general' | 'bilingual'
 * @returns {Object|null} Expert configuration or null
 */
export function getExpert(domain) {
    return TRANSLATION_EXPERTS[domain] || TRANSLATION_EXPERTS.general;
}

/**
 * Get all available experts
 * @returns {Array} Array of expert configurations
 */
export function getAllExperts() {
    return Object.values(TRANSLATION_EXPERTS);
}

/**
 * Build a complete system prompt for an expert
 * @param {string} domain - Expert domain
 * @param {Object} vars - Variables for substitution
 * @returns {string} Complete system prompt
 */
export function buildExpertPrompt(domain, vars = {}) {
    const expert = getExpert(domain);
    return expert.buildPrompt(vars);
}

export default TRANSLATION_EXPERTS;
