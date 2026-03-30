import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearConfig,
    getConfig,
    getProfiles,
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
});