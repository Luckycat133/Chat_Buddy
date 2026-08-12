import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogFocusTrap(dialogRef, onClose) {
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;

        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusDialog = window.requestAnimationFrame(() => {
            dialog.focus({ preventScroll: true });
        });

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onCloseRef.current?.();
                return;
            }

            if (event.key !== 'Tab') return;
            const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
                .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.cancelAnimationFrame(focusDialog);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.body.style.overflow = previousOverflow;
            if (opener?.isConnected) opener.focus({ preventScroll: true });
        };
    }, [dialogRef]);
}
