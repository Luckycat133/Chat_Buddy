import { useEffect } from 'react';

/**
 * Global keyboard shortcuts hook.
 * @param {Array<{ key: string, ctrl?: boolean, shift?: boolean, action: () => void, skipInputs?: boolean }>} shortcuts
 */
export function useKeyboardShortcuts(shortcuts) {
    useEffect(() => {
        const handler = (e) => {
            for (const shortcut of shortcuts) {
                const wantsMod = shortcut.ctrl ?? false;
                const wantsShift = shortcut.shift ?? false;
                const hasMod = e.ctrlKey || e.metaKey;

                if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;
                if (wantsMod !== hasMod) continue;
                if (wantsShift !== e.shiftKey) continue;

                // Skip when focus is in editable elements (default: true for mod-key shortcuts)
                const skipInputs = shortcut.skipInputs ?? wantsMod;
                if (!skipInputs) {
                    const tag = document.activeElement?.tagName;
                    const isEditable = document.activeElement?.isContentEditable;
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) continue;
                }

                e.preventDefault();
                shortcut.action();
                return;
            }
        };

        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [shortcuts]);
}
