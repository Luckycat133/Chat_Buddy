import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Camera, Hash, Image as ImageIcon, RefreshCw, Smile, Sparkles, X, Zap } from 'lucide-react';
import { useMoments } from './context/MomentsContext';
import { useUser } from '../../context/UserContext';
import { useLanguage } from '../../context/LanguageContext';
import MomentCard from './components/MomentCard';
import MomentsSidebar from './components/MomentsSidebar';
import PostComposer from './components/PostComposer';
import CommentsSheet from './components/CommentsSheet';
import { SkeletonList, SkeletonMomentCard } from '../../components/Skeleton';
import { cn } from '../../utils/cn';

// 从帖子中提取 trending hashtags
function extractTopHashtags(posts, limit = 5) {
    const tagCount = {};
    const RE = /#[\w\u3400-\u9fff-]+/g;
    posts.forEach(p => {
        const tags = (p.content || '').match(RE) || [];
        tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
    });
    return Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t);
}

// 顶部 AI 活跃通知条
function AIActivityBanner({ posts, language }) {
    // Compute time threshold once on mount using lazy initialization
    const [tenMinAgo] = useState(() => Date.now() - 10 * 60 * 1000);

    const activeCount = useMemo(() => {
        const threshold = tenMinAgo;
        const active = posts.filter(p => {
            const recentComment = (p.comments || []).some(
                c => c.authorId !== 'user-me' && new Date(c.createdAt).getTime() > threshold
            );
            const recentLike = (p.likes || []).length > 0 && p.authorId === 'user-me';
            return recentComment || recentLike;
        });
        return active.length;
    }, [posts, tenMinAgo]);

    if (activeCount === 0) return null;

    return (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/6 px-4 py-2.5">
            <Zap size={14} className="flex-shrink-0 text-[var(--color-primary)]" />
            <p className="text-[13px] text-[var(--color-text-main)]">
                {language === 'zh'
                    ? `你的动态最近很活跃，有 ${activeCount} 条帖子收到了 AI 互动。`
                    : `Your feed is active — ${activeCount} post${activeCount > 1 ? 's' : ''} got recent AI engagement.`}
            </p>
        </div>
    );
}

// Tab 筛选条
const TABS = ['all', 'mine', 'ai', 'with-media'];

function FeedTabs({ active, onChange, language }) {
    const labels = {
        all: language === 'zh' ? '全部' : 'All',
        mine: language === 'zh' ? '我的' : 'Mine',
        ai: language === 'zh' ? 'AI 动态' : 'AI Posts',
        'with-media': language === 'zh' ? '有图' : 'Media',
    };
    return (
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
            {TABS.map(tab => (
                <button
                    key={tab}
                    type="button"
                    onClick={() => onChange(tab)}
                    className={cn(
                        'flex-shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all',
                        active === tab
                            ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-sm'
                            : 'bg-[var(--color-bg-white)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-text-main)]'
                    )}
                >
                    {labels[tab]}
                </button>
            ))}
        </div>
    );
}

export default function MomentsPage() {
    const { posts } = useMoments();
    const { userProfile, getDisplayName } = useUser();
    const { t, language } = useLanguage();

    const safePosts = useMemo(() => Array.isArray(posts) ? posts : [], [posts]);
    const safeUserProfile = useMemo(() => (userProfile && typeof userProfile === 'object') ? userProfile : { avatar: null }, [userProfile]);

    const [showComposer, setShowComposer] = useState(false);
    const [composerPrompt, setComposerPrompt] = useState('');
    const [selectedPost, setSelectedPost] = useState(null);
    const [scrolled, setScrolled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeHashtag, setActiveHashtag] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [visibleCount, setVisibleCount] = useState(10);

    // Simulate loading state for smooth entrance animation
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 350);
        return () => clearTimeout(timer);
    }, []);

    // Reset pagination when filters change
    useLayoutEffect(() => { setVisibleCount(10); }, [activeTab, activeHashtag]);

    const sortedPosts = useMemo(() =>
        [...safePosts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        [safePosts]
    );

    const filteredPosts = useMemo(() => {
        let result = sortedPosts;
        if (activeHashtag) {
            result = result.filter(p => p.content?.includes(activeHashtag));
        }
        if (activeTab === 'mine') result = result.filter(p => p.authorId === 'user-me');
        if (activeTab === 'ai') result = result.filter(p => p.authorId !== 'user-me');
        if (activeTab === 'with-media') result = result.filter(p => (p.images || []).length > 0);
        return result;
    }, [sortedPosts, activeHashtag, activeTab]);

    const paginatedPosts = filteredPosts.slice(0, visibleCount);
    const trendingTags = useMemo(() => extractTopHashtags(safePosts), [safePosts]);

    const openComposer = (prompt = '') => {
        setComposerPrompt(prompt);
        setShowComposer(true);
    };

    const closeComposer = () => {
        setShowComposer(false);
        setComposerPrompt('');
    };

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--color-bg-app)]">
            {/* 背景装饰 */}
            <div className="pointer-events-none absolute inset-0 opacity-80">
                <div className="absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(255,163,92,0.18),_transparent_70%)]" />
                <div className="absolute left-[-10%] top-[15%] h-64 w-64 rounded-full bg-[rgba(255,214,183,0.12)] blur-3xl" />
                <div className="absolute right-[-8%] top-[25%] h-80 w-80 rounded-full bg-[rgba(255,180,112,0.10)] blur-3xl" />
            </div>

            <div
                className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pb-24 md:pb-0"
                onScroll={e => setScrolled(e.target.scrollTop > 48)}
            >
                {/* 粘性顶栏 */}
                <div className={cn(
                    'sticky top-0 z-20 border-b px-4 py-4 transition-all duration-300 md:px-6',
                    scrolled
                        ? 'glass-strong border-[var(--color-border-light)] backdrop-blur-xl'
                        : 'border-transparent bg-transparent'
                )}>
                    <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
                        <div>
                            <h1 className="flex items-center gap-2 text-[24px] font-display font-bold text-[var(--color-text-main)]">
                                <Sparkles className="fill-current text-[var(--color-accent-gold)]" size={22} />
                                {t('moments') || '朋友圈'}
                            </h1>
                            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                                {language === 'zh'
                                    ? '把今天值得停一下的片段，写得更好看一点。'
                                    : 'Turn the moments worth pausing for into posts people want to reply to.'}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => openComposer()}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-white)] px-4 py-2 text-[13px] font-bold text-[var(--color-text-main)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <Camera size={16} className="text-[var(--color-primary)]" />
                            <span className="hidden sm:inline">{t('share_moment') || '发布动态'}</span>
                        </button>
                    </div>
                </div>

                {/* 主内容区 */}
                <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 md:px-6">
                    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
                        {/* 侧边栏 */}
                        <div className="order-2 lg:order-1">
                            <MomentsSidebar posts={safePosts} onUsePrompt={openComposer} />
                        </div>

                        {/* 主 Feed */}
                        <div className="order-1 space-y-4 lg:order-2">

                            {/* 发帖入口 */}
                            <section className="overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[linear-gradient(160deg,rgba(255,255,255,0.99),rgba(255,247,241,0.96))] shadow-[0_12px_40px_rgba(255,157,74,0.08)]">
                                <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center md:px-6">
                                    {/* 快速发帖按钮 */}
                                    <button
                                        type="button"
                                        onClick={() => openComposer()}
                                        className="group flex flex-1 items-center gap-3 rounded-[22px] border border-[var(--color-border)] bg-white/80 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-[12px] bg-[var(--color-bg-active)]">
                                            {safeUserProfile.avatar ? (
                                                <img src={safeUserProfile.avatar} alt="you" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center font-bold text-[var(--color-primary)]">
                                                    {getDisplayName(language).charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 rounded-full bg-[var(--color-bg-app)] px-4 py-2.5 text-[14px] text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text-main)]">
                                            {t('share_thoughts') || (language === 'zh' ? '有什么想跟大家分享的？' : "What's on your mind today?")}
                                        </div>
                                    </button>

                                    {/* 快速动作按钮 */}
                                    <div className="flex flex-shrink-0 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openComposer(language === 'zh'
                                                ? '刚才有个瞬间突然让我想慢下来，于是决定先把它记住。'
                                                : 'A tiny moment slowed me down today, so I wanted to save it before it disappeared.'
                                            )}
                                            className="flex items-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-white/80 px-3 py-2.5 text-[13px] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)]"
                                        >
                                            <ImageIcon size={15} />
                                            <span className="hidden xs:inline">{language === 'zh' ? '写瞬间' : 'Scene'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openComposer(language === 'zh'
                                                ? '今天最想分享的不是大事，而是那个让我一下开心起来的小细节。'
                                                : 'The thing I want to share most today is not a big event, but a tiny detail that lifted my mood.'
                                            )}
                                            className="flex items-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-white/80 px-3 py-2.5 text-[13px] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)]"
                                        >
                                            <Smile size={15} />
                                            <span className="hidden xs:inline">{language === 'zh' ? '发心情' : 'Mood'}</span>
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* AI 活跃通知条 */}
                            {!isLoading && <AIActivityBanner posts={safePosts} language={language} />}

                            {/* 热门话题横向滚动 */}
                            {trendingTags.length > 0 && !activeHashtag && (
                                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1">
                                    <span className="flex-shrink-0 text-[12px] font-semibold text-[var(--color-text-muted)]">
                                        <Hash size={12} className="inline" />
                                    </span>
                                    {trendingTags.map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => setActiveHashtag(tag)}
                                            className="flex-shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-white)] px-3 py-1 text-[12px] font-medium text-[var(--color-text-main)] transition-all hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-primary)]"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Tab 筛选条 */}
                            <div className="flex items-center justify-between gap-3">
                                <FeedTabs active={activeTab} onChange={tab => { setActiveTab(tab); setActiveHashtag(null); }} language={language} />
                                {/* 话题筛选状态 */}
                                {activeHashtag && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-[12px] font-semibold text-[var(--color-primary)]">
                                            {activeHashtag}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setActiveHashtag(null)}
                                            className="rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* 帖子列表 */}
                            {isLoading ? (
                                <SkeletonList count={3} skeleton={SkeletonMomentCard} className="space-y-4" />
                            ) : filteredPosts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-white)] px-6 py-20 text-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--color-bg-app)] shadow-inner">
                                        <Camera size={28} className="text-[var(--color-text-muted)]" />
                                    </div>
                                    <h3 className="mt-4 text-[17px] font-bold text-[var(--color-text-main)]">
                                        {activeHashtag
                                            ? (language === 'zh' ? `没有关于 ${activeHashtag} 的动态` : `No posts tagged ${activeHashtag}`)
                                            : (t('no_posts') || (language === 'zh' ? '还没有动态' : 'Nothing here yet'))}
                                    </h3>
                                    <p className="mt-2 max-w-xs text-[13px] leading-6 text-[var(--color-text-muted)]">
                                        {activeHashtag
                                            ? (language === 'zh' ? '换一个话题看看，或者自己发一条来开个头。' : 'Try another topic, or post something new to start the conversation.')
                                            : (t('be_first') || (language === 'zh' ? '成为第一个分享动态的人吧。' : 'Be the first to share a moment with your AI friends.'))}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => openComposer()}
                                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-[13px] font-bold text-[var(--color-on-primary)] transition-all hover:-translate-y-0.5"
                                    >
                                        <Camera size={15} />
                                        {t('share_moment') || (language === 'zh' ? '发布动态' : 'Share a Moment')}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-4">
                                        {paginatedPosts.map((post, index) => (
                                            <div
                                                key={post.id}
                                                className="animate-fade-slide-up"
                                                style={{ animationDelay: `${Math.min(index, 4) * 80}ms` }}
                                            >
                                                <MomentCard
                                                    post={post}
                                                    onCommentClick={setSelectedPost}
                                                    onHashtagClick={tag => {
                                                        setActiveHashtag(tag);
                                                        setActiveTab('all');
                                                        setVisibleCount(10);
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {filteredPosts.length > visibleCount ? (
                                        <button
                                            type="button"
                                            onClick={() => setVisibleCount(c => c + 10)}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-white)] py-3 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)]"
                                        >
                                            <RefreshCw size={14} />
                                            {t('load_more') || (language === 'zh' ? '加载更多' : 'Load more')}
                                            <span className="text-[var(--color-text-light)]">
                                                ({filteredPosts.length - visibleCount} {language === 'zh' ? '条' : 'left'})
                                            </span>
                                        </button>
                                    ) : filteredPosts.length > 0 && visibleCount >= filteredPosts.length && (
                                        <div className="py-4 text-center text-[12px] text-[var(--color-text-muted)]">
                                            {language === 'zh' ? '已经到底啦 ·  · ' : 'You\'ve seen it all · · ·'}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 发帖弹窗 */}
            <PostComposer
                isOpen={showComposer}
                onClose={closeComposer}
                initialPrompt={composerPrompt}
            />

            {/* 评论弹窗 */}
            {selectedPost && (
                <CommentsSheet
                    post={selectedPost}
                    onClose={() => setSelectedPost(null)}
                />
            )}
        </div>
    );
}
