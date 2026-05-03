import React, { useState, useCallback } from 'react';
import { ImageIcon, MapPin, RefreshCw } from 'lucide-react';
import { ImageLightbox } from '../../chat/components/ImageMessage';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';
import { buildMomentImageFallback, isRenderableMomentImage } from '../services/momentsMediaService';

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

function MomentImage({ src, index, totalCount, onFail, onClick, language }) {
    const [retryCount, setRetryCount] = useState(0);
    const [currentSrc, setCurrentSrc] = useState(src);
    const [hasFailed, setHasFailed] = useState(false);
    const [naturalRatio, setNaturalRatio] = useState(null);

    const handleLoad = useCallback((e) => {
        const img = e.currentTarget;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setNaturalRatio(img.naturalWidth / img.naturalHeight);
        }
    }, []);

    const handleError = useCallback(() => {
        if (retryCount < 2 && /^https?:\/\//i.test(currentSrc)) {
            const sep = currentSrc.includes('?') ? '&' : '?';
            setCurrentSrc(`${src}${sep}_r=${retryCount + 1}`);
            setRetryCount(c => c + 1);
        } else {
            setHasFailed(true);
            onFail(index);
        }
    }, [retryCount, currentSrc, src, index, onFail]);

    if (hasFailed) return null;

    const isSingle = totalCount === 1;
    const useAdaptiveRatio = isSingle && naturalRatio;

    return (
        <button
            key={`img-${index}`}
            type="button"
            onClick={onClick}
            aria-label={language === 'zh' ? '查看动态图片' : 'View post image'}
            className={cn(
                'group relative overflow-hidden rounded-[18px] bg-[var(--color-bg-app)]',
                !useAdaptiveRatio && 'aspect-square'
            )}
            style={useAdaptiveRatio ? formatAspectStyle(naturalRatio) : undefined}
        >
            <img
                src={currentSrc}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                onLoad={handleLoad}
                onError={handleError}
            />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/8" />
            {retryCount > 0 && (
                <div className="absolute right-2 top-2 rounded-full bg-black/40 p-1">
                    <RefreshCw size={11} className="text-white animate-spin" />
                </div>
            )}
        </button>
    );
}

function ImageFallbackCard({ post, totalCount, language }) {
    const fallback = buildMomentImageFallback(post, language);
    return (
        <div className={cn(
            'rounded-[18px] border border-[var(--color-border)] bg-gradient-to-br from-[rgba(255,157,74,0.08)] to-[rgba(255,214,183,0.12)] p-4 flex flex-col justify-between',
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
    const failedCount = failedIndexes.length;

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

                {post?.images?.length > 9 && failedCount === 0 && (
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
