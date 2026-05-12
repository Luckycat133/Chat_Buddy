/**
 * Infrastructure Layer: Storage Service
 * Encapsulates all interactions with the browser's LocalStorage.
 * Future-proofs the app for migration to IndexedDB or other storage engines.
 */
class StorageService {
    constructor(storage = window.localStorage) {
        this.storage = storage;
        this.prefix = 'chat-buddy:'; // Namespace for safety
    }

    /**
     * Get a value from storage
     * @param {string} key - The key to retrieve
     * @param {*} defaultValue - Value to return if key doesn't exist
     * @returns {*} The parsed value or defaultValue
     */
    get(key, defaultValue = null) {
        try {
            const fullKey = this._getKey(key);
            const item = this.storage.getItem(fullKey);

            // Handle un-prefixed legacy keys (migration path)
            if (item === null) {
                const legacyMx = this.storage.getItem(key);
                if (legacyMx !== null) {
                    try {
                        return JSON.parse(legacyMx);
                    } catch (parseError) {
                        console.warn(`[StorageService] Failed to parse legacy key "${key}":`, parseError);
                    }
                }
            }

            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`[StorageService] Error getting key "${key}":`, error);
            return defaultValue;
        }
    }

    /**
     * Save a value to storage
     * @param {string} key - The key to store
     * @param {*} value - The value to store
     */
    set(key, value) {
        try {
            const fullKey = this._getKey(key);
            this.storage.setItem(fullKey, JSON.stringify(value));
        } catch (error) {
            console.error(`[StorageService] Error setting key "${key}":`, error);
        }
    }

    /**
     * Remove a value from storage
     * @param {string} key 
     */
    remove(key) {
        try {
            this.storage.removeItem(this._getKey(key));
            // Also try removing legacy key just in case
            this.storage.removeItem(key);
        } catch (error) {
            console.error(`[StorageService] Error removing key "${key}":`, error);
        }
    }

    /**
     * Clear all app-specific keys
     */
    clear() {
        try {
            // Only clear app keys to be safe citizens
            Object.keys(this.storage).forEach(k => {
                if (k.startsWith(this.prefix) || k.startsWith('chat-buddy-')) {
                    this.storage.removeItem(k);
                }
            });
            // Explicitly clear known legacy canonical key.
            this.storage.removeItem('chat-buddy-chats');
        } catch (error) {
            console.error('[StorageService] Error clearing storage:', error);
        }
    }

    _getKey(key) {
        // If key already has prefix (legacy refactoring safety), don't double add
        if (key.startsWith(this.prefix)) return key;

        // For the 'chat-buddy-chats' legacy key specifically, we might want to keep using it as is 
        // to avoid migration scripts for this specific refactor step?
        // Let's adopt a strategy: Check strict equality for known legacy keys.
        const legacyKeys = ['chat-buddy-chats'];
        if (legacyKeys.includes(key)) return key;

        return `${this.prefix}${key}`;
    }
}

export const storage = new StorageService();
