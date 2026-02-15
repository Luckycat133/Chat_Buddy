import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { SHORTCUT_DEFINITIONS, formatShortcut } from '../config/shortcuts';
import { useFocusTrap } from '../hooks/useFocusTrap';

export default function KeyboardShortcutsModal({ onClose }) {
    const { t } = useLanguage();
    const trapRef = useFocusTrap(true);

    const navShortcuts = SHORTCUT_DEFINITIONS.filter(s => s.category === 'navigation');
    const actionShortcuts = SHORTCUT_DEFINITIONS.filter(s => s.category === 'actions');

    return (
        <div className="modal-overlay" onClick={onClose} role="presentation">
            <div
                ref={trapRef}
                className="modal-panel w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="shortcuts-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-light)]">
                    <h2 id="shortcuts-title" className="text-lg font-bold text-[var(--color-text-main)]">
                        {t('keyboard_shortcuts')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-[var(--color-bg-hover)] transition-colors"
                        aria-label={t('close')}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5">
                    {/* Navigation */}
                    <div>
                        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                            {t('shortcut_navigation')}
                        </h3>
                        <div className="space-y-2">
                            {navShortcuts.map((s) => (
                                <ShortcutRow key={s.id} label={t(s.labelKey)} combo={formatShortcut(s)} />
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div>
                        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                            {t('shortcut_actions')}
                        </h3>
                        <div className="space-y-2">
                            {actionShortcuts.map((s) => (
                                <ShortcutRow key={s.id} label={t(s.labelKey)} combo={formatShortcut(s)} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ShortcutRow({ label, combo }) {
    const keys = combo.split('+');
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-[var(--color-text-main)]">{label}</span>
            <div className="flex items-center gap-1">
                {keys.map((k, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <span className="text-xs text-[var(--color-text-muted)]">+</span>}
                        <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2
                            rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)]
                            text-xs font-mono font-medium text-[var(--color-text-muted)]">
                            {k}
                        </kbd>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
