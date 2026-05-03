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

const OPEN_DANGEROUS_RE = /<\s*(script|iframe|object|embed|form|input|textarea|select|button|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SELF_CLOSE_DANGEROUS_RE = /<\s*(script|iframe|object|embed|form|input|textarea|select|button|link|meta|base)[^>]*\/\s*>/gi;
const STRAY_CLOSE_RE = /<\s*\/\s*(script|iframe|object|embed|form|input|textarea|select|button|link|meta|base)\s*>/gi;

export function stripDangerousHTML(html) {
    if (typeof html !== 'string') return '';
    return html
        .replace(OPEN_DANGEROUS_RE, '')
        .replace(SELF_CLOSE_DANGEROUS_RE, '')
        .replace(STRAY_CLOSE_RE, '');
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
