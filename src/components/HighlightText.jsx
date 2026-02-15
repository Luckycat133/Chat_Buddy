import React, { useMemo } from 'react';
import { cn } from '../utils/cn';

export function HighlightText({ text, highlight, className, highlightClassName }) {
    const highlightedContent = useMemo(() => {
        if (!highlight || !text) {
            return text;
        }

        const lowerText = text.toLowerCase();
        const lowerHighlight = highlight.toLowerCase();
        
        const parts = [];
        let lastIndex = 0;
        let index = lowerText.indexOf(lowerHighlight);

        while (index !== -1) {
            if (index > lastIndex) {
                parts.push(
                    <span key={`text-${lastIndex}`}>
                        {text.slice(lastIndex, index)}
                    </span>
                );
            }

            parts.push(
                <mark
                    key={`highlight-${index}`}
                    className={cn(
                        "bg-[var(--color-primary)]/20 text-[var(--color-primary-active)]",
                        "rounded px-0.5 font-semibold",
                        "dark:bg-[var(--color-primary)]/30 dark:text-[var(--color-primary)]",
                        highlightClassName
                    )}
                >
                    {text.slice(index, index + highlight.length)}
                </mark>
            );

            lastIndex = index + highlight.length;
            index = lowerText.indexOf(lowerHighlight, lastIndex);
        }

        if (lastIndex < text.length) {
            parts.push(
                <span key={`text-${lastIndex}`}>
                    {text.slice(lastIndex)}
                </span>
            );
        }

        return parts.length > 0 ? parts : text;
    }, [text, highlight, highlightClassName]);

    return (
        <span className={className}>
            {highlightedContent}
        </span>
    );
}

export function HighlightMultiple({ text, highlights, className, highlightClassName }) {
    const highlightedContent = useMemo(() => {
        if (!highlights?.length || !text) {
            return text;
        }

        const sortedHighlights = highlights
            .map(h => ({ 
                text: h, 
                lower: h.toLowerCase() 
            }))
            .sort((a, b) => b.text.length - a.text.length);

        let result = [text];

        for (const { text: h, lower } of sortedHighlights) {
            result = result.flatMap(part => {
                if (typeof part !== 'string') return part;

                const parts = [];
                let lastIndex = 0;
                let index = part.toLowerCase().indexOf(lower);

                while (index !== -1) {
                    if (index > lastIndex) {
                        parts.push(part.slice(lastIndex, index));
                    }

                    parts.push(
                        <mark
                            key={`hl-${index}-${h}`}
                            className={cn(
                                "bg-[var(--color-primary)]/20 text-[var(--color-primary-active)]",
                                "rounded px-0.5 font-semibold",
                                "dark:bg-[var(--color-primary)]/30 dark:text-[var(--color-primary)]",
                                highlightClassName
                            )}
                        >
                            {part.slice(index, index + h.length)}
                        </mark>
                    );

                    lastIndex = index + h.length;
                    index = part.toLowerCase().indexOf(lower, lastIndex);
                }

                if (lastIndex < part.length) {
                    parts.push(part.slice(lastIndex));
                }

                return parts;
            });
        }

        return result;
    }, [text, highlights, highlightClassName]);

    return (
        <span className={className}>
            {highlightedContent}
        </span>
    );
}

export default HighlightText;
