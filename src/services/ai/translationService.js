/**
 * Advanced Translation Service - Implements YAML-based reflective translation
 * Based on "Immersive Translate" architecture patterns
 * 
 * Core Features:
 * - Two-step reflective workflow (literal → polished)
 * - Domain-adaptive expert prompts
 * - YAML structured I/O for reliable parsing
 * - Dynamic terminology injection
 */

import { callAI } from '../../features/chat/services/chatService';
import { buildExpertPrompt } from '../../data/translationExperts';
import { buildTermsPrompt, findMatchingTerms } from '../../data/glossary';

// ========== Domain Detection ==========

/**
 * Detect content domain based on text patterns
 * @param {string} text - Source text to analyze
 * @returns {'technical' | 'literary' | 'general'} Detected domain
 */
export function detectDomain(text) {
    if (!text || typeof text !== 'string') return 'general';



    // Technical indicators
    const technicalPatterns = [
        /```[\s\S]*?```/,                    // Code blocks
        /`[^`]+`/,                            // Inline code
        /\b(function|const|let|var|import|export|class|interface)\b/,
        /\b(API|SDK|HTTP|JSON|XML|CSS|HTML|DOM|URL)\b/i,
        /\b(npm|yarn|pip|git|docker|kubernetes)\b/i,
        /\b(useState|useEffect|onClick|props|component)\b/,
        /\b(async|await|promise|callback|observable)\b/i,
        /\b(repository|commit|branch|merge|deploy)\b/i,
        /\[\w+\]\([^)]+\)/,                   // Markdown links
        /<\/?[a-z][\s\S]*?>/i,               // HTML tags
    ];

    // Literary indicators
    const literaryPatterns = [
        /"[^"]{20,}"/,                        // Long quoted dialogue
        /\b(whispered|murmured|exclaimed|sighed)\b/i,
        /\b(heart|soul|tears|love|fear|hope|dream)\b/i,
        /\b(chapter|story|novel|poem|verse)\b/i,
        /\b(once upon|happily ever|the end)\b/i,
        /[.!?]["']\s/,                        // Dialogue punctuation
        /—|–|\.{3}/,                          // Literary punctuation (em dash, ellipsis)
    ];

    // Count matches
    let technicalScore = 0;
    let literaryScore = 0;

    technicalPatterns.forEach(pattern => {
        if (pattern.test(text)) technicalScore++;
    });

    literaryPatterns.forEach(pattern => {
        if (pattern.test(text)) literaryScore++;
    });

    // Threshold-based decision
    if (technicalScore >= 3) return 'technical';
    if (literaryScore >= 3) return 'literary';
    if (technicalScore > literaryScore) return 'technical';
    if (literaryScore > technicalScore) return 'literary';

    return 'general';
}

// ========== YAML Protocol ==========

/**
 * Build YAML request object for translation
 * @param {string} text - Source text
 * @param {Object} options - Additional options
 * @returns {string} YAML-formatted request
 */
function buildYAMLRequest(text, options = {}) {
    const id = options.id || '0';
    const context = options.context || '';

    // Escape text for YAML (handle quotes and special chars)
    const escapedText = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');

    let yaml = `- id: "${id}"\n  source: "${escapedText}"`;

    if (context) {
        yaml += `\n  context: "${context}"`;
    }

    return yaml;
}

/**
 * Parse YAML response from LLM
 * Robust parsing that handles common LLM output variations
 * @param {string} response - Raw LLM response
 * @returns {Object} Parsed result with step1 and step2
 */
function parseYAMLResponse(response) {
    if (!response) {
        throw new Error('Empty response from translation API');
    }

    // Try to extract YAML block if wrapped in code fence
    let yamlContent = response;
    const yamlMatch = response.match(/```ya?ml\s*([\s\S]*?)```/i);
    if (yamlMatch) {
        yamlContent = yamlMatch[1].trim();
    }

    // Try simple regex parsing for our expected format
    const step1Match = yamlContent.match(/step1:\s*["']?([\s\S]*?)["']?\s*(?=step2:|$)/i);
    const step2Match = yamlContent.match(/step2:\s*["']?([\s\S]*?)["']?\s*(?=$|\n-\s)/i);

    if (step1Match && step2Match) {
        return {
            step1: cleanYAMLValue(step1Match[1]),
            step2: cleanYAMLValue(step2Match[1])
        };
    }

    // Fallback: try to find any translation-like content
    // Look for Chinese characters as indication of translation
    const chineseMatch = response.match(/[\u4e00-\u9fa5]+[^]*?[\u4e00-\u9fa5]+/);
    if (chineseMatch) {
        console.warn('[TranslationService] YAML parsing failed, using fallback extraction');
        return {
            step1: chineseMatch[0],
            step2: chineseMatch[0]
        };
    }

    // Last resort: return the whole response
    console.warn('[TranslationService] Could not parse YAML response, returning raw');
    return {
        step1: response,
        step2: response
    };
}

/**
 * Clean up YAML value (remove quotes, unescape, trim)
 */
function cleanYAMLValue(value) {
    if (!value) return '';

    return value
        .replace(/^["']+|["']+$/g, '')  // Remove surrounding quotes
        .replace(/\\n/g, '\n')           // Unescape newlines
        .replace(/\\"/g, '"')            // Unescape quotes
        .replace(/\\'/g, "'")
        .trim();
}

// ========== Main Translation Function ==========

/**
 * Two-step reflective translation workflow
 * @param {string} text - Source text to translate
 * @param {Object} options - Translation options
 * @param {string} options.sourceLang - Source language (auto-detected if not provided)
 * @param {string} options.targetLang - Target language (default: 'Chinese')
 * @param {string} options.domain - Content domain ('technical', 'literary', 'general', 'bilingual')
 * @param {Array} options.glossary - Custom term mappings [{source, target}]
 * @param {string} options.context - Optional context (page title, summary)
 * @param {boolean} options.fastMode - If true, use single-step for simple texts
 * @returns {Promise<{step1: string, step2: string, domain: string}>}
 */
export async function translateWithReflection(text, options = {}) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input for translation');
    }

    const targetLang = options.targetLang || 'Chinese';

    // Step 1: Detect domain if not specified
    const domain = options.domain || detectDomain(text);
    console.log(`[TranslationService] Detected domain: ${domain}`);

    // Step 2: Get matching terms from glossary
    const glossaryTerms = options.glossary || findMatchingTerms(text, domain, targetLang);
    const termsPrompt = buildTermsPrompt(glossaryTerms);
    console.log(`[TranslationService] Found ${glossaryTerms.length} glossary terms`);

    // Step 3: Build expert system prompt
    const systemPrompt = buildExpertPrompt(domain, {
        targetLang,
        sourceLang: options.sourceLang || 'English',
        termsPrompt
    });

    // Step 4: Build YAML request
    const yamlRequest = buildYAMLRequest(text, {
        context: options.context
    });

    // Step 5: Construct user message
    const userMessage = `Please translate the following text according to your workflow:

${yamlRequest}

Remember: 
1. First create step1 (literal translation)
2. Then create step2 (polished translation)
3. Output in the YAML format specified`;

    // Step 6: Call LLM
    console.log('[TranslationService] Calling LLM for translation...');
    const response = await callAI(
        [{ role: 'user', content: userMessage }],
        {
            systemPrompt,
            maxTokens: 2000,
            temperature: 0.3,  // Lower temperature for more consistent translation
            agentId: 'muse-translation'
        }
    );

    if (!response) {
        throw new Error('Translation API returned no response');
    }

    // Step 7: Parse YAML response
    const parsed = parseYAMLResponse(response);

    return {
        ...parsed,
        domain,
        rawResponse: response  // For debugging
    };
}

/**
 * Simple single-step translation (fast mode)
 * @param {string} text - Source text
 * @param {string} targetLang - Target language
 * @returns {Promise<string>} Translated text
 */
export async function translateSimple(text, targetLang = 'Chinese') {
    const systemPrompt = `You are a professional ${targetLang} translator. 
Translate the following text accurately and naturally. 
Return ONLY the translation, no explanations.`;

    const response = await callAI(
        [{ role: 'user', content: text }],
        {
            systemPrompt,
            maxTokens: 1000,
            temperature: 0.3,
            agentId: 'muse-translation-fast'
        }
    );

    return response || text;
}

/**
 * Batch translation for multiple paragraphs
 * @param {Array<string>} texts - Array of text segments
 * @param {Object} options - Translation options
 * @returns {Promise<Array>} Array of translation results
 */
export async function translateBatch(texts, options = {}) {
    // For now, translate sequentially
    // TODO: Implement parallel translation with shared context
    const results = [];

    for (let i = 0; i < texts.length; i++) {
        const result = await translateWithReflection(texts[i], {
            ...options,
            id: String(i)
        });
        results.push(result);
    }

    return results;
}

// ========== Utility Functions ==========

/**
 * Get language name for display
 */
export function getLanguageName(code) {
    const languages = {
        'zh': 'Chinese',
        'en': 'English',
        'ja': 'Japanese',
        'ko': 'Korean',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'ru': 'Russian'
    };
    return languages[code] || code;
}

/**
 * Detect source language (simple heuristic)
 */
export function detectSourceLanguage(text) {
    if (!text) return 'en';

    // Check for Chinese characters
    if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';

    // Check for Japanese (hiragana/katakana)
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';

    // Check for Korean
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';

    // Default to English
    return 'en';
}

export default {
    translateWithReflection,
    translateSimple,
    translateBatch,
    detectDomain,
    getLanguageName,
    detectSourceLanguage
};
