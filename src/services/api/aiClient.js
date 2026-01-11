/**
 * AI API Client Instance
 * Pre-configured APIClient instance for AI services (Perplexity, etc.)
 * Centralizes configuration and provides retry/timeout handling
 */
import APIClient from './APIClient';

// ========== Model Constants ==========

/**
 * Chat Model Options for routing (llama-based)
 * Used by chatService for complexity-based model selection
 */
export const CHAT_MODELS = {
    small: 'llama-3.1-sonar-small-128k-chat',    // Fast, cheap, good for simple queries
    large: 'llama-3.1-sonar-large-128k-chat',    // Powerful, for complex reasoning
    online: 'llama-3.1-sonar-small-128k-online'  // Web search enabled
};

/**
 * Sonar Model Options (for Scholar/research)
 * Used by perplexityService for search and research
 */
export const SONAR_MODELS = {
    SMALL: 'llama-3.1-sonar-small-128k-online',  // Fast, low-cost
    LARGE: 'llama-3.1-sonar-large-128k-online',  // Balanced
    PRO: 'sonar-pro',                             // Deep research
    REASONING: 'sonar-reasoning-pro'              // Chain-of-Thought
};

// ========== Configuration ==========

// Get configuration from environment
const getAIConfig = () => ({
    baseUrl: import.meta.env.VITE_AI_API_URL || 'https://api.perplexity.ai',
    apiKey: import.meta.env.VITE_AI_API_KEY,
    defaultModel: import.meta.env.VITE_AI_MODEL || 'sonar-pro'
});

// Create a singleton instance
let aiClientInstance = null;

/**
 * Get or create the AI API client instance
 * @returns {APIClient} Configured API client
 */
export function getAIClient() {
    if (!aiClientInstance) {
        const config = getAIConfig();

        aiClientInstance = new APIClient({
            baseURL: config.baseUrl,
            timeout: 60000, // 60 seconds for AI responses
            maxRetries: 3,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Set auth token if available
        if (config.apiKey) {
            aiClientInstance.setAuthToken(config.apiKey);
        }
    }

    return aiClientInstance;
}

/**
 * Get AI configuration (for use in services that need model info, etc.)
 * @returns {Object} AI configuration object
 */
export function getAIConfiguration() {
    return getAIConfig();
}

/**
 * Reset the client instance (useful for testing or config changes)
 */
export function resetAIClient() {
    aiClientInstance = null;
}

export default getAIClient;
