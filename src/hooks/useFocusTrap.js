import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within a container while active.
 * Restores focus to the previously-focused element on cleanup.
 *
 * @param {boolean} isActive - Whether the trap is active
 * @returns {React.RefObject} - Attach to the container element
 */
export function useFocusTrap(isActive = true, onClose) {
    const containerRef = useRef(null);
    const previousFocusRef = useRef(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        previousFocusRef.current = document.activeElement;

        const container = containerRef.current;

        const getFocusable = () =>
            [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
                .filter(el => !el.closest('[hidden]') && el.offsetParent !== null);

        // Focus first focusable element
        const focusFrame = requestAnimationFrame(() => {
            const elements = getFocusable();
            const preferred = container.querySelector('[autofocus]');
            if (preferred instanceof HTMLElement && preferred.offsetParent !== null) {
                preferred.focus();
            } else if (elements.length > 0) {
                elements[0].focus();
            } else {
                container.focus();
            }
        });

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onCloseRef.current) {
                e.preventDefault();
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab') return;
            const elements = getFocusable();
            if (elements.length === 0) {
                e.preventDefault();
                container.focus();
                return;
            }

            const first = elements[0];
            const last = elements[elements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);

        return () => {
            cancelAnimationFrame(focusFrame);
            container.removeEventListener('keydown', handleKeyDown);
            if (previousFocusRef.current instanceof HTMLElement && previousFocusRef.current.isConnected) {
                previousFocusRef.current.focus({ preventScroll: true });
            }
        };
    }, [isActive]);

    return containerRef;
}
