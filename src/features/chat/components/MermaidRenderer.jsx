import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '../../../context/ThemeContext';
import { GitGraph } from 'lucide-react';

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
                });

                // Clear previous content safely
                while (containerRef.current.firstChild) {
                    containerRef.current.removeChild(containerRef.current.firstChild);
                }

                const trimmedContent = content.trim();

                // 1. Validate syntax explicitly. This will throw if content is invalid.
                // In some versions, parse returns a promise, in others it's synchronous.
                if (mermaid.parseAsync) {
                    await mermaid.parseAsync(trimmedContent);
                } else {
                    await mermaid.parse(trimmedContent, { suppressErrors: true });
                }

                // Generate a unique ID for this diagram
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

                // 2. Render the diagram
                const { svg } = await mermaid.render(id, trimmedContent);

                // Fail-safe: if mermaid still returns an error SVG silently
                if (svg.includes('Syntax error in text') || svg.includes('error-icon')) {
                    throw new Error('Invalid Mermaid syntax');
                }

                // Parse and insert SVG safely
                const parser = new DOMParser();
                const doc = parser.parseFromString(svg, 'image/svg+xml');
                const svgElement = doc.documentElement;
                
                // Add maximum bounds so huge diagrams don't break the layout
                svgElement.setAttribute('style', 'max-width: 100%; height: auto;');
                
                containerRef.current.appendChild(svgElement);
            } catch (err) {
                console.error('Mermaid render error:', err);
                setError(err.message || 'Failed to render diagram');
            } finally {
                setIsLoading(false);
            }
        };

        renderDiagram();
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
