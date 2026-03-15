/**
 * API Utility Functions
 * Shared utilities for API configuration and proxy handling.
 */

/**
 * Normalize a base URL for Vite dev proxy support.
 * Rewrites known API origins to their proxy paths in development mode.
 *
 * @param {string} baseUrl - The base URL to normalize
 * @returns {string} Normalized URL (proxy path in dev, original URL otherwise)
 */
export function normalizeBaseUrlForDevProxy(baseUrl) {
    const raw = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!raw) return '';

    // Only rewrite in local dev. Production should use the configured URL as-is.
    if (!import.meta.env.DEV || typeof window === 'undefined') return raw;

    try {
        const url = new URL(raw, window.location.origin);
        const path = url.pathname === '/' ? '' : url.pathname;

        if (url.origin === 'https://maas-api.cn-huabei-1.xf-yun.com') {
            return `/proxy/xfyun${path}`;
        }

        if (url.origin === 'https://api.perplexity.ai') {
            return `/proxy/perplexity${path}`;
        }
    } catch {
        // Keep original value for relative URLs or invalid input.
    }

    return raw;
}