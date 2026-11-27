import { beforeEach, expect, it } from 'vitest';
import golden from '../../docs/fixtures/portable-preferences-v1.json';
import { buildPortablePreferences } from './portablePreferences';
import { importData } from './apiConfig';
beforeEach(() => localStorage.clear());
const file = (data) => new File([JSON.stringify(data)], 'preferences.json', { type: 'application/json' });
it('round-trips the shared preference fixture through the actual import entry', async () => {
    localStorage.setItem('chat-buddy-theme', '{"chatBackground":"custom"}');
    await expect(importData(file(golden))).resolves.toBe(5);
    expect(buildPortablePreferences()).toEqual(golden);
    expect(JSON.parse(localStorage.getItem('chat-buddy-theme')).chatBackground).toBe('custom');
});
it('rejects an unknown field without touching storage', async () => {
    await expect(importData(file({ ...golden, apiKey: 'fixture-not-a-key' }))).rejects.toThrow('invalid_portable_preferences');
    expect(localStorage.getItem('chat-buddy-lang')).toBeFalsy();
    expect(localStorage.getItem('chat-buddy-ai-lang')).toBeFalsy();
    expect(localStorage.getItem('chat-buddy-theme')).toBeFalsy();
});
