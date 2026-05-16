import React, { useState, useCallback } from 'react';
import { ImageIcon, MapPin } from 'lucide-react';
import { ImageLightbox } from '../../chat/components/ImageMessage';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';
import { buildMomentImageFallback, isRenderableMomentImage, buildProxiedUrls } from '../services/momentsMediaService';

const MIN_ASPECT_RATIO = 3 / 4;
const MAX_ASPECT_RATIO = 4 / 3;

function clampAspectRatio(ratio) {
    if (!ratio || ratio <= 0) return 1;
    return Math.min(Math.max(ratio, MIN_ASPECT_RATIO), MAX_ASPECT_RATIO);
}

function formatAspectStyle(ratio) {
    const clamped = clampAspectRatio(ratio);
    return { aspectRatio: `${clamped.toFixed(4)} / 1` };
}

/** Animated skeleton placeholder while image loads */
function ImageSkeleton({ isSingle }) {
    return (
        <div
            className={cn(
                'rounded-[18px] bg-[var(--color-bg-active)] animate-pulse',
                isSingle ? 'aspect-[4/3]' : 'aspect-square'
            )}
        >
            <div className="flex h-full items-center justify-center">
                <ImageIcon size={24} className="text-[var(--color-text-muted)] opacity-30" />
            </div>
        </div>
    );
}

/**
 * MomentImage: multi-level proxy with skeleton loading state.
 * Tries URLs in order: original → weserv proxy → wsrv proxy → cache-bust.
 */
function MomentImage({ src, index, totalCount, onFail, onClick, language }) {
    const proxiedUrls = buildProxiedUrls(src);
    const [urlIndex, setUrlIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [hasFailed, setHasFailed] = useState(false);
    const [naturalRatio, setNaturalRatio] = useState(null);

    const currentSrc = proxiedUrls[urlIndex] || src;

    const handleLoad = useCallback((e) => {
        const img = e.currentTarget;
        setIsLoading(false);
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setNaturalRatio(img.naturalWidth / img.naturalHeight);
        }
    }, []);

    const handleError = useCallback(() => {
        const nextIndex = urlIndex + 1;
        if (nextIndex < proxiedUrls.length) {
            setUrlIndex(nextIndex);
        } else {
            setIsLoading(false);
            setHasFailed(true);
            onFail(index);
        }
    }, [urlIndex, proxiedUrls, index, onFail]);

    if (hasFailed) return null;

    const isSingle = totalCount === 1;
    const useAdaptiveRatio = isSingle && naturalRatio;

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-[18px]',
                !useAdaptiveRatio && 'aspect-square'
            )}
            style={useAdaptiveRatio ? formatAspectStyle(naturalRatio) : undefined}
        >
            {/* Skeleton overlay while loading */}
            {isLoading && <ImageSkeleton isSingle={isSingle} />}

            <button
                type="button"
                onClick={onClick}
                aria-label={language === 'zh' ? '查看动态图片' : 'View post image'}
                className={cn(
                    'group absolute inset-0 w-full h-full',
                    isLoading && 'opacity-0 pointer-events-none'
                )}
            >
                <img
                    src={currentSrc}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    onLoad={handleLoad}
                    onError={handleError}
                />
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10 rounded-[18px]" />
                {/* Show proxy badge if loading from proxy */}
                {urlIndex > 0 && !isLoading && (
                    <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] text-white/70">
                        proxy
                    </div>
                )}
            </button>
        </div>
    );
}

function ImageFallbackCard({ post, totalCount, language }) {
    const fallback = buildMomentImageFallback(post, language);
    return (
        <div className={cn(
            'rounded-[18px] border border-[var(--color-border)] bg-gradient-to-br from-[rgba(255,155,84,0.08)] to-[rgba(255,194,153,0.12)] p-4 flex flex-col justify-between',
            totalCount === 1 ? 'aspect-[4/3]' : 'aspect-square'
        )}>
            <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                <ImageIcon size={18} />
                {post?.location && (
                    <span className="inline-flex items-center gap-1 text-[11px]">
                        <MapPin size={11} />
                        {post.location}
                    </span>
                )}
            </div>
            <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    {fallback.eyebrow}
                </p>
                <p className="mt-1.5 text-[13px] font-semibold leading-tight text-[var(--color-text-main)] line-clamp-3">
                    {fallback.title}
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-[var(--color-text-muted)] line-clamp-2">
                    {fallback.description}
                </p>
            </div>
        </div>
    );
}

export default function MomentMediaGrid({ post }) {
    const { language } = useLanguage();
    const [failedIndexes, setFailedIndexes] = useState([]);
    const [activeImage, setActiveImage] = useState(null);

    const allImages = (Array.isArray(post?.images) ? post.images : [])
        .filter(isRenderableMomentImage)
        .slice(0, 9);

    if (allImages.length === 0) return null;

    const totalCount = allImages.length;
    const handleFail = (index) => {
        setFailedIndexes(prev => prev.includes(index) ? prev : [...prev, index]);
    };

    const successCount = allImages.filter((_, i) => !failedIndexes.includes(i)).length;

    return (
        <>
            <div className={cn(
                'grid gap-1.5 mt-3',
                successCount === 1 && 'grid-cols-1 max-w-[min(100%,24rem)]',
                successCount === 2 && 'grid-cols-2 max-w-[min(100%,30rem)]',
                successCount >= 3 && 'grid-cols-3'
            )}>
                {allImages.map((image, index) => {
                    const hasFailed = failedIndexes.includes(index);
                    if (hasFailed) {
                        return (
                            <ImageFallbackCard
                                key={`fallback-${index}`}
                                post={post}
                                totalCount={totalCount}
                                language={language}
                            />
                        );
                    }
                    return (
                        <MomentImage
                            key={`${image}-${index}`}
                            src={image}
                            index={index}
                            totalCount={totalCount}
                            onFail={handleFail}
                            onClick={() => setActiveImage(image)}
                            language={language}
                        />
                    );
                })}

                {post?.images?.length > 9 && (
                    <div className="flex aspect-square items-center justify-center rounded-[18px] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)]">
                        <span className="text-[14px] font-semibold text-[var(--color-text-muted)]">
                            +{post.images.length - 9}
                        </span>
                    </div>
                )}
            </div>

            <ImageLightbox
                url={activeImage || ''}
                isOpen={Boolean(activeImage)}
                onClose={() => setActiveImage(null)}
            />
        </>
    );
}
