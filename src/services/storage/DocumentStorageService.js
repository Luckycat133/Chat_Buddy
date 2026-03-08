/**
 * DocumentStorageService
 * Stores document metadata and RAG index in IndexedDB.
 */

const DB_NAME = 'chat-buddy-main';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

const DOCS_KEY = 'chat-buddy-documents';
const INDEX_KEY = 'chat-buddy-rag-index';

class DocumentStorageService {
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

    async loadDocuments() {
        try {
            const value = await this.get(DOCS_KEY);
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    async saveDocuments(documents) {
        try {
            await this.set(DOCS_KEY, documents);
        } catch {
            // non-fatal
        }
    }

    async loadIndex() {
        try {
            const value = await this.get(INDEX_KEY);
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    async saveIndex(indexedChunks) {
        try {
            await this.set(INDEX_KEY, indexedChunks);
        } catch {
            // non-fatal
        }
    }

    async migrateFromLocalStorage() {
        try {
            const docs = await this.loadDocuments();
            if (docs.length === 0) {
                const rawDocs = localStorage.getItem(DOCS_KEY);
                if (rawDocs) {
                    try {
                        const parsed = JSON.parse(rawDocs);
                        if (Array.isArray(parsed)) {
                            await this.saveDocuments(parsed);
                        }
                    } catch {
                        // ignore
                    }
                }
            }

            const index = await this.loadIndex();
            if (index.length === 0) {
                const rawIndex = localStorage.getItem(INDEX_KEY);
                if (rawIndex) {
                    try {
                        const parsed = JSON.parse(rawIndex);
                        if (Array.isArray(parsed)) {
                            await this.saveIndex(parsed);
                        }
                    } catch {
                        // ignore
                    }
                }
            }
        } catch {
            // non-fatal
        }
    }
}

export default new DocumentStorageService();
