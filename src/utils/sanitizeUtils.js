import DOMPurify from 'dompurify';

const HTML_ENTITY_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
};

const HTML_ENTITY_RE = /[&<>"']/g;

export function sanitizeHTML(input) {
    if (typeof input !== 'string') return '';
    return input.replace(HTML_ENTITY_RE, (ch) => HTML_ENTITY_MAP[ch] || ch);
}

const PROTOCOL_RE = /^(https?:\/\/|mailto:|tel:|#|\/)/i;

export function isSafeURL(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    return PROTOCOL_RE.test(trimmed);
}

const JS_PROTOCOL_RE = /^(\s*)javascript:/im;

export function sanitizeURL(url) {
    if (typeof url !== 'string') return '';
    if (JS_PROTOCOL_RE.test(url)) return '';
    return url;
}

const CONTROL_CHAR_RE = /[\u0000-\u001F]/g; // eslint-disable-line no-control-regex

export function sanitizeFileName(name) {
    if (typeof name !== 'string') return '';
    return name
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(CONTROL_CHAR_RE, '_')
        .replace(/\.\./g, '')
        .replace(/^\.+/, '')
        .slice(0, 255);
}

export function stripDangerousHTML(html) {
    if (typeof html !== 'string') return '';
    return DOMPurify.sanitize(html, {
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'link', 'meta', 'base'],
        FORBID_ATTR: ['style'],
        ALLOW_DATA_ATTR: false,
    });
}

const SAFE_IMAGE_DATA_RE = /^data:image\/(?:avif|gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;

export function sanitizeImageURL(value) {
    if (typeof value !== 'string') return '';
    const normalized = value.trim();
    if (!normalized) return '';
    if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized;
    if (normalized.startsWith('blob:')) return normalized;
    if (SAFE_IMAGE_DATA_RE.test(normalized)) return normalized;

    try {
        const parsed = new URL(normalized);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch {
        return '';
    }
}

export function sanitizeObjectStrings(obj, maxDepth = 5) {
    if (maxDepth <= 0) return obj;
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeHTML(obj);
    if (Array.isArray(obj)) return obj.map(item => sanitizeObjectStrings(item, maxDepth - 1));
    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[sanitizeHTML(key)] = sanitizeObjectStrings(value, maxDepth - 1);
        }
        return result;
    }
    return obj;
}
