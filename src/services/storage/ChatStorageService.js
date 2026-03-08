/**
 * ChatStorageService
 * Primary chat persistence in IndexedDB with localStorage compatibility fallback.
 */

const DB_NAME = 'chat-buddy-main';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const CHATS_KEY = 'chat-buddy-chats';

class ChatStorageService {
    constructor() {
        this._db = null;
        this._initPromise = null;
    }

    async init() {
        if (typeof window === 'undefined' || !window.indexedDB) return null;
        if (this._db) return this._db;
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };

            req.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };

            req.onerror = () => reject(req.error);
        });

        return this._initPromise;
    }

    async get(key) {
        const db = await this.init();
        if (!db) return null;

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result?.value ?? null);
            req.onerror = () => reject(req.error);
        });
    }

    async set(key, value) {
        const db = await this.init();
        if (!db) return;

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put({ key, value, updatedAt: Date.now() });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async loadChats() {
        try {
            const value = await this.get(CHATS_KEY);
            return Array.isArray(value) ? value : null;
        } catch {
            return null;
        }
    }

    async saveChats(chats) {
        try {
            await this.set(CHATS_KEY, chats);
        } catch {
            // Non-fatal: localStorage mirror still exists.
        }
    }

    async migrateFromLocalStorage(candidateKeys = [CHATS_KEY, `chat-buddy:${CHATS_KEY}`]) {
        try {
            const current = await this.loadChats();
            if (Array.isArray(current)) return;

            for (const key of candidateKeys) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        await this.saveChats(parsed);
                        return;
                    }
                } catch {
                    // Ignore malformed legacy values.
                }
            }
        } catch {
            // Non-fatal migration.
        }
    }
}

export default new ChatStorageService();
