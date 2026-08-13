/**
 * AI API Client Instance
 * Pre-configured APIClient for all AI services.
 * Reads configuration from the unified apiConfig system.
 */
import APIClient from './APIClient';
import { getConfig } from '../../config/apiConfig';
import { normalizeBaseUrlForDevProxy } from '../../utils/apiUtils';

// ========== Singleton ==========

let aiClientInstance = null;
let aiClientConfigSignature = null;

/**
 * Get or create the AI API client instance.
 * Config priority: localStorage runtime > .env build-time > defaults
 */
export function getAIClient() {
    const config = getConfig();
    const configSignature = JSON.stringify({
        baseUrl: config.baseUrl || '',
        apiKey: config.apiKey || '',
        timeout: config.timeout || 60000,
        maxRetries: 0,
    });

    if (!aiClientInstance || aiClientConfigSignature !== configSignature) {
        const normalizedBaseUrl = normalizeBaseUrlForDevProxy(config.baseUrl);

        aiClientInstance = new APIClient({
            baseURL: normalizedBaseUrl,
            timeout: config.timeout || 60000,
            maxRetries: 0,
            headers: { 'Content-Type': 'application/json' }
        });

        if (config.apiKey) {
            aiClientInstance.setAuthToken(config.apiKey);
        }
        aiClientConfigSignature = configSignature;
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
    aiClientConfigSignature = null;
}

export default getAIClient;
