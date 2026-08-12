/**
 * T02 — Unified API Configuration System
 *
 * Priority: session apiKey + local runtime config > .env (build-time) > defaults
 * Supports multiple saved provider profiles.
 */
import { storage } from '../services/storage/StorageService';
import APIClient from '../services/api/APIClient';
import { normalizeBaseUrlForDevProxy } from '../utils/apiUtils';

const CONFIG_KEY = 'api-config';
const PROFILES_KEY = 'api-profiles';
const LOCAL_STORAGE_PREFIX = 'chat-buddy';
const SESSION_API_KEY_KEY = `${LOCAL_STORAGE_PREFIX}:session-api-key`;
const BLOCK_ENV_API_KEY_SENTINEL = '__CHAT_BUDDY_BLOCK_ENV_API_KEY__';
const CURRENT_BACKUP_VERSION = 2;
const MAX_BACKUP_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_BACKUP_RECORDS_PER_STORE = 100000;

const INDEXED_DB_SCHEMAS = [
    {
        dbName: 'chat-buddy-main',
        version: 1,
        storeName: 'kv',
        ensureSchema: (db) => {
            if (!db.objectStoreNames.contains('kv')) {
                db.createObjectStore('kv', { keyPath: 'key' });
            }
        }
    },
    {
        dbName: 'chat-buddy-images',
        version: 1,
        storeName: 'images',
        ensureSchema: (db) => {
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images', { keyPath: 'id' });
            }
        }
    },
    {
        dbName: 'chat-buddy-memories',
        version: 1,
        storeName: 'memories',
        ensureSchema: (db) => {
            if (!db.objectStoreNames.contains('memories')) {
                const store = db.createObjectStore('memories', { keyPath: 'id' });
                store.createIndex('byCharacter', 'characterId', { unique: false });
                store.createIndex('byCharacterAndImportance', ['characterId', 'importance'], { unique: false });
            }
        }
    },
    {
        dbName: 'chat-buddy-agents',
        version: 1,
        storeName: 'custom-agents',
        ensureSchema: (db) => {
            if (!db.objectStoreNames.contains('custom-agents')) {
                const store = db.createObjectStore('custom-agents', { keyPath: 'id' });
                store.createIndex('byCreatedAt', 'createdAt', { unique: false });
            }
        }
    },
    {
        dbName: 'chat-buddy-trivia',
        version: 1,
        storeName: 'quiz_history',
        ensureSchema: (db) => {
            if (!db.objectStoreNames.contains('quiz_history')) {
                const store = db.createObjectStore('quiz_history', { keyPath: 'id' });
                store.createIndex('chatId', 'chatId', { unique: false });
                store.createIndex('personaId', 'personaId', { unique: false });
                store.createIndex('generatedAt', 'generatedAt', { unique: false });
            }
        }
    }
];

/** Sensible defaults — chat works out-of-the-box with just URL + key + model */
const DEFAULT_CONFIG = {
    baseUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.8,
    maxTokens: null,      // null = let provider decide
    timeout: 60000,       // 60 s
    maxRetries: 3,
};

let sessionApiKeyCache = null;

function getSessionStorage() {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
}

function setSessionApiKey(apiKey, { blockEnv = false } = {}) {
    const value = typeof apiKey === 'string' ? apiKey : '';
    const storedValue = value || (blockEnv ? BLOCK_ENV_API_KEY_SENTINEL : '');
    sessionApiKeyCache = storedValue;

    try {
        const sessionStorage = getSessionStorage();
        if (!sessionStorage) return;

        if (storedValue) sessionStorage.setItem(SESSION_API_KEY_KEY, storedValue);
        else sessionStorage.removeItem(SESSION_API_KEY_KEY);
    } catch (e) {
        console.warn('[apiConfig] sessionStorage write failed (best-effort):', e?.message);
    }
}

function getSessionApiKey() {
    if (sessionApiKeyCache !== null) return sessionApiKeyCache;

    try {
        const sessionStorage = getSessionStorage();
        sessionApiKeyCache = sessionStorage?.getItem(SESSION_API_KEY_KEY) || '';
        return sessionApiKeyCache;
    } catch (e) {
        console.warn('[apiConfig] sessionStorage read failed:', e?.message);
        sessionApiKeyCache = '';
        return sessionApiKeyCache;
    }
}

function stripApiKey(config = {}) {
    if (!config || typeof config !== 'object') return null;
    const { apiKey: _apiKey, ...rest } = config;
    return rest;
}

// ─── Config read ────────────────────────────────────────────

/** Build-time env vars (read-only, set by .env / Vite) */
function getEnvConfig() {
    return {
        baseUrl: import.meta.env.VITE_AI_API_URL || '',
        apiKey: import.meta.env.VITE_AI_API_KEY || '',
        model: import.meta.env.VITE_AI_MODEL || '',
    };
}

/** Runtime overrides persisted in localStorage */
function getSavedConfig() {
    const saved = storage.get(CONFIG_KEY, null);
    if (!saved || typeof saved !== 'object') return saved;

    if (saved.apiKey) {
        setSessionApiKey(saved.apiKey);
        const sanitized = stripApiKey(saved);
        storage.set(CONFIG_KEY, sanitized);
        return sanitized;
    }

    return saved;
}

/**
 * Merged config: saved (runtime) > env (build) > defaults.
 * Empty strings from env are NOT treated as overrides.
 */
export function getConfig() {
    const env = getEnvConfig();
    const saved = getSavedConfig();
    const sessionApiKey = getSessionApiKey();

    // Strip empty-string env values so defaults still apply
    const cleanEnv = {};
    for (const [k, v] of Object.entries(env)) {
        if (v !== '') cleanEnv[k] = v;
    }

    const merged = {
        ...DEFAULT_CONFIG,
        ...cleanEnv,
        ...(saved || {}),
    };

    if (sessionApiKey === BLOCK_ENV_API_KEY_SENTINEL) {
        merged.apiKey = '';
    } else if (sessionApiKey) {
        merged.apiKey = sessionApiKey;
    }

    return merged;
}

/** Does the user have a usable API setup? */
export function isConfigured() {
    const c = getConfig();
    return Boolean(c.baseUrl && c.apiKey && c.model);
}

// ─── Config write ───────────────────────────────────────────

/**
 * Persist runtime config. Caller should also call resetAIClient()
 * (from aiClient.js) to pick up changes.
 */
export function saveConfig(config) {
    const { apiKey, ...restConfig } = config || {};

    // Only persist non-default, non-empty fields
    const toSave = {};
    for (const [k, v] of Object.entries(restConfig)) {
        if (v !== '' && v !== null && v !== undefined) {
            toSave[k] = v;
        }
    }
    storage.set(CONFIG_KEY, toSave);
    if (typeof apiKey === 'string') setSessionApiKey(apiKey, { blockEnv: !apiKey });
}

/** Wipe runtime overrides (revert to .env / defaults) */
export function clearConfig() {
    storage.remove(CONFIG_KEY);
    setSessionApiKey('');
}

// ─── Provider profiles ──────────────────────────────────────

export function getProfiles() {
    const profiles = storage.get(PROFILES_KEY, []);
    if (!Array.isArray(profiles)) return [];

    let changed = false;
    const sanitizedProfiles = profiles.map((profile) => {
        if (!profile?.config?.apiKey) return profile;
        changed = true;
        return {
            ...profile,
            config: stripApiKey(profile.config)
        };
    });

    if (changed) storage.set(PROFILES_KEY, sanitizedProfiles);
    return sanitizedProfiles;
}

export function saveProfile(name, config) {
    const profiles = getProfiles();
    const idx = profiles.findIndex(p => p.name === name);
    const entry = { name, config: stripApiKey(config), updatedAt: Date.now() };

    if (idx >= 0) profiles[idx] = entry;
    else profiles.push(entry);

    storage.set(PROFILES_KEY, profiles);
    return profiles;
}

export function deleteProfile(name) {
    const profiles = getProfiles().filter(p => p.name !== name);
    storage.set(PROFILES_KEY, profiles);
    return profiles;
}

export function loadProfile(name) {
    const profile = getProfiles().find(p => p.name === name);
    if (profile) saveConfig(profile.config);
    return profile;
}

// ─── Validation ─────────────────────────────────────────────

/**
 * Test API connectivity with a minimal chat completion.
 * Returns { valid: boolean, error?: string, latency?: number }
 */
export async function validateConfig(config) {
    if (!config.baseUrl || !config.apiKey || !config.model) {
        return { valid: false, error: 'missing_fields' };
    }

    // Use APIClient so relative baseUrls (e.g. /proxy/perplexity) go through
    // the Vite dev proxy — same path as real callAI() calls.
    const normalizedBase = normalizeBaseUrlForDevProxy(config.baseUrl);

    const client = new APIClient({
        baseURL: normalizedBase,
        timeout: 15000,
        maxRetries: 0,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
    });

    const endpoints = ['/chat/completions'];
    if (
        normalizedBase &&
        !/\/v\d+$/i.test(normalizedBase) &&
        !/\/chat\/completions$/i.test(normalizedBase)
    ) {
        endpoints.push('/v1/chat/completions');
    }

    const start = Date.now();
    try {
        let lastResult = { valid: false, error: 'request_failed', latency: Date.now() - start };

        for (let i = 0; i < endpoints.length; i++) {
            const endpoint = endpoints[i];
            const res = await client.post(endpoint, {
                model: config.model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5,
            });

            const latency = Date.now() - start;

            if (res.ok) return { valid: true, latency };

            const body = await res.json().catch(() => null);
            const error = body?.error?.message || `HTTP ${res.status}`;
            lastResult = { valid: false, error, latency };

            if ((res.status === 404 || res.status === 405) && i < endpoints.length - 1) {
                continue;
            }

            return lastResult;
        }

        return lastResult;
    } catch (err) {
        return { valid: false, error: err.name === 'TimeoutError' ? 'timeout' : err.message };
    }
}

// ─── Data export / import ───────────────────────────────────

function isBrowserIndexedDBAvailable() {
    return typeof window !== 'undefined' && Boolean(window.indexedDB);
}

function openDatabase(schema) {
    return new Promise((resolve, reject) => {
        if (!isBrowserIndexedDBAvailable()) {
            resolve(null);
            return;
        }

        const request = indexedDB.open(schema.dbName, schema.version);
        request.onupgradeneeded = (event) => {
            schema.ensureSchema?.(event.target.result);
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllStoreRecords(schema) {
    const db = await openDatabase(schema);
    if (!db || !db.objectStoreNames.contains(schema.storeName)) return [];

    return new Promise((resolve, reject) => {
        const tx = db.transaction(schema.storeName, 'readonly');
        const store = tx.objectStore(schema.storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function clearStoreRecords(schema) {
    const db = await openDatabase(schema);
    if (!db || !db.objectStoreNames.contains(schema.storeName)) return;

    return new Promise((resolve, reject) => {
        const tx = db.transaction(schema.storeName, 'readwrite');
        const store = tx.objectStore(schema.storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function replaceStoreRecords(schema, records = []) {
    const db = await openDatabase(schema);
    if (!db || !db.objectStoreNames.contains(schema.storeName)) return 0;

    return new Promise((resolve, reject) => {
        const tx = db.transaction(schema.storeName, 'readwrite');
        const store = tx.objectStore(schema.storeName);
        store.clear();
        let written = 0;
        records.forEach((record) => {
            store.put(record);
            written += 1;
        });
        tx.oncomplete = () => resolve(written);
        tx.onerror = () => reject(tx.error);
    });
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAllowedStorageKey(key) {
    return typeof key === 'string' && key.length <= 200 && (
        key.startsWith('chat-buddy:') || key.startsWith('chat-buddy-')
    );
}

function assertSafeBaseUrl(baseUrl) {
    if (baseUrl === undefined || baseUrl === null || baseUrl === '') return;
    if (typeof baseUrl !== 'string' || baseUrl.length > 2048) throw new Error('invalid_backup_base_url');
    if (baseUrl.startsWith('/') && !baseUrl.startsWith('//')) return;

    let parsed;
    try {
        parsed = new URL(baseUrl);
    } catch {
        throw new Error('invalid_backup_base_url');
    }
    if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
        throw new Error('invalid_backup_base_url');
    }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('invalid_backup_base_url');
}

function parseBackupValue(value) {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function sanitizeBackupValue(key, value) {
    const parsed = parseBackupValue(value);

    if (key === 'chat-buddy:api-config' || key === 'chat-buddy-api-config') {
        if (!isPlainObject(parsed)) throw new Error('invalid_backup_api_config');
        assertSafeBaseUrl(parsed.baseUrl);
        return stripApiKey(parsed);
    }

    if (key === 'chat-buddy:api-profiles' || key === 'chat-buddy-api-profiles') {
        if (!Array.isArray(parsed)) throw new Error('invalid_backup_api_profiles');
        return parsed.map((profile) => {
            if (!isPlainObject(profile) || !isPlainObject(profile.config)) {
                throw new Error('invalid_backup_api_profiles');
            }
            assertSafeBaseUrl(profile.config.baseUrl);
            return { ...profile, config: stripApiKey(profile.config) };
        });
    }

    return parsed;
}

function validateBackupPayload(data) {
    if (!isPlainObject(data) || !isPlainObject(data._meta) || data._meta.app !== 'Chat Buddy') {
        throw new Error('invalid_backup');
    }

    const isV2 = Object.hasOwn(data, 'localStorage') || Object.hasOwn(data, 'indexedDB');
    const expectedVersion = isV2 ? CURRENT_BACKUP_VERSION : 1;
    if (data._meta.version !== expectedVersion) throw new Error('unsupported_backup_version');

    const rawLocalStorage = isV2
        ? data.localStorage
        : Object.fromEntries(Object.entries(data).filter(([key]) => key !== '_meta'));
    if (!isPlainObject(rawLocalStorage)) throw new Error('invalid_backup_storage');

    const localStorageData = {};
    for (const [key, value] of Object.entries(rawLocalStorage)) {
        if (!isAllowedStorageKey(key)) throw new Error(`invalid_backup_key:${key}`);
        localStorageData[key] = sanitizeBackupValue(key, value);
    }

    const indexedDBData = isV2 ? (data.indexedDB || {}) : {};
    if (!isPlainObject(indexedDBData)) throw new Error('invalid_backup_indexeddb');

    const allowedDatabases = new Set(INDEXED_DB_SCHEMAS.map((schema) => schema.dbName));
    for (const dbName of Object.keys(indexedDBData)) {
        if (!allowedDatabases.has(dbName) || !isPlainObject(indexedDBData[dbName])) {
            throw new Error(`invalid_backup_database:${dbName}`);
        }
    }

    for (const schema of INDEXED_DB_SCHEMAS) {
        const database = indexedDBData[schema.dbName];
        if (!database) continue;
        const storeNames = Object.keys(database);
        if (storeNames.some((storeName) => storeName !== schema.storeName)) {
            throw new Error(`invalid_backup_store:${schema.dbName}`);
        }
        const records = database[schema.storeName];
        if (records === undefined) continue;
        if (!Array.isArray(records) || records.length > MAX_BACKUP_RECORDS_PER_STORE || records.some((record) => !isPlainObject(record))) {
            throw new Error(`invalid_backup_records:${schema.dbName}`);
        }
    }

    return { localStorageData, indexedDBData };
}

function getLocalStorageBackupData() {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(LOCAL_STORAGE_PREFIX)) continue;
        try {
            backup[key] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
            console.warn('[apiConfig] localStorage JSON parse failed for key:', key, e?.message);
            backup[key] = localStorage.getItem(key);
        }
    }
    return backup;
}

export async function clearAllAppData() {
    setSessionApiKey('', { blockEnv: true });

    Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('chat-buddy:') || key.startsWith('chat-buddy-')) {
            localStorage.removeItem(key);
        }
    });
    // Explicit legacy fallback key.
    localStorage.removeItem('chat-buddy-chats');

    if (!isBrowserIndexedDBAvailable()) return;

    await Promise.all(
        INDEXED_DB_SCHEMAS.map(async (schema) => {
            try {
                await clearStoreRecords(schema);
            } catch (e) {
                console.warn('[apiConfig] IndexedDB clear failed (best-effort):', schema.dbName, e?.message);
            }
        })
    );
}

/**
 * Export all Chat Buddy data as a JSON blob (chats, settings, profiles…).
 * Triggers a browser download.
 */
export async function exportAllData() {
    const indexedDBData = {};
    if (isBrowserIndexedDBAvailable()) {
        await Promise.all(INDEXED_DB_SCHEMAS.map(async (schema) => {
            try {
                const records = await getAllStoreRecords(schema);
                indexedDBData[schema.dbName] = {
                    ...(indexedDBData[schema.dbName] || {}),
                    [schema.storeName]: records
                };
            } catch (e) {
                console.warn('[apiConfig] IndexedDB export failed:', schema.dbName, e?.message);
                indexedDBData[schema.dbName] = {
                    ...(indexedDBData[schema.dbName] || {}),
                    [schema.storeName]: []
                };
            }
        }));
    }

    const data = {
        _meta: {
            app: 'Chat Buddy',
            exportedAt: new Date().toISOString(),
            version: CURRENT_BACKUP_VERSION,
            includesIndexedDB: true
        },
        localStorage: getLocalStorageBackupData(),
        indexedDB: indexedDBData
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-buddy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return data;
}

/**
 * Import data from a JSON file (previously exported).
 * Returns number of keys restored.
 */
export function importData(file) {
    return new Promise((resolve, reject) => {
        if (!file || file.size > MAX_BACKUP_SIZE_BYTES) {
            reject(new Error('backup_too_large'));
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const { localStorageData, indexedDBData } = validateBackupPayload(data);

                let count = 0;

                if (isBrowserIndexedDBAvailable()) {
                    for (const schema of INDEXED_DB_SCHEMAS) {
                        const records = indexedDBData?.[schema.dbName]?.[schema.storeName];
                        if (!Array.isArray(records)) continue;
                        count += await replaceStoreRecords(schema, records);
                    }
                }

                // Imported endpoints must never inherit the credential from the
                // current tab. The user must explicitly re-enter the API key.
                setSessionApiKey('', { blockEnv: true });

                for (const [key, value] of Object.entries(localStorageData)) {
                    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                    count++;
                }

                resolve(count);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}
