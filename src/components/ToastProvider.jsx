import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const ICON_MAP = {
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info,
    error: XCircle,
};

const COLOR_MAP = {
    success: 'text-green-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
    error: 'text-red-500',
};

let _id = 0;

export function ToastProvider({ children, maxToasts = 5, defaultDuration = 4000 }) {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef(new Map());

    const removeToast = useCallback((id) => {
        if (timersRef.current.has(id)) {
            clearTimeout(timersRef.current.get(id));
            timersRef.current.delete(id);
        }
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((toast) => {
        const id = ++_id;
        const duration = toast.duration ?? defaultDuration;
        const entry = { type: 'info', ...toast, id };

        setToasts(prev => {
            const next = [...prev, entry];
            return next.slice(-maxToasts);
        });

        if (duration > 0) {
            const timer = setTimeout(() => removeToast(id), duration);
            timersRef.current.set(id, timer);
        }

        return id;
    }, [defaultDuration, maxToasts, removeToast]);

    const toast = useCallback((message, opts = {}) => addToast({ type: 'info', message, ...opts }), [addToast]);
    toast.success = (message, opts = {}) => addToast({ type: 'success', message, ...opts });
    toast.error = (message, opts = {}) => addToast({ type: 'error', message, ...opts });
    toast.warning = (message, opts = {}) => addToast({ type: 'warning', message, ...opts });
    toast.info = (message, opts = {}) => addToast({ type: 'info', message, ...opts });

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380 }}>
                {toasts.map(t => {
                    const Icon = ICON_MAP[t.type] || ICON_MAP.info;
                    const colorCls = COLOR_MAP[t.type] || COLOR_MAP.info;
                    return (
                        <div
                            key={t.id}
                            className="pointer-events-auto flex items-start gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-white)] shadow-lg animate-in slide-in-from-right"
                            role="alert"
                        >
                            <Icon size={18} className={`mt-0.5 shrink-0 ${colorCls}`} />
                            <div className="flex-1 min-w-0">
                                {t.title && (
                                    <p className="text-sm font-medium text-[var(--color-text-main)]">{t.title}</p>
                                )}
                                <p className="text-sm text-[var(--color-text-muted)]">{t.message}</p>
                            </div>
                            <button
                                onClick={() => removeToast(t.id)}
                                className="shrink-0 p-0.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
}
