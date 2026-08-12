import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
import { useTheme } from '../../../context/ThemeContext';
import { GitGraph } from 'lucide-react';

const MAX_DIAGRAM_LENGTH = 20_000;
const MAX_SVG_LENGTH = 2_000_000;
const RENDER_TIMEOUT_MS = 5_000;

function withTimeout(operation) {
    let timeoutId;
    return Promise.race([
        operation,
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Diagram rendering timed out')), RENDER_TIMEOUT_MS);
        }),
    ]).finally(() => clearTimeout(timeoutId));
}

/**
 * T08: Mermaid Diagram Renderer
 * Renders Mermaid diagrams in code blocks with theme support
 */
export default function MermaidRenderer({ content }) {
    const containerRef = useRef(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { isDarkMode } = useTheme();

    useEffect(() => {
        if (!containerRef.current) return;
        let cancelled = false;

        const renderDiagram = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Configure mermaid theme based on dark/light mode
                mermaid.initialize({
                    startOnLoad: false,
                    theme: isDarkMode ? 'dark' : 'default',
                    securityLevel: 'strict',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    suppressErrorRendering: true, // Crucial: prevents Mermaid from drawing the giant bomb SVG
                    flowchart: { htmlLabels: false },
                });

                // Clear previous content safely
                while (containerRef.current.firstChild) {
                    containerRef.current.removeChild(containerRef.current.firstChild);
                }

                const trimmedContent = content.trim();
                if (trimmedContent.length > MAX_DIAGRAM_LENGTH) {
                    throw new Error('Diagram is too large to render safely');
                }
                if (!trimmedContent) {
                    throw new Error('Diagram is empty');
                }

                const { svg } = await withTimeout((async () => {
                    // Validate syntax explicitly before rendering.
                    if (mermaid.parseAsync) {
                        await mermaid.parseAsync(trimmedContent);
                    } else {
                        await mermaid.parse(trimmedContent, { suppressErrors: true });
                    }

                    const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
                    return mermaid.render(id, trimmedContent);
                })());

                if (cancelled) return;

                // Fail-safe: if mermaid still returns an error SVG silently
                if (svg.includes('Syntax error in text') || svg.includes('error-icon')) {
                    throw new Error('Invalid Mermaid syntax');
                }
                if (svg.length > MAX_SVG_LENGTH) {
                    throw new Error('Diagram output is too large to display safely');
                }

                // Mermaid's strict mode is the first layer; sanitize its SVG output again
                // before it reaches the document so future parser changes stay contained.
                const sanitizedSvg = DOMPurify.sanitize(svg, {
                    USE_PROFILES: { svg: true, svgFilters: true },
                    FORBID_TAGS: ['foreignObject'],
                });
                const parser = new DOMParser();
                const doc = parser.parseFromString(sanitizedSvg, 'image/svg+xml');
                const svgElement = doc.documentElement;
                if (svgElement.localName !== 'svg' || doc.querySelector('parsererror')) {
                    throw new Error('Diagram output was not valid SVG');
                }

                // Add maximum bounds so huge diagrams don't break the layout
                svgElement.setAttribute('style', 'max-width: 100%; height: auto;');

                if (!cancelled && containerRef.current) {
                    containerRef.current.appendChild(svgElement);
                }
            } catch (err) {
                if (!cancelled) {
                    console.warn('Mermaid render error:', err);
                    setError(err.message || 'Failed to render diagram');
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        renderDiagram();
        return () => {
            cancelled = true;
        };
    }, [content, isDarkMode]);

    if (error) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3 my-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium mb-1">
                    <GitGraph size={16} />
                    <span>Diagram Error</span>
                </div>
                <pre className="text-xs text-red-500 dark:text-red-400 overflow-x-auto">
                    {content}
                </pre>
                <p className="text-xs text-red-400 dark:text-red-500 mt-1">{error}</p>
            </div>
        );
    }

    return (
        <div className="relative my-2">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-active)] rounded-lg min-h-[100px]">
                    <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                        <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Rendering diagram...</span>
                    </div>
                </div>
            )}
            <div
                ref={containerRef}
                className="mermaid-container overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-white)] p-4"
                style={{ minHeight: isLoading ? '100px' : 'auto' }}
            />
        </div>
    );
}
