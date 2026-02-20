/**
 * Infrastructure Layer: Image Storage Service
 * Stores large image data (base64) in IndexedDB to avoid localStorage size limits.
 * Provides migration path from legacy localStorage base64 storage.
 */
import { storage } from './StorageService.js';

const DB_NAME = 'chat-buddy-images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

class ImageStorageService {
    constructor() {
        this._db = null;
        this._initPromise = null;
    }

    async init() {
        if (this._db) return this._db;
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };

            request.onerror = (event) => {
                console.error('[ImageStorageService] Failed to open IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });

        return this._initPromise;
    }

    async saveImage(id, base64) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const request = store.put({ id, data: base64, savedAt: Date.now() });
                request.onsuccess = () => resolve(id);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[ImageStorageService] saveImage failed:', err);
            throw err;
        }
    }

    async getImage(id) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result?.data || null);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[ImageStorageService] getImage failed:', err);
            return null;
        }
    }

    async deleteImage(id) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[ImageStorageService] deleteImage failed:', err);
        }
    }

    /**
     * One-time migration: moves base64 images from localStorage into IndexedDB.
     * Checks globalTheme and chatBackgrounds for custom type entries.
     */
    async migrateFromLocalStorage() {
        try {
            const migrationKey = 'chat-buddy:bg-idb-migrated';
            if (localStorage.getItem(migrationKey)) return;

            const globalTheme = storage.get('background:global-theme');
            const chatBackgrounds = storage.get('background:chat-backgrounds', {});

            const genId = () => `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

            const migrate = async (config) => {
                if (!config || config.type !== 'custom' || !config.value) return config;
                if (config.value.startsWith('data:')) {
                    const id = genId();
                    await this.saveImage(id, config.value);
                    return { ...config, value: id };
                }
                return config;
            };

            if (globalTheme) {
                const migrated = await migrate(globalTheme);
                if (migrated !== globalTheme) storage.set('background:global-theme', migrated);
            }

            const migratedChats = {};
            let chatChanged = false;
            for (const [chatId, cfg] of Object.entries(chatBackgrounds)) {
                const migrated = await migrate(cfg);
                migratedChats[chatId] = migrated;
                if (migrated !== cfg) chatChanged = true;
            }
            if (chatChanged) storage.set('background:chat-backgrounds', migratedChats);

            localStorage.setItem(migrationKey, '1');
        } catch (err) {
            console.warn('[ImageStorageService] Migration error (non-fatal):', err);
        }
    }
}

export default new ImageStorageService();
