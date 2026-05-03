const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let _minLevel = LOG_LEVELS[import.meta.env?.VITE_LOG_LEVEL ?? 'warn'] ?? LOG_LEVELS.warn;
let _listeners = [];

function _ts() {
    return new Date().toISOString();
}

function _emit(level, context, message, data) {
    if (LOG_LEVELS[level] < _minLevel) return;
    const entry = { ts: _ts(), level, context, message, data: data ?? null };
    for (const fn of _listeners) {
        try { fn(entry); } catch (_err) { console.error('[Logger] Listener error:', _err); }
    }
    const prefix = `[${entry.ts}][${level.toUpperCase()}][${context}]`;
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (data !== undefined) logFn(prefix, message, data);
    else logFn(prefix, message);
}

export function createLogger(context) {
    return {
        debug: (msg, data) => _emit('debug', context, msg, data),
        info: (msg, data) => _emit('info', context, msg, data),
        warn: (msg, data) => _emit('warn', context, msg, data),
        error: (msg, data) => _emit('error', context, msg, data),
    };
}

export function setLogLevel(level) {
    _minLevel = LOG_LEVELS[level] ?? LOG_LEVELS.warn;
}

export function addLogListener(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
}

export class AppError extends Error {
    constructor(code, message, { cause, context, recoverable = false } = {}) {
        super(message, { cause });
        this.name = 'AppError';
        this.code = code;
        this.context = context;
        this.recoverable = recoverable;
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            context: this.context,
            recoverable: this.recoverable,
        };
    }
}

export function wrapAsync(fn, { context = 'unknown', code = 'UNHANDLED_ERROR', fallback = null } = {}) {
    const log = createLogger(context);
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (err) {
            if (err instanceof AppError) {
                log.error(err.message, err.toJSON());
            } else {
                log.error(err?.message || String(err), { code, stack: err?.stack });
            }
            return fallback;
        }
    };
}

export function safeExec(fn, { context = 'safeExec', code = 'SAFE_EXEC_FAIL', fallback = null } = {}) {
    const log = createLogger(context);
    try {
        return fn();
    } catch (err) {
        log.warn(err?.message || String(err), { code });
        return fallback;
    }
}

export function safeExecAsync(fn, { context = 'safeExecAsync', code = 'SAFE_EXEC_ASYNC_FAIL', fallback = null } = {}) {
    const log = createLogger(context);
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (err) {
            log.warn(err?.message || String(err), { code });
            return fallback;
        }
    };
}
