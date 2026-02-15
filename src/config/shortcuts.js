/**
 * Central keyboard shortcut definitions.
 * Each entry has: id, key, ctrl, labelKey (locale key), category.
 */
export const SHORTCUT_DEFINITIONS = [
    // Navigation
    { id: 'nav_chats', key: '1', ctrl: true, labelKey: 'shortcut_nav_chats', category: 'navigation', route: '/' },
    { id: 'nav_agents', key: '2', ctrl: true, labelKey: 'shortcut_nav_agents', category: 'navigation', route: '/agents' },
    { id: 'nav_friends', key: '3', ctrl: true, labelKey: 'shortcut_nav_friends', category: 'navigation', route: '/friends' },
    { id: 'nav_moments', key: '4', ctrl: true, labelKey: 'shortcut_nav_moments', category: 'navigation', route: '/moments' },
    { id: 'nav_settings', key: '5', ctrl: true, labelKey: 'shortcut_nav_settings', category: 'navigation', route: '/settings' },
    // Actions
    { id: 'search', key: 'k', ctrl: true, labelKey: 'shortcut_search', category: 'actions' },
    { id: 'help', key: '/', ctrl: true, labelKey: 'shortcut_help', category: 'actions' },
    { id: 'close', key: 'Escape', ctrl: false, labelKey: 'shortcut_close', category: 'actions' },
];

/**
 * Detect platform for display labels.
 */
export function getModKey() {
    return navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl';
}

/**
 * Format a shortcut for display: "Ctrl+1" or "Cmd+K"
 */
export function formatShortcut(def) {
    const parts = [];
    if (def.ctrl) parts.push(getModKey());
    if (def.shift) parts.push('Shift');
    // Prettify key name
    const keyLabel = def.key === 'Escape' ? 'Esc' : def.key.toUpperCase();
    parts.push(keyLabel);
    return parts.join('+');
}
