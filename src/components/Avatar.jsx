import React, { useState, useMemo } from 'react';
import { cn } from '../utils/cn';

const FALLBACK_AVATARS = {
    'social-companion': '/avatars/default_female.png',
    'task-specialist': '/avatars/default_robot.png',
    'default': '/avatars/default_cat.png'
};

const AVATAR_COLORS = {
    'ai-1': 'from-purple-400 to-pink-400',
    'ai-2': 'from-blue-400 to-cyan-400',
    'ai-3': 'from-orange-400 to-amber-400',
    'ai-4': 'from-slate-400 to-gray-500',
    'ai-5': 'from-green-400 to-emerald-400',
    'ai-miku': 'from-cyan-400 to-teal-400',
    'ai-rem': 'from-blue-300 to-indigo-400',
    'ai-rin': 'from-red-400 to-rose-500',
    'ai-naruto': 'from-orange-400 to-yellow-400',
    'ai-l': 'from-gray-400 to-slate-500',
    'ai-zerotwo': 'from-pink-400 to-rose-400',
    'ai-asuna': 'from-amber-300 to-orange-400',
    'ai-gojo': 'from-indigo-400 to-violet-500',
    'agent-coder': 'from-emerald-400 to-teal-500',
    'agent-muse': 'from-violet-400 to-purple-500',
    'agent-scholar': 'from-amber-400 to-yellow-500',
    'agent-sensei': 'from-sky-400 to-blue-500',
    'agent-aurora': 'from-rose-400 to-pink-500',
    'agent-pixel': 'from-fuchsia-400 to-pink-500'
};

export default function Avatar({
    src,
    alt,
    name,
    id,
    _agentType = 'social-companion',
    size = 'md',
    className,
    showStatus = false,
    status = 'online',
    onClick
}) {
    const [imageError, setImageError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const sizeClasses = {
        xs: 'w-8 h-8',
        sm: 'w-10 h-10',
        md: 'w-12 h-12',
        lg: 'w-14 h-14',
        xl: 'w-16 h-16',
        '2xl': 'w-20 h-20'
    };

    const statusColors = {
        online: 'bg-[var(--color-success)]',
        offline: 'bg-slate-400',
        busy: 'bg-orange-400',
        'do-not-disturb': 'bg-red-400',
        away: 'bg-yellow-400'
    };

    const gradientClass = useMemo(() => {
        return AVATAR_COLORS[id] || 'from-[var(--color-primary)] to-[var(--color-accent-lavender)]';
    }, [id]);

    const initial = useMemo(() => {
        if (name) return name.charAt(0).toUpperCase();
        return '?';
    }, [name]);

    const handleImageLoad = () => {
        setIsLoading(false);
    };

    const handleImageError = () => {
        setImageError(true);
        setIsLoading(false);
    };

    const avatarContent = (
        <div className={cn(
            "relative overflow-hidden rounded-2xl shadow-glass-sm transition-all duration-300",
            sizeClasses[size],
            className
        )}>
            {isLoading && (
                <div className={cn(
                    "absolute inset-0 animate-pulse bg-gradient-to-br",
                    gradientClass
                )} />
            )}

            {!imageError && src ? (
                <img
                    src={src}
                    alt={alt || name || 'Avatar'}
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-300",
                        isLoading ? "opacity-0" : "opacity-100"
                    )}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    loading="eager"
                />
            ) : (
                <div className={cn(
                    "w-full h-full flex items-center justify-center bg-gradient-to-br font-bold text-white",
                    gradientClass
                )}>
                    {initial}
                </div>
            )}

            {showStatus && (
                <div className={cn(
                    "absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 shadow-sm",
                    statusColors[status]
                )} />
            )}
        </div>
    );

    if (onClick) {
        return (
            <button
                onClick={onClick}
                className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl"
            >
                {avatarContent}
            </button>
        );
    }

    return avatarContent;
}

export function AvatarGroup({ avatars, max = 4, size = 'sm' }) {
    const displayed = avatars.slice(0, max);
    const remaining = avatars.length - max;

    return (
        <div className="flex -space-x-2">
            {displayed.map((avatar, index) => (
                <div key={avatar.id || index} className="ring-2 ring-white dark:ring-slate-800 rounded-2xl">
                    <Avatar
                        src={avatar.src}
                        name={avatar.name}
                        id={avatar.id}
                        size={size}
                    />
                </div>
            ))}
            {remaining > 0 && (
                <div className={cn(
                    "flex items-center justify-center bg-[var(--color-bg-app)] rounded-2xl ring-2 ring-white dark:ring-slate-800",
                    size === 'sm' ? 'w-10 h-10' : 'w-12 h-12'
                )}>
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                        +{remaining}
                    </span>
                </div>
            )}
        </div>
    );
}
