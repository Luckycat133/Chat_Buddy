/**
 * T02 — Unified API Configuration System
 *
 * Priority: localStorage (runtime) > .env (build-time) > defaults
 * Supports multiple saved provider profiles.
 */
import { storage } from '../services/storage/StorageService';

const CONFIG_KEY = 'api-config';
const PROFILES_KEY = 'api-profiles';

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
    return storage.get(CONFIG_KEY, null);
}

/**
 * Merged config: saved (runtime) > env (build) > defaults.
 * Empty strings from env are NOT treated as overrides.
 */
export function getConfig() {
    const env = getEnvConfig();
    const saved = getSavedConfig();

    // Strip empty-string env values so defaults still apply
    const cleanEnv = {};
    for (const [k, v] of Object.entries(env)) {
        if (v !== '') cleanEnv[k] = v;
    }

    return {
        ...DEFAULT_CONFIG,
        ...cleanEnv,
        ...(saved || {}),
    };
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
    // Only persist non-default, non-empty fields
    const toSave = {};
    for (const [k, v] of Object.entries(config)) {
        if (v !== '' && v !== null && v !== undefined) {
            toSave[k] = v;
        }
    }
    storage.set(CONFIG_KEY, toSave);
}

/** Wipe runtime overrides (revert to .env / defaults) */
export function clearConfig() {
    storage.remove(CONFIG_KEY);
}

// ─── Provider profiles ──────────────────────────────────────

export function getProfiles() {
    return storage.get(PROFILES_KEY, []);
}

export function saveProfile(name, config) {
    const profiles = getProfiles();
    const idx = profiles.findIndex(p => p.name === name);
    const entry = { name, config, updatedAt: Date.now() };

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

    const start = Date.now();
    try {
        const res = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5,
            }),
            signal: AbortSignal.timeout(15000),
        });

        const latency = Date.now() - start;

        if (res.ok) return { valid: true, latency };

        const body = await res.json().catch(() => null);
        return {
            valid: false,
            error: body?.error?.message || `HTTP ${res.status}`,
            latency,
        };
    } catch (err) {
        return { valid: false, error: err.name === 'TimeoutError' ? 'timeout' : err.message };
    }
}

// ─── Data export / import ───────────────────────────────────

/**
 * Export all Chat Buddy data as a JSON blob (chats, settings, profiles…).
 * Triggers a browser download.
 */
export function exportAllData() {
    const data = { _meta: { app: 'Chat Buddy', exportedAt: new Date().toISOString(), version: 1 } };

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('chat-buddy')) {
            try { data[key] = JSON.parse(localStorage.getItem(key)); }
            catch { data[key] = localStorage.getItem(key); }
        }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-buddy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/**
 * Import data from a JSON file (previously exported).
 * Returns number of keys restored.
 */
export function importData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data._meta || data._meta.app !== 'Chat Buddy') {
                    reject(new Error('invalid_backup'));
                    return;
                }
                let count = 0;
                for (const [key, value] of Object.entries(data)) {
                    if (key === '_meta') continue;
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
