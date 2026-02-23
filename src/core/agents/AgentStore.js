/**
 * Domain Layer: Agent Store
 * Persists user-defined custom agents in IndexedDB.
 * Complements the built-in taskAgents.js definitions.
 *
 * Custom Agent schema:
 * {
 *   id: string (e.g. 'custom-agent-xxx'),
 *   name: string,
 *   name_zh: string,
 *   avatar: string (url or base64),
 *   personality: string,
 *   style: string,
 *   systemPrompt: string,
 *   skills: string[],
 *   color: string,
 *   agentType: 'task-specialist',
 *   category: 'custom',
 *   isCustom: true,
 *   createdAt: number,
 *   updatedAt: number
 * }
 */

const DB_NAME = 'chat-buddy-agents';
const DB_VERSION = 1;
const STORE_NAME = 'custom-agents';

class AgentStore {
    constructor() {
        this._db = null;
        this._initPromise = null;
    }

    // ─── Init ──────────────────────────────────────────────────────────────────

    async init() {
        if (this._db) return this._db;
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('byCreatedAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };

            request.onerror = (event) => {
                console.error('[AgentStore] Failed to open IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });

        return this._initPromise;
    }

    // ─── Write ─────────────────────────────────────────────────────────────────

    /**
     * Save (create or update) a custom agent.
     * If agent.id exists, it performs an update; otherwise creates with a fresh id.
     * @param {Object} agentData
     * @returns {Promise<string>} The saved agent id
     */
    async saveAgent(agentData) {
        const db = await this.init();
        const now = Date.now();

        const record = {
            // Defaults for required fields
            agentType: 'task-specialist',
            category: 'custom',
            responseDelay: { min: 2000, max: 4000 },
            readDelay: { min: 1000, max: 2000 },
            typingSpeed: 'normal',
            toolsEnabled: false,
            tools: [],
            skills: [],
            ...agentData,
            // Always stamp timestamps
            updatedAt: now,
            createdAt: agentData.createdAt || now,
            // Always mark custom
            isCustom: true,
        };

        // Auto-generate id if new
        if (!record.id) {
            record.id = 'custom-agent-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(record);
            req.onsuccess = () => resolve(record.id);
            req.onerror = () => reject(req.error);
        });
    }

    // ─── Read ──────────────────────────────────────────────────────────────────

    /**
     * Get all custom agents, sorted by creation date (newest first).
     * @returns {Promise<Array>}
     */
    async getAllAgents() {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => {
                    const agents = (req.result || []).sort((a, b) => b.createdAt - a.createdAt);
                    resolve(agents);
                };
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.error('[AgentStore] getAllAgents failed:', err);
            return [];
        }
    }

    /**
     * Get a single custom agent by id.
     * @param {string} agentId
     * @returns {Promise<Object|null>}
     */
    async getAgentById(agentId) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(agentId);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.error('[AgentStore] getAgentById failed:', err);
            return null;
        }
    }

    // ─── Delete ────────────────────────────────────────────────────────────────

    /**
     * Permanently delete a custom agent by id.
     * @param {string} agentId
     * @returns {Promise<void>}
     */
    async deleteAgent(agentId) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(agentId);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.error('[AgentStore] deleteAgent failed:', err);
        }
    }
}

export const agentStore = new AgentStore();
