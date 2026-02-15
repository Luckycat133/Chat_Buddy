import React from 'react';
import { cn } from '../utils/cn';

const shimmerClass = "animate-pulse bg-gradient-to-r from-[var(--color-gray-200)] via-[var(--color-gray-100)] to-[var(--color-gray-200)] dark:from-[var(--color-gray-800)] dark:via-[var(--color-gray-700)] dark:to-[var(--color-gray-800)] bg-[length:200%_100%]";

export function Skeleton({ className, ...props }) {
    return (
        <div
            className={cn(
                shimmerClass,
                "rounded-[var(--radius-md)]",
                className
            )}
            {...props}
        />
    );
}

export function SkeletonCircle({ className, ...props }) {
    return (
        <div
            className={cn(
                shimmerClass,
                "rounded-full",
                className
            )}
            {...props}
        />
    );
}

export function SkeletonText({ lines = 3, className, ...props }) {
    return (
        <div className={cn("space-y-2", className)} {...props}>
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        shimmerClass,
                        "h-4 rounded-[var(--radius-sm)]",
                        i === lines - 1 && "w-3/4"
                    )}
                    style={{ animationDelay: `${i * 100}ms` }}
                />
            ))}
        </div>
    );
}

export function SkeletonAvatar({ size = "md", className }) {
    const sizeClasses = {
        sm: "w-8 h-8",
        md: "w-12 h-12",
        lg: "w-16 h-16",
        xl: "w-20 h-20"
    };

    return (
        <SkeletonCircle className={cn(sizeClasses[size], className)} />
    );
}

export function SkeletonChatCard({ className }) {
    return (
        <div className={cn(
            "flex items-center gap-4 p-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-white)]/40",
            className
        )}>
            <SkeletonAvatar size="lg" />
            <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-3 w-full" />
            </div>
        </div>
    );
}

export function SkeletonFriendCard({ className }) {
    return (
        <div className={cn(
            "card p-4 flex items-center animate-fade-slide-up",
            className
        )}>
            <SkeletonAvatar size="lg" className="mr-4" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
            </div>
        </div>
    );
}

export function SkeletonMomentCard({ className }) {
    return (
        <div className={cn(
            "card p-5 space-y-4 animate-fade-slide-up",
            className
        )}>
            <div className="flex items-center gap-3">
                <SkeletonAvatar size="md" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
            <SkeletonText lines={2} />
            <Skeleton className="h-48 w-full rounded-[var(--radius-lg)]" />
            <div className="flex gap-4">
                <Skeleton className="h-8 w-16 rounded-full" />
                <Skeleton className="h-8 w-16 rounded-full" />
            </div>
        </div>
    );
}

export function SkeletonMessage({ isMe = false, className }) {
    return (
        <div className={cn(
            "flex gap-3 animate-fade-slide-up",
            isMe ? "flex-row-reverse" : "flex-row",
            className
        )}>
            {!isMe && <SkeletonAvatar size="sm" />}
            <div className={cn(
                "space-y-2 max-w-[70%]",
                isMe ? "items-end" : "items-start"
            )}>
                <Skeleton className={cn(
                    "h-12 rounded-[var(--radius-bubble)]",
                    isMe ? "w-32" : "w-48"
                )} />
            </div>
        </div>
    );
}

export function SkeletonList({ count = 5, skeleton: SkeletonComponent = SkeletonChatCard, className }) {
    const Component = SkeletonComponent;
    return (
        <div className={cn("space-y-3", className)}>
            {Array.from({ length: count }).map((_, i) => (
                <Component
                    key={i}
                    style={{ animationDelay: `${i * 50}ms` }}
                />
            ))}
        </div>
    );
}

export default Skeleton;
