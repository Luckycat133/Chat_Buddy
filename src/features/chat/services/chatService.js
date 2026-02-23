/**
 * Service for handling AI interactions and API calls for the Chat feature.
 * Uses centralized APIClient for HTTP requests.
 */

import { getAIClient, getAIConfiguration } from '../../../services/api/aiClient';

/**
 * Call the AI API with the given messages history
 * @param {Array} messages - List of message objects {role, content}
 * @param {Object} options - Optional configuration for the API call
 * @param {string} options.systemPrompt - Custom system prompt for specialized agents
 * @param {string} options.agentId - Agent ID for logging/tracking
 * @param {number} options.maxTokens - Maximum tokens for response (default: 150, task agents: 500)
 * @param {number} options.temperature - Response temperature (default: 0.8)
 * @returns {Promise<string|null>} - The AI response content or null if failed
 */
export async function callAI(messages, options = {}) {
    const aiClient = getAIClient();
    const config = getAIConfiguration();

    if (!config.apiKey) {
        console.error('AI API Key not configured. Set VITE_AI_API_KEY in .env');
        return null;
    }

    // Build messages array with optional system prompt
    let apiMessages = [...messages];

    // Prepend system prompt if provided (for specialized task agents)
    if (options.systemPrompt) {
        // Check if there's already a system message at the start
        if (apiMessages.length > 0 && apiMessages[0].role === 'system') {
            // Enhance existing system message
            apiMessages[0] = {
                role: 'system',
                content: options.systemPrompt + '\n\n---\n\n' + apiMessages[0].content
            };
        } else {
            // Add new system message at the beginning
            apiMessages.unshift({
                role: 'system',
                content: options.systemPrompt
            });
        }
    }

    // Configure tokens and model based on options
    // REMOVED: Default token limits. Let the model/provider decide the limit to prevent truncation.
    const maxTokens = options.maxTokens;
    const temperature = options.temperature ?? 0.8;
    // Allow overriding model (e.g. for Perplexity Sonar search)
    const selectedModel = options.model || config.model;

    const requestBody = {
        model: selectedModel,
        messages: apiMessages,
        temperature: temperature
    };

    if (maxTokens) {
        requestBody.max_tokens = maxTokens;
    }

    try {
        const response = await aiClient.post('/chat/completions', requestBody);

        const data = await response.json();
        if (data.error) {
            console.error('API Error:', data.error, options.agentId ? `(Agent: ${options.agentId})` : '');
            return null;
        }
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.trim();
        }
        return null;
    } catch (error) {
        console.error('API Call Failed:', error, options.agentId ? `(Agent: ${options.agentId})` : '');
        return null;
    }
}

/**
 * Clean tool markers from message content
 * @param {string} content - Raw AI response
 * @returns {string} - Cleaned content for display
 */
export function cleanMessageContent(content) {
    if (!content) return '';
    let cleaned = content;

    // Remove MULTI tags with all content (greedy within the tag)
    cleaned = cleaned.replace(/\[(?:MULTI|Multi|multi):[^\]]*\]/gi, '');

    // Remove SCHEDULE tags
    cleaned = cleaned.replace(/\[SCHEDULE:\s*\d+\s*\]/gi, '');

    // Handle REACT tags - extract just the emoji content
    cleaned = cleaned.replace(/\[REACT:\s*([^\]]*)\]/gi, (match, emoji) => {
        return emoji ? ` ${emoji.trim()}` : '';
    });

    // Remove SILENCE markers
    cleaned = cleaned.replace(/\[SILENCE\]/gi, '');

    // Remove reference patterns like [1], [2], [R1].
    cleaned = cleaned.replace(/\[(?:\d+|R\d+)\]/g, '');

    // Remove stray closing brackets (possibly orphaned)
    cleaned = cleaned.replace(/\]\]/g, ']');
    cleaned = cleaned.replace(/\]\s*$/g, '');

    // Transform GAME:Poll messages for AI context instead of removing them
    cleaned = cleaned.replace(/\[GAME:Poll:\s*(.+?)\]/gi, (match, question) => {
        return `[System: A poll has been created: "${question}". Please vote for an option.]`;
    });

    // Note: [POLL:ID] messages are kept as is, handled in context preparation

    // Remove any remaining [...] patterns that look like tool markers
    // Match patterns like [Something:...] or [snake_case:...]
    // UPDATED: Allow lowercase keys for tools like [immersive_translate:...]
    cleaned = cleaned.replace(/\[[a-zA-Z0-9_]+:[^\]]*\]/g, '');
    cleaned = cleaned.replace(/\[[A-Z]{2,}\]/g, '');

    // Clean up pipe characters ONLY if surrounded by single spaces (MULTI tag remnants)
    // Preserve pipes at line start/end which are table delimiters
    // DISABLED: This was breaking markdown tables. Better to leave pipes alone.
    // cleaned = cleaned.replace(/\s*\|\s*/g, ' ');

    // Clean up double or triple HORIZONTAL spaces only (preserve newlines for Markdown)
    cleaned = cleaned.replace(/[^\S\n]{2,}/g, ' ');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Calculate typing delay based on message length and typing speed
 * @param {number} messageLength 
 * @param {string} typingSpeed - 'slow', 'normal', 'fast'
 * @returns {number} delay in ms
 */
export function calculateTypingDelay(messageLength, typingSpeed) {
    const baseCharsPerSecond = {
        slow: 3,
        normal: 5,
        fast: 8
    };
    const charsPerSecond = baseCharsPerSecond[typingSpeed] || 5;
    return Math.min(3000, Math.max(500, (messageLength / charsPerSecond) * 1000));
}

/**
 * Calculate random delay within range
 * @param {Object} delayConfig - { min, max }
 * @returns {number} delay in ms
 */
export function getRandomDelay(delayConfig) {
    const { min, max } = delayConfig;
    return min + Math.random() * (max - min);
}
