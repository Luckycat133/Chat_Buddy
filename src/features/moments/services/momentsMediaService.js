export function isRenderableMomentImage(src = '') {
    if (typeof src !== 'string') return false;
    const normalized = src.trim();
    if (!normalized) return false;
    return /^(data:image\/|blob:|https?:\/\/|\/)/i.test(normalized);
}

/**
 * 构建多级代理 URL 列表。
 * 返回顺序：原始 → weserv.nl 代理 → 再尝试原始（带 cache bust）
 */
export function buildProxiedUrls(src) {
    if (typeof src !== 'string' || !/^https?:\/\//i.test(src)) return [src];

    const encoded = encodeURIComponent(src);
    return [
        src,
        `https://images.weserv.nl/?url=${encoded}&default=1`,
        `https://wsrv.nl/?url=${encoded}`,
        `${src}${src.includes('?') ? '&' : '?'}_cb=${Date.now()}`,
    ];
}

export function buildMomentImageFallback(post, language = 'zh') {
    const content = String(post?.content || '').trim();
    const location = String(post?.location || '').trim();
    const storyTitle = String(post?.storyTitle || '').trim();
    const previewText = storyTitle || (content.length > 60 ? `${content.slice(0, 60)}…` : content);

    if (language === 'zh') {
        return {
            eyebrow: location || '配图',
            title: previewText || '图片内容暂不可用',
            description: '图片加载受限，但帖子正文和互动功能完全正常。',
        };
    }

    return {
        eyebrow: location || 'Media',
        title: previewText || 'Image unavailable',
        description: 'The image could not be displayed, but the post and all interactions still work.',
    };
}
