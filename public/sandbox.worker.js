/* global loadPyodide */

let pyodide = null;
let pyodideLoading = false;
let pyodideReady = false;

const MAX_CODE_SIZE = 64 * 1024;
const JS_TIMEOUT_MS = 10000;
const PY_TIMEOUT_MS = 30000;

const BLOCKED_GLOBALS = [
    'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker',
    'ServiceWorker', 'importScripts', 'eval', 'Function',
    'indexedDB', 'caches', 'navigator', 'location',
    'localStorage', 'sessionStorage',
    'EventSource', 'BroadcastChannel', 'MessageChannel',
    'IDBFactory', 'IDBDatabase',
];

function checkCodeSize(code) {
    if (typeof code !== 'string') throw new Error('Code must be a string');
    if (code.length > MAX_CODE_SIZE) throw new Error('Code exceeds maximum size limit (' + MAX_CODE_SIZE + ' chars)');
}

async function ensurePyodide() {
    if (pyodideReady) return true;
    if (pyodideLoading) {
        await new Promise(resolve => {
            const interval = setInterval(() => {
                if (pyodideReady) { clearInterval(interval); resolve(); }
            }, 200);
        });
        return true;
    }

    pyodideLoading = true;
    self.postMessage({ type: 'STATUS', message: 'Loading Python environment (first run)…' });

    try {
        importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js');
        pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/' });
        pyodideReady = true;
        self.postMessage({ type: 'STATUS', message: 'Python environment ready.' });
        return true;
    } catch (e) {
        pyodideLoading = false;
        throw new Error('Failed to load Python environment: ' + e.message, { cause: e });
    }
}

function runJavaScript(code) {
    checkCodeSize(code);
    const logs = [];
    const mockConsole = {
        log:   (...a) => logs.push(a.map(String).join(' ')),
        error: (...a) => logs.push('ERROR: ' + a.map(String).join(' ')),
        warn:  (...a) => logs.push('WARN: '  + a.map(String).join(' ')),
        info:  (...a) => logs.push('INFO: '  + a.map(String).join(' ')),
    };

    const sandbox = {};
    for (const key of BLOCKED_GLOBALS) {
        Object.defineProperty(sandbox, key, {
            get: () => { throw new Error('Access to "' + key + '" is blocked in sandbox'); },
            set: () => { throw new Error('Cannot override "' + key + '" in sandbox'); },
            configurable: false,
            enumerable: false,
        });
    }

    try {
        const fn = new Function('console', 'globalThis', 'self', 'window', 'global', code);
        const result = fn(mockConsole, sandbox, sandbox, sandbox, sandbox);
        const output = logs.length > 0
            ? logs.join('\n')
            : (result !== undefined ? String(result) : '(No output)');
        return { status: 'success', output };
    } catch (e) {
        return { status: 'error', output: `${e.name}: ${e.message}` };
    }
}

function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Execution timed out after ' + ms + 'ms')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runPython(code) {
    checkCodeSize(code);
    await ensurePyodide();

    const captured = [];
    pyodide.runPython(`
import sys, io
_stdout_buf = io.StringIO()
_stderr_buf = io.StringIO()
sys.stdout = _stdout_buf
sys.stderr = _stderr_buf
`);

    try {
        await withTimeout(pyodide.runPythonAsync(code), PY_TIMEOUT_MS);
    } catch (e) {
        const stderr = pyodide.runPython('sys.stderr.getvalue()') || '';
        pyodide.runPython('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__');
        return { status: 'error', output: (stderr || e.message).trim() };
    }

    const stdout = pyodide.runPython('_stdout_buf.getvalue()') || '';
    const stderr = pyodide.runPython('_stderr_buf.getvalue()') || '';
    pyodide.runPython('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__');

    captured.push(stdout);
    if (stderr) captured.push('STDERR: ' + stderr);

    return { status: 'success', output: captured.join('').trim() || '(No output)' };
}

self.onmessage = async (event) => {
    const { type, language, code, requestId } = event.data;

    if (type !== 'EXECUTE') return;

    try {
        let result;
        if (language === 'python') {
            result = await withTimeout(runPython(code), PY_TIMEOUT_MS + 5000);
        } else {
            result = runJavaScript(code);
        }
        self.postMessage({ type: 'RESULT', requestId, ...result });
    } catch (e) {
        self.postMessage({ type: 'RESULT', requestId, status: 'error', output: e.message });
    }
};
