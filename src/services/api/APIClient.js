/**
 * Infrastructure Layer: API Client
 * Centralized HTTP request handling with retry logic, timeouts, and error normalization.
 * Designed to replace ad-hoc fetch calls in ChatService and PerplexityService.
 */
class APIClient {
    /**
     * @param {Object} config
     * @param {string} config.baseURL - Base URL for all requests
     * @param {Object} config.headers - Default headers
     * @param {number} config.timeout - Timeout in ms (default 30000)
     * @param {number} config.maxRetries - Default retry count (default 0)
     */
    constructor(config = {}) {
        this.baseURL = config.baseURL || '';
        this.headers = config.headers || {
            'Content-Type': 'application/json'
        };
        this.timeout = config.timeout || 30000;
        this.maxRetries = config.maxRetries || 0;
    }

    /**
     * Set the Authorization header token
     * @param {string} token 
     */
    setAuthToken(token) {
        if (token) {
            this.headers['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.headers['Authorization'];
        }
    }

    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    async post(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
    }

    async put(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * Core request method
     */
    async request(endpoint, options = {}) {
        const url = this._buildUrl(endpoint);
        const config = {
            method: options.method || 'GET',
            headers: { ...this.headers, ...options.headers },
            body: options.body,
            signal: options.signal // Allow external abort controller
        };

        const retries = options.retries ?? this.maxRetries;

        return this._fetchWithRetry(url, config, retries);
    }

    _buildUrl(endpoint) {
        if (endpoint.startsWith('http')) return endpoint;

        const base = (this.baseURL || '').trim();
        if (!base) return endpoint;

        const normalizedBase = base.replace(/\/+$/, '');
        const normalizedEndpoint = endpoint
            ? `/${String(endpoint).replace(/^\/+/, '')}`
            : '';

        // If base URL already points to the completions endpoint,
        // avoid appending it twice.
        if (/\/chat\/completions$/i.test(normalizedBase) && normalizedEndpoint === '/chat/completions') {
            return normalizedBase;
        }

        return `${normalizedBase}${normalizedEndpoint}`;
    }

    async _fetchWithRetry(url, config, retriesLeft) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        let abortListener = null;

        // Merge signals if provided
        if (config.signal) {
            abortListener = () => controller.abort();
            config.signal.addEventListener('abort', abortListener, { once: true });
        }

        const cleanup = () => {
            clearTimeout(timeoutId);
            if (config.signal && abortListener) {
                config.signal.removeEventListener('abort', abortListener);
            }
        };

        try {
            const response = await fetch(url, { ...config, signal: controller.signal });

            // Handle 429 Rate Limiting with Backoff
            if (response.status === 429 && retriesLeft > 0) {
                cleanup();
                const waitTime = 1000 * (this.maxRetries - retriesLeft + 1) + Math.random() * 500;
                console.warn(`[APIClient] Rate limited, retrying in ${waitTime}ms...`);
                await new Promise(r => setTimeout(r, waitTime));
                return this._fetchWithRetry(url, config, retriesLeft - 1);
            }

            // Normal retry for 5xx errors
            if (!response.ok && response.status >= 500 && retriesLeft > 0) {
                cleanup();
                console.warn(`[APIClient] Server error ${response.status}, retrying...`);
                await new Promise(r => setTimeout(r, 1000));
                return this._fetchWithRetry(url, config, retriesLeft - 1);
            }

            // Return raw response for caller to handle JSON parsing and specific status codes
            // or we could normalize error here. Let's return response object but handle basic network errors.
            return response;

        } catch (error) {
            if (retriesLeft > 0 && error.name !== 'AbortError') {
                cleanup();
                console.warn(`[APIClient] Network error: ${error.message}, retrying...`);
                await new Promise(r => setTimeout(r, 1000));
                return this._fetchWithRetry(url, config, retriesLeft - 1);
            }
            throw error;
        } finally {
            cleanup();
        }
    }
}

// Export a default instance if needed, or just the class
export default APIClient;
