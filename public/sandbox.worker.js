/* eslint-env worker */
/**
 * T13: Sandbox Web Worker
 * Provides isolated code execution for JavaScript and Python (via Pyodide).
 * - Runs outside the main thread — UI never blocks
 * - Captures console.log / print output
 * - Enforces 10-second timeout via main-thread kill
 * - Python support is lazy-loaded on first use
 */

/* global loadPyodide */

let pyodide = null;
let pyodideLoading = false;
let pyodideReady = false;

// ─── Pyodide lazy loader ────────────────────────────────────────────────────
async function ensurePyodide() {
    if (pyodideReady) return true;
    if (pyodideLoading) {
        // Wait until ready
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
        throw new Error('Failed to load Python environment: ' + e.message);
    }
}

// ─── JavaScript execution ───────────────────────────────────────────────────
function runJavaScript(code) {
    const logs = [];
    const mockConsole = {
        log:   (...a) => logs.push(a.map(String).join(' ')),
        error: (...a) => logs.push('ERROR: ' + a.map(String).join(' ')),
        warn:  (...a) => logs.push('WARN: '  + a.map(String).join(' ')),
        info:  (...a) => logs.push('INFO: '  + a.map(String).join(' ')),
    };

    try {
        // Wrap in a function so `return` works at top level
        const fn = new Function('console', code);
        const result = fn(mockConsole);
        const output = logs.length > 0
            ? logs.join('\n')
            : (result !== undefined ? String(result) : '(No output)');
        return { status: 'success', output };
    } catch (e) {
        return { status: 'error', output: `${e.name}: ${e.message}` };
    }
}

// ─── Python execution ───────────────────────────────────────────────────────
async function runPython(code) {
    await ensurePyodide();

    // Redirect stdout/stderr
    const captured = [];
    pyodide.runPython(`
import sys, io
_stdout_buf = io.StringIO()
_stderr_buf = io.StringIO()
sys.stdout = _stdout_buf
sys.stderr = _stderr_buf
`);

    try {
        await pyodide.runPythonAsync(code);
    } catch (e) {
        // Restore streams even on error
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

// ─── Message handler ────────────────────────────────────────────────────────
self.onmessage = async (event) => {
    const { type, language, code, requestId } = event.data;

    if (type !== 'EXECUTE') return;

    try {
        let result;
        if (language === 'python') {
            result = await runPython(code);
        } else {
            result = runJavaScript(code);
        }
        self.postMessage({ type: 'RESULT', requestId, ...result });
    } catch (e) {
        self.postMessage({ type: 'RESULT', requestId, status: 'error', output: e.message });
    }
};
