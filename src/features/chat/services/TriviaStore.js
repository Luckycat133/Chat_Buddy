/**
 * TriviaStore.js
 * Persistent storage for Trivia Quiz results using IndexedDB.
 * Falls back to localStorage if IndexedDB is unavailable.
 */

const DB_NAME = 'chat-buddy-trivia';
const DB_VERSION = 1;
const STORE_NAME = 'quiz_history';

// ─── IndexedDB helpers ─────────────────────────────────────────────────────

let _db = null;

function openDB() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB not supported'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('chatId', 'chatId', { unique: false });
                store.createIndex('personaId', 'personaId', { unique: false });
                store.createIndex('generatedAt', 'generatedAt', { unique: false });
            }
        };

        request.onsuccess = (e) => {
            _db = e.target.result;
            resolve(_db);
        };

        request.onerror = (e) => {
            reject(e.target.error);
        };
    });
}

function generateId() {
    return `trivia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── localStorage fallback ─────────────────────────────────────────────────

const LS_KEY = 'chat-buddy-trivia-fallback';

function lsGetAll() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
        return [];
    }
}

function lsSave(records) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(records));
    } catch {
        // storage quota exceeded — silently ignore
    }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Save a completed quiz result.
 * @param {object} quiz - { chatId, personaId, score, total, questions }
 * @returns {Promise<string>} - The saved quiz id
 */
export async function saveQuizResult(quiz) {
    const record = {
        id: generateId(),
        chatId: quiz.chatId,
        personaId: quiz.personaId,
        generatedAt: Date.now(),
        score: quiz.score,
        total: quiz.total ?? 5,
        questions: quiz.questions || [],
    };

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.add(record);
            req.onsuccess = () => resolve(record.id);
            req.onerror = (e) => reject(e.target.error);
        });
    } catch {
        // Fallback: localStorage
        const all = lsGetAll();
        all.push(record);
        // Keep only last 50 results per character to avoid bloat
        lsSave(all.slice(-50));
        return record.id;
    }
}

/**
 * Get all quiz history for a specific persona.
 * @param {string} personaId
 * @returns {Promise<Array>} - Sorted by generatedAt desc
 */
export async function getHistoryByCharacter(personaId) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('personaId');
            const req = index.getAll(personaId);
            req.onsuccess = () => {
                const results = (req.result || []).sort((a, b) => b.generatedAt - a.generatedAt);
                resolve(results);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    } catch {
        // Fallback
        const all = lsGetAll().filter(r => r.personaId === personaId);
        return all.sort((a, b) => b.generatedAt - a.generatedAt);
    }
}

/**
 * Get all quiz history for a specific chat.
 * @param {string} chatId
 * @returns {Promise<Array>}
 */
export async function getHistoryByChat(chatId) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('chatId');
            const req = index.getAll(chatId);
            req.onsuccess = () => {
                const results = (req.result || []).sort((a, b) => b.generatedAt - a.generatedAt);
                resolve(results);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    } catch {
        const all = lsGetAll().filter(r => r.chatId === chatId);
        return all.sort((a, b) => b.generatedAt - a.generatedAt);
    }
}

/**
 * Clear all quiz history (for a specific persona, or all if omitted).
 * @param {string|null} personaId
 */
export async function clearHistory(personaId = null) {
    try {
        const db = await openDB();
        if (!personaId) {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = (e) => reject(e.target.error);
            });
        }

        const records = await getHistoryByCharacter(personaId);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            let pending = records.length;
            if (pending === 0) { resolve(); return; }
            records.forEach(r => {
                const req = store.delete(r.id);
                req.onsuccess = () => { pending--; if (pending === 0) resolve(); };
                req.onerror = (e) => reject(e.target.error);
            });
        });
    } catch {
        if (!personaId) {
            lsSave([]);
        } else {
            const all = lsGetAll().filter(r => r.personaId !== personaId);
            lsSave(all);
        }
    }
}
