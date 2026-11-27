// Separate cross-platform settings transfer, not a full account or Web v2 backup.
const format = 'chat-buddy.preferences';
const uiKey = 'chat-buddy-lang';
const aiKey = 'chat-buddy-ai-lang';
const themeKey = 'chat-buddy-theme';
const oneOf = (value, list, fallback) => list.includes(value) ? value : fallback;

export function validatePortablePreferences(value) {
    const fields = ['format', 'version', 'uiLanguage', 'aiLanguage', 'themeMode', 'oledEnabled', 'animationIntensity'];
    if (!value || typeof value !== 'object' || Object.keys(value).length !== fields.length
        || !fields.every(key => Object.hasOwn(value, key))
        || value.format !== format || value.version !== 1
        || !['en', 'zh', 'system'].includes(value.uiLanguage)
        || !['en', 'zh', 'auto'].includes(value.aiLanguage)
        || !['dark', 'light', 'system'].includes(value.themeMode)
        || typeof value.oledEnabled !== 'boolean'
        || !['none', 'subtle', 'standard', 'intense'].includes(value.animationIntensity)) {
        throw new Error('invalid_portable_preferences');
    }
    return value;
}

function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
}
function theme() {
    const value = read(themeKey);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export function buildPortablePreferences() {
    const appearance = theme();
    return {
        format, version: 1,
        uiLanguage: oneOf(read(uiKey), ['en', 'zh'], 'system'),
        aiLanguage: oneOf(read(aiKey), ['en', 'zh'], 'auto'),
        themeMode: oneOf(appearance.mode, ['dark', 'light'], 'system'),
        oledEnabled: appearance.oledEnabled === true,
        animationIntensity: oneOf(appearance.animationIntensity, ['none', 'subtle', 'intense'], 'standard'),
    };
}
export function importPortablePreferences(value) {
    validatePortablePreferences(value);
    const previous = [themeKey, uiKey, aiKey].map(key => [key, localStorage.getItem(key)]);
    try {
        localStorage.setItem(uiKey, JSON.stringify(value.uiLanguage === 'system' ? '__not_set__' : value.uiLanguage));
        localStorage.setItem(aiKey, JSON.stringify(value.aiLanguage));
        localStorage.setItem(themeKey, JSON.stringify({ ...theme(), mode: value.themeMode,
            oledEnabled: value.oledEnabled, animationIntensity: value.animationIntensity }));
    } catch (error) {
        for (const [key, oldValue] of previous) {
            if (oldValue === null) localStorage.removeItem(key);
            else localStorage.setItem(key, oldValue);
        }
        throw error;
    }
    return 5;
}
export function downloadPortablePreferences() {
    const blob = new Blob([JSON.stringify(buildPortablePreferences())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chat-buddy-portable-preferences.json';
    document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); URL.revokeObjectURL(url); }
}
