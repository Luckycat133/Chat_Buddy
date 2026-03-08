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
export function useFocusTrap(isActive = true) {
    const containerRef = useRef(null);
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        previousFocusRef.current = document.activeElement;

        const container = containerRef.current;

        const getFocusable = () =>
            [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
                .filter(el => !el.closest('[hidden]') && el.offsetParent !== null);

        // Focus first focusable element
        requestAnimationFrame(() => {
            const elements = getFocusable();
            if (elements.length > 0) elements[0].focus();
        });

        const handleKeyDown = (e) => {
            if (e.key !== 'Tab') return;
            const elements = getFocusable();
            if (elements.length === 0) return;

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
            container.removeEventListener('keydown', handleKeyDown);
            previousFocusRef.current?.focus();
        };
    }, [isActive]);

    return containerRef;
}
