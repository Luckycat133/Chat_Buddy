import React, { useMemo } from 'react';
import { Camera, Hash, MessageCircle, Repeat2, Sparkles, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { buildPersonalizedMomentRecommendations } from '../services/momentsContentService';

// 提取所有 hashtag 并统计频次
function extractTrendingTags(posts = []) {
    const tagCount = {};
    const HASHTAG_RE = /#[\w\u3400-\u9fff-]+/g;

    posts.forEach(post => {
        const text = `${post.content || ''} ${(post.hashtags || []).join(' ')}`;
        const tags = text.match(HASHTAG_RE) || [];
        tags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
    });

    return Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([tag, count]) => ({ tag, count }));
}

function StatCard({ icon: _Icon, label, value, accent }) {
    return (
        <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-white)] px-3 py-3 shadow-sm ${accent ? 'border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5' : ''}`}>
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <_Icon size={14} />
                <span className="text-[11px] leading-none">{label}</span>
            </div>
            <div className="mt-2 text-[22px] font-bold tabular-nums text-[var(--color-text-main)]">
                {value}
            </div>
        </div>
    );
}

export default function MomentsSidebar({ posts = [], onUsePrompt }) {
    const { language } = useLanguage();
    const recommendations = buildPersonalizedMomentRecommendations(posts, language);

    const trendingTags = useMemo(() => extractTrendingTags(posts), [posts]);

    const userPosts = posts.filter(post => post.authorId === 'user-me').length;
    const aiComments = posts.reduce((count, post) => {
        return count + (post.comments || []).filter(c => c.authorId !== 'user-me').length;
    }, 0);
    const shareCount = posts.reduce((count, post) => count + (post.shareCount || 0), 0);
    const totalLikes = posts.filter(p => p.authorId === 'user-me').reduce((sum, p) => sum + (p.likes || []).length, 0);

    return (
        <aside className="space-y-4 lg:sticky lg:top-24">
            {/* AI 灵感站 */}
            <div className="overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-bg-white)] p-5 shadow-[0_12px_40px_rgba(255,157,74,0.10)]">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,157,74,0.12)] px-3 py-1 text-[12px] font-semibold text-[var(--color-primary)]">
                    <Sparkles size={13} />
                    {language === 'zh' ? 'AI 灵感站' : 'AI Inspiration'}
                </div>

                <h2 className="mt-4 text-[22px] font-bold leading-snug text-[var(--color-text-main)]">
                    {language === 'zh'
                        ? '让下一条动态\n更值得被回复'
                        : 'Make the next post\nearly to reply to'}
                </h2>

                <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-muted)]">
                    {language === 'zh'
                        ? '根据你的动态节奏，推荐几个更容易引发互动的切入角度。'
                        : 'Prompts tuned to your feed to spark more conversation.'}
                </p>

                <div className="mt-4 space-y-2.5">
                    {recommendations.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onUsePrompt?.(item.prompt)}
                            className="group w-full rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-app)] px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]/30 hover:shadow-md"
                        >
                            <div className="text-[13px] font-semibold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)]">
                                {item.title}
                            </div>
                            <div className="mt-1 text-[12px] leading-5 text-[var(--color-text-muted)] line-clamp-2">
                                {item.prompt}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 热门话题 */}
            {trendingTags.length > 0 && (
                <div className="overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-bg-white)] p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--color-text-main)]">
                        <TrendingUp size={16} className="text-[var(--color-primary)]" />
                        {language === 'zh' ? '热门话题' : 'Trending Topics'}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {trendingTags.map(({ tag, count }) => (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => onUsePrompt?.(tag + ' ')}
                                className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-[12px] transition-all hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5"
                            >
                                <Hash size={11} className="text-[var(--color-primary)]" />
                                <span className="font-medium text-[var(--color-text-main)]">{tag.replace('#', '')}</span>
                                <span className="text-[var(--color-text-muted)]">{count}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 我的数据 */}
            <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-bg-white)] p-5 shadow-sm">
                <div className="text-[13px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                    {language === 'zh' ? '我的动态数据' : 'My Activity'}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                    <StatCard
                        icon={Camera}
                        label={language === 'zh' ? '我发布的' : 'My posts'}
                        value={userPosts}
                        accent
                    />
                    <StatCard
                        icon={MessageCircle}
                        label={language === 'zh' ? 'AI 评论' : 'AI replies'}
                        value={aiComments}
                    />
                    <StatCard
                        icon={Repeat2}
                        label={language === 'zh' ? '被转发' : 'Shares'}
                        value={shareCount}
                    />
                    <StatCard
                        icon={Sparkles}
                        label={language === 'zh' ? '收到的赞' : 'Likes got'}
                        value={totalLikes}
                        accent={totalLikes > 0}
                    />
                </div>
            </div>
        </aside>
    );
}
