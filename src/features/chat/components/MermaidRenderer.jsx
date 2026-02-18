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
                });

                // Clear previous content
                containerRef.current.innerHTML = '';

                // Generate a unique ID for this diagram
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

                // Render the diagram
                const { svg } = await mermaid.render(id, content.trim());

                // Insert the SVG
                containerRef.current.innerHTML = svg;
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
