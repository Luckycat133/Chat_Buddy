/**
 * AI API Client Instance
 * Pre-configured APIClient for all AI services.
 * Reads configuration from the unified apiConfig system.
 */
import APIClient from './APIClient';
import { getConfig } from '../../config/apiConfig';

// ========== Model Constants ==========

/**
 * Chat Model Options for routing (llama-based, Perplexity defaults)
 * These are fallback presets — the user's configured model always takes priority.
 */
export const CHAT_MODELS = {
    small: 'llama-3.1-sonar-small-128k-chat',
    large: 'llama-3.1-sonar-large-128k-chat',
    online: 'llama-3.1-sonar-small-128k-online'
};

/**
 * Sonar Model Options (for Scholar/research)
 */
export const SONAR_MODELS = {
    SMALL: 'llama-3.1-sonar-small-128k-online',
    LARGE: 'llama-3.1-sonar-large-128k-online',
    PRO: 'sonar-pro',
    REASONING: 'sonar-reasoning-pro'
};

// ========== Singleton ==========

let aiClientInstance = null;

/**
 * Get or create the AI API client instance.
 * Config priority: localStorage runtime > .env build-time > defaults
 */
export function getAIClient() {
    if (!aiClientInstance) {
        const config = getConfig();

        aiClientInstance = new APIClient({
            baseURL: config.baseUrl,
            timeout: config.timeout || 60000,
            maxRetries: config.maxRetries || 3,
            headers: { 'Content-Type': 'application/json' }
        });

        if (config.apiKey) {
            aiClientInstance.setAuthToken(config.apiKey);
        }
    }
    return aiClientInstance;
}

/**
 * Get current AI configuration (model name, temperature, etc.)
 */
export function getAIConfiguration() {
    return getConfig();
}

/**
 * Reset the singleton — call after saving new config so the next
 * getAIClient() picks up the latest values.
 */
export function resetAIClient() {
    aiClientInstance = null;
}

export default getAIClient;
