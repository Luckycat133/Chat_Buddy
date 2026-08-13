/**
 * Domain Layer: Memory Store
 * Per-character long-term memory backed by IndexedDB.
 * Provides CRUD operations and a time-based decay mechanism.
 *
 * Memory Record schema:
 * {
 *   id: string (uuid),
 *   characterId: string,
 *   fact: string,
 *   category: 'preference' | 'fact' | 'event',
 *   importance: number (1-10),
 *   timestamp: number,
 *   lastRecalledAt: number,
 *   isForgotten: boolean
 * }
 */

const DB_NAME = 'chat-buddy-memories';
const DB_VERSION = 1;
const STORE_NAME = 'memories';

// Decay config: a memory with importance X will survive ~(X * DAYS_PER_IMPORTANCE) days
// without being recalled before it is automatically forgotten.
const DAYS_PER_IMPORTANCE = 3; // importance 1 → 3 days, 5 → 15 days, 10 → 30 days
const MIN_IMPORTANCE_TO_KEEP = 5; // facts below this are more aggressively decayed

export class MemoryStore {
    constructor() {
        this._db = null;
        this._initPromise = null;
    }

    // ─── Initialization ────────────────────────────────────────────────────────

    async init() {
        if (this._db) return this._db;
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('byCharacter', 'characterId', { unique: false });
                    store.createIndex('byCharacterAndImportance', ['characterId', 'importance'], { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };

            request.onerror = (event) => {
                console.error('[MemoryStore] Failed to open IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });

        return this._initPromise;
    }

    // ─── Write ─────────────────────────────────────────────────────────────────

    /**
     * Save a single memory fact for a character.
     * If an identical fact already exists for this character, it is skipped.
     * @param {string} characterId
     * @param {string} fact - The memory string
     * @param {number} importance - 1-10
     * @param {string} [category='fact']
     * @returns {Promise<string>} The saved record id
     */
    async saveFact(characterId, fact, importance = 5, category = 'fact') {
        try {
            const db = await this.init();
            const normalizedFact = fact.trim();
            if (!normalizedFact) return null;

            // Deduplicate: check if a very similar fact already exists
            const existing = await this.getFactsByCharacter(characterId);
            const isDuplicate = existing.some(
                (m) => this._similarity(m.fact, normalizedFact) > 0.78
            );
            if (isDuplicate) return null;

            const record = {
                id: this._uuid(),
                characterId,
                fact: normalizedFact,
                category,
                importance: Math.min(10, Math.max(1, Math.round(importance))),
                timestamp: Date.now(),
                lastRecalledAt: Date.now(),
                isForgotten: false,
            };

            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(record);
                req.onsuccess = () => resolve(record.id);
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.error('[MemoryStore] saveFact failed:', err);
            return null;
        }
    }

    // ─── Read ──────────────────────────────────────────────────────────────────

    /**
     * Get all non-forgotten facts for a character, sorted by importance then recency.
     * @param {string} characterId
     * @returns {Promise<Array>}
     */
    async getFactsByCharacter(characterId) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const index = store.index('byCharacter');
                const request = index.getAll(characterId);
                request.onsuccess = () => {
                    const all = request.result || [];
                    const active = all.filter((m) => !m.isForgotten);
                    active.sort((a, b) => b.importance - a.importance || b.lastRecalledAt - a.lastRecalledAt);
                    resolve(active);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[MemoryStore] getFactsByCharacter failed:', err);
            return [];
        }
    }

    /**
     * Get the top N most relevant (high importance + recently recalled) facts for prompt injection.
     * Also updates lastRecalledAt for returned facts to slow down their decay.
     * @param {string} characterId
     * @param {number} [limit=10]
     * @returns {Promise<Array>}
     */
    async getRelevantFacts(characterId, limit = 10) {
        try {
            const facts = await this.getFactsByCharacter(characterId);
            const top = facts.slice(0, limit);

            // Update lastRecalledAt to slow decay
            if (top.length > 0) {
                this._touchFacts(top).catch(() => { }); // fire-and-forget
            }

            return top;
        } catch (err) {
            console.error('[MemoryStore] getRelevantFacts failed:', err);
            return [];
        }
    }

    /**
     * Get ALL facts for a character (including forgotten ones) — for UI display.
     * @param {string} characterId
     * @returns {Promise<Array>}
     */
    async getAllFactsForUI(characterId) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const index = store.index('byCharacter');
                const request = index.getAll(characterId);
                request.onsuccess = () => {
                    const all = (request.result || []).filter((m) => !m.isForgotten);
                    all.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(all);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[MemoryStore] getAllFactsForUI failed:', err);
            return [];
        }
    }

    // ─── Delete ────────────────────────────────────────────────────────────────

    /**
     * Soft-delete a single memory fact (mark as forgotten).
     * @param {string} factId
     */
    async forgetFact(factId) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const getReq = store.get(factId);
                getReq.onsuccess = () => {
                    const record = getReq.result;
                    if (record) {
                        record.isForgotten = true;
                        const putReq = store.put(record);
                        putReq.onsuccess = () => resolve();
                        putReq.onerror = () => reject(putReq.error);
                    } else {
                        resolve();
                    }
                };
                getReq.onerror = () => reject(getReq.error);
            });
        } catch (err) {
            console.error('[MemoryStore] forgetFact failed:', err);
        }
    }

    /**
     * Hard-delete all memories for a character (used by "Clear all memory" button).
     * @param {string} characterId
     */
    async forgetAllFacts(characterId) {
        try {
            const facts = await this.getFactsByCharacter(characterId);
            await Promise.all(facts.map((f) => this.forgetFact(f.id)));
        } catch (err) {
            console.error('[MemoryStore] forgetAllFacts failed:', err);
        }
    }

    // ─── Decay ─────────────────────────────────────────────────────────────────

    /**
     * Apply decay: mark old, low-importance memories as forgotten.
     * Call this periodically (e.g., on app init or when context is compressed).
     */
    async applyDecay() {
        try {
            const db = await this.init();
            const now = Date.now();

            const allRecords = await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });

            const toForget = allRecords.filter((m) => {
                if (m.isForgotten) return false;
                const daysSinceRecalled = (now - m.lastRecalledAt) / (1000 * 60 * 60 * 24);
                const survivalDays = m.importance * DAYS_PER_IMPORTANCE;
                return daysSinceRecalled > survivalDays;
            });

            if (toForget.length === 0) return;

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const m of toForget) {
                m.isForgotten = true;
                store.put(m);
            }

            console.log(`[MemoryStore] Decay applied: ${toForget.length} memories forgotten.`);
        } catch (err) {
            console.error('[MemoryStore] applyDecay failed:', err);
        }
    }

    // ─── Private Helpers ───────────────────────────────────────────────────────

    async _touchFacts(facts) {
        const db = await this.init();
        const now = Date.now();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const m of facts) {
            store.put({ ...m, lastRecalledAt: now });
        }
    }

    _uuid() {
        return 'mem-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    }

    /**
     * Simple Jaccard-like similarity check to avoid duplicate facts.
     * Returns 0-1 where 1 = identical.
     */
    _similarity(a, b) {
        const normalize = (value) => String(value || '')
            .toLocaleLowerCase()
            .replace(/[\s\p{P}\p{S}]+/gu, '');
        const normalizedA = normalize(a);
        const normalizedB = normalize(b);
        if (!normalizedA || !normalizedB) return 0;
        if (normalizedA === normalizedB) return 1;
        if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
            const coverage = Math.min(normalizedA.length, normalizedB.length)
                / Math.max(normalizedA.length, normalizedB.length);
            if (coverage >= 0.7) return 0.9;
        }

        const tokenize = (value) => {
            const tokens = value.match(/[a-z0-9]+|[\p{Script=Han}]/gu) || [];
            const result = [];
            let cjkRun = '';
            const flushCjk = () => {
                if (!cjkRun) return;
                if (cjkRun.length === 1) result.push(cjkRun);
                for (let index = 0; index < cjkRun.length - 1; index += 1) {
                    result.push(cjkRun.slice(index, index + 2));
                }
                cjkRun = '';
            };
            for (const token of tokens) {
                if (/^\p{Script=Han}$/u.test(token)) cjkRun += token;
                else {
                    flushCjk();
                    result.push(token);
                }
            }
            flushCjk();
            return result;
        };

        const setA = new Set(tokenize(normalizedA));
        const setB = new Set(tokenize(normalizedB));
        const intersection = [...setA].filter((w) => setB.has(w)).length;
        const union = new Set([...setA, ...setB]).size;
        return union === 0 ? 0 : intersection / union;
    }
}

export const memoryStore = new MemoryStore();
