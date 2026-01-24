/**
 * BentoGrid - Modular grid layout system inspired by Apple's Bento design
 * 
 * Provides flexible, responsive grid layouts with various card sizes
 * for creating dashboard-style interfaces.
 */

import React from 'react';
import { cn } from '../utils/cn';

/**
 * BentoGrid Container
 * Wraps BentoCard children in a responsive CSS grid
 */
export function BentoGrid({
    children,
    columns = 4,
    gap = 16,
    className = '',
    ...props
}) {
    return (
        <div
            className={cn(
                "grid auto-rows-[minmax(120px,auto)]",
                "transition-all duration-300",
                className
            )}
            style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: `${gap}px`,
            }}
            {...props}
        >
            {children}
        </div>
    );
}

/**
 * Size presets for BentoCard
 */
const sizeClasses = {
    sm: 'col-span-1 row-span-1',      // 1×1 - Square small
    md: 'col-span-2 row-span-1',      // 2×1 - Horizontal medium
    lg: 'col-span-2 row-span-2',      // 2×2 - Square large
    xl: 'col-span-3 row-span-2',      // 3×2 - Wide large
    tall: 'col-span-1 row-span-2',    // 1×2 - Vertical tall
    wide: 'col-span-3 row-span-1',    // 3×1 - Wide short
    full: 'col-span-4 row-span-1',    // Full width
};

/**
 * BentoCard - Individual card component for the grid
 */
export function BentoCard({
    size = 'md',
    children,
    className = '',
    title,
    subtitle,
    icon: Icon,
    onClick,
    href,
    gradient,
    glowColor,
    ...props
}) {
    const Wrapper = href ? 'a' : onClick ? 'button' : 'div';
    const isInteractive = href || onClick;

    return (
        <Wrapper
            className={cn(
                // Base styles
                "relative overflow-hidden rounded-[var(--radius-xl)] p-5",
                "bg-[var(--color-bg-white)] border border-[var(--color-border-light)]",
                "shadow-[var(--shadow-card)]",
                "transition-all duration-400 ease-out",

                // Size
                sizeClasses[size] || sizeClasses.md,

                // Interactive states
                isInteractive && [
                    "cursor-pointer",
                    "hover:shadow-[var(--shadow-card-hover)]",
                    "hover:translate-y-[-4px]",
                    "hover:border-[var(--color-border-aurora)]",
                    "active:scale-[0.98]",
                ],

                // Dark mode
                "dark:bg-[var(--color-bg-white)] dark:border-[var(--color-border)]",

                className
            )}
            onClick={onClick}
            href={href}
            {...props}
        >
            {/* Gradient overlay if provided */}
            {gradient && (
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ background: gradient }}
                />
            )}

            {/* Glow effect on hover */}
            {glowColor && (
                <div
                    className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                        background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
                        filter: 'blur(40px)',
                    }}
                />
            )}

            {/* Card header with icon and title */}
            {(Icon || title) && (
                <div className="flex items-start gap-3 mb-3 relative z-10">
                    {Icon && (
                        <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-bg-hover)] text-[var(--color-primary)]">
                            <Icon size={20} />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        {title && (
                            <h3 className="font-semibold text-[var(--color-text-main)] text-sm leading-tight truncate">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Card content */}
            <div className="relative z-10 flex-1">
                {children}
            </div>
        </Wrapper>
    );
}

/**
 * BentoCardSkeleton - Loading placeholder for BentoCard
 */
export function BentoCardSkeleton({ size = 'md', className = '' }) {
    return (
        <div
            className={cn(
                "rounded-[var(--radius-xl)] p-5",
                "bg-[var(--color-bg-white)] border border-[var(--color-border-light)]",
                "animate-pulse",
                sizeClasses[size] || sizeClasses.md,
                className
            )}
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-bg-active)]" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--color-bg-active)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--color-bg-active)] rounded w-1/2" />
                </div>
            </div>
            <div className="space-y-2">
                <div className="h-3 bg-[var(--color-bg-active)] rounded" />
                <div className="h-3 bg-[var(--color-bg-active)] rounded w-5/6" />
            </div>
        </div>
    );
}

/**
 * Responsive Bento Grid wrapper with automatic column adjustment
 */
export function ResponsiveBentoGrid({ children, className = '', ...props }) {
    return (
        <div
            className={cn(
                "grid gap-4",
                // Responsive columns
                "grid-cols-1",           // Mobile: 1 column
                "sm:grid-cols-2",        // Small: 2 columns
                "md:grid-cols-3",        // Medium: 3 columns  
                "lg:grid-cols-4",        // Large: 4 columns
                "xl:grid-cols-4",        // XL: 4 columns
                "auto-rows-[minmax(120px,auto)]",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export default BentoGrid;
