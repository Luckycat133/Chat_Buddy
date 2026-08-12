import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearConfig,
    clearAllAppData,
    getConfig,
    getProfiles,
    importData,
    saveConfig,
    saveProfile,
} from './apiConfig';

describe('apiConfig', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        clearConfig();
        vi.stubEnv('VITE_AI_API_URL', '');
        vi.stubEnv('VITE_AI_API_KEY', '');
        vi.stubEnv('VITE_AI_MODEL', '');
    });

    afterEach(() => {
        clearConfig();
        localStorage.clear();
        sessionStorage.clear();
        vi.unstubAllEnvs();
    });

    it('test_when_save_config_contains_api_key_should_store_key_in_session_only', () => {
        // When
        saveConfig({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'sk-session-only',
            model: 'gpt-4o',
            temperature: 0.5,
        });

        // Then
        expect(getConfig()).toMatchObject({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'sk-session-only',
            model: 'gpt-4o',
            temperature: 0.5,
        });

        const persistedConfig = JSON.parse(localStorage.getItem('chat-buddy:api-config'));
        expect(persistedConfig).toEqual({
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-4o',
            temperature: 0.5,
        });
        expect(persistedConfig).not.toHaveProperty('apiKey');
        expect(sessionStorage.length).toBe(1);
        expect(sessionStorage.getItem(sessionStorage.key(0))).toBe('sk-session-only');
    });

    it('test_when_save_config_contains_unknown_secret_fields_should_drop_them', () => {
        saveConfig({
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-4o',
            apiKey: 'sk-session-only',
            authorization: 'Bearer should-not-persist',
            accessToken: 'should-not-persist',
        });

        const persistedConfig = JSON.parse(localStorage.getItem('chat-buddy:api-config'));
        expect(persistedConfig).toEqual({
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-4o',
        });
    });

    it('test_when_legacy_persisted_config_contains_api_key_should_migrate_key_to_session_storage', () => {
        // Given
        localStorage.setItem('chat-buddy:api-config', JSON.stringify({
            baseUrl: 'https://legacy.example.com/v1',
            apiKey: 'sk-legacy',
            model: 'legacy-model',
        }));

        // When
        const config = getConfig();

        // Then
        expect(config).toMatchObject({
            baseUrl: 'https://legacy.example.com/v1',
            apiKey: 'sk-legacy',
            model: 'legacy-model',
        });

        const persistedConfig = JSON.parse(localStorage.getItem('chat-buddy:api-config'));
        expect(persistedConfig).toEqual({
            baseUrl: 'https://legacy.example.com/v1',
            model: 'legacy-model',
        });
        expect(sessionStorage.length).toBe(1);
        expect(sessionStorage.getItem(sessionStorage.key(0))).toBe('sk-legacy');
    });

    it('test_when_profiles_include_api_key_should_strip_it_from_returned_and_persisted_data', () => {
        // Given
        localStorage.setItem('chat-buddy:api-profiles', JSON.stringify([
            {
                name: 'Legacy Profile',
                updatedAt: 1,
                config: {
                    baseUrl: 'https://api.example.com/v1',
                    apiKey: 'sk-profile',
                    model: 'gpt-4o',
                }
            }
        ]));

        // When
        const profiles = getProfiles();

        // Then
        expect(profiles).toHaveLength(1);
        expect(profiles[0].config).toEqual({
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-4o',
        });

        const persistedProfiles = JSON.parse(localStorage.getItem('chat-buddy:api-profiles'));
        expect(persistedProfiles[0].config).toEqual({
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-4o',
        });
    });

    it('test_when_save_profile_called_should_exclude_api_key_from_persisted_profile', () => {
        // When
        const profiles = saveProfile('OpenAI', {
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'sk-profile',
            model: 'gpt-4o',
            temperature: 0.7,
        });

        // Then
        expect(profiles[0].config).toEqual({
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o',
            temperature: 0.7,
        });
        expect(profiles[0].config).not.toHaveProperty('apiKey');
    });

    it('test_when_clear_all_data_should_remove_session_api_key', async () => {
        // Given
        saveConfig({ baseUrl: 'https://api.example.com/v1', apiKey: 'sk-secret', model: 'model' });

        // When
        await clearAllAppData();

        // Then
        expect(sessionStorage.getItem('chat-buddy:session-api-key')).not.toBe('sk-secret');
        expect(getConfig().apiKey).toBe('');
    });

    it('test_when_import_contains_foreign_storage_key_should_reject_without_writes', async () => {
        // Given
        const file = new File([JSON.stringify({
            _meta: { app: 'Chat Buddy', version: 2 },
            localStorage: { 'unrelated-app-token': 'secret' },
            indexedDB: {},
        })], 'backup.json', { type: 'application/json' });

        // Then
        await expect(importData(file)).rejects.toThrow('invalid_backup_key');
        expect(localStorage.getItem('unrelated-app-token')).toBeNull();
    });

    it('test_when_import_version_is_unknown_should_reject', async () => {
        const file = new File([JSON.stringify({
            _meta: { app: 'Chat Buddy', version: 99 },
            localStorage: {},
            indexedDB: {},
        })], 'backup.json', { type: 'application/json' });

        await expect(importData(file)).rejects.toThrow('unsupported_backup_version');
    });

    it('test_when_import_changes_api_endpoint_should_strip_imported_and_session_keys', async () => {
        // Given
        saveConfig({ baseUrl: 'https://old.example.com/v1', apiKey: 'sk-current', model: 'old-model' });
        const file = new File([JSON.stringify({
            _meta: { app: 'Chat Buddy', version: 2 },
            localStorage: {
                'chat-buddy:api-config': {
                    baseUrl: 'https://new.example.com/v1',
                    apiKey: 'sk-imported',
                    model: 'new-model',
                },
            },
            indexedDB: {},
        })], 'backup.json', { type: 'application/json' });

        // When
        await importData(file);

        // Then
        expect(getConfig()).toMatchObject({
            baseUrl: 'https://new.example.com/v1',
            apiKey: '',
            model: 'new-model',
        });
        expect(sessionStorage.getItem('chat-buddy:session-api-key')).not.toBe('sk-current');
        expect(JSON.parse(localStorage.getItem('chat-buddy:api-config'))).not.toHaveProperty('apiKey');
    });

    it('test_when_import_changes_endpoint_should_not_reuse_build_time_api_key', async () => {
        // Given
        vi.stubEnv('VITE_AI_API_KEY', 'sk-build-time');
        const file = new File([JSON.stringify({
            _meta: { app: 'Chat Buddy', version: 2 },
            localStorage: {
                'chat-buddy:api-config': { baseUrl: 'https://new.example.com/v1', model: 'new-model' },
            },
            indexedDB: {},
        })], 'backup.json', { type: 'application/json' });

        // When
        await importData(file);

        // Then
        expect(getConfig().apiKey).toBe('');
    });

    it('test_when_import_uses_non_local_http_endpoint_should_reject', async () => {
        const file = new File([JSON.stringify({
            _meta: { app: 'Chat Buddy', version: 2 },
            localStorage: {
                'chat-buddy:api-config': { baseUrl: 'http://attacker.example/v1', model: 'model' },
            },
            indexedDB: {},
        })], 'backup.json', { type: 'application/json' });

        await expect(importData(file)).rejects.toThrow('invalid_backup_base_url');
    });
});
