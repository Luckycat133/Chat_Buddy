import React, { useState, useEffect } from 'react';
import { Camera, Sparkles, Image as ImageIcon, Video, Smile } from 'lucide-react';
import { useMoments } from './context/MomentsContext';
import { useUser } from '../../context/UserContext';
import { useLanguage } from '../../context/LanguageContext';
import MomentCard from './components/MomentCard';
import PostComposer from './components/PostComposer';
import CommentsSheet from './components/CommentsSheet';
import { SkeletonList, SkeletonMomentCard } from '../../components/Skeleton';
import { cn } from '../../utils/cn';

export default function MomentsPage() {
    const { posts } = useMoments();
    const { userProfile, getDisplayName } = useUser();
    const { t, language } = useLanguage();

    const [showComposer, setShowComposer] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [scrolled, setScrolled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 400);
        return () => clearTimeout(timer);
    }, []);

    // Sort posts by date, newest first
    const sortedPosts = [...posts].sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    const handleScroll = (e) => {
        setScrolled(e.target.scrollTop > 50);
    };

    return (
        <div
            className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto custom-scrollbar relative"
            onScroll={handleScroll}
        >
            {/* Header Background Gradient */}
            <div className="fixed top-0 left-0 right-0 h-[300px] pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(ellipse at top, var(--color-primary-glow) 0%, transparent 70%)' }} />

            {/* Floating Glass Header */}
            <div className={cn(
                "sticky top-0 z-20 px-6 py-4 transition-all duration-300 flex items-center justify-between",
                scrolled ? "glass-strong border-b border-[var(--color-border-light)]" : "bg-transparent"
            )}>
                <h1 className="text-2xl font-display font-bold text-[var(--color-text-main)] flex items-center gap-2 animate-fade-in">
                    <Sparkles className="text-[var(--color-accent-gold)] fill-current" size={24} />
                    {t('moments') || 'Moments'}
                </h1>

                <div onClick={() => setShowComposer(true)}
                    className="flex items-center gap-2 bg-[var(--color-bg-white)] hover:bg-[var(--color-bg-hover)] px-4 py-2 rounded-full cursor-pointer transition-all border border-[var(--color-border)] shadow-sm active:scale-95 group">
                    <Camera size={18} className="text-[var(--color-primary)] group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold text-[var(--color-text-main)] hidden md:block">
                        {language === 'zh' ? '发布动态' : 'Share Moment'}
                    </span>
                </div>
            </div>

            {/* Profile Hero Section (Optional, or integrated into feed) */}
            {/* Keeping it minimal for "Timeline Journey" feel, focus on the feed content */}

            {/* Main Feed */}
            <div className="max-w-2xl mx-auto px-4 pb-24 relative z-10">
                {/* Horizontal "Create" Trigger for Desktop */}
                <div
                    onClick={() => setShowComposer(true)}
                    className="mb-8 p-4 rounded-[var(--radius-xl)] bg-[var(--color-bg-white)] border border-[var(--color-border)] shadow-sm cursor-pointer hover:shadow-md transition-all group animate-fade-slide-up"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-bg-active)] overflow-hidden">
                            {userProfile.avatar ? (
                                <img src={userProfile.avatar} alt="You" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[var(--color-primary)] font-bold">
                                    {getDisplayName(language).charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 bg-[var(--color-bg-app)] rounded-full h-10 flex items-center px-4 text-[var(--color-text-muted)] text-sm group-hover:text-[var(--color-text-main)] transition-colors">
                            {language === 'zh' ? '分享当下的想法...' : 'Share your thoughts...'}
                        </div>
                        <div className="flex gap-3 text-[var(--color-text-muted)]">
                            <ImageIcon size={20} className="hover:text-[var(--color-primary)] transition-colors" />
                            <Smile size={20} className="hover:text-[var(--color-accent-gold)] transition-colors" />
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <SkeletonList count={3} skeleton={SkeletonMomentCard} className="space-y-6" />
                ) : sortedPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center">
                        <div className="w-20 h-20 rounded-[var(--radius-xl)] bg-[var(--color-bg-active)] flex items-center justify-center mb-4 shadow-inner">
                            <Camera size={32} className="text-[var(--color-text-muted)]" />
                        </div>
                        <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-1">
                            {t('no_posts') || 'Your timeline is empty'}
                        </h3>
                        <p className="text-[var(--color-text-muted)] text-sm max-w-xs">
                            {t('be_first') || 'Be the first to capture and share a moment with your AI friends.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {sortedPosts.map((post, index) => (
                            <div key={post.id} style={{ animationDelay: `${index * 100}ms` }} className="animate-fade-slide-up">
                                <MomentCard
                                    post={post}
                                    onCommentClick={setSelectedPost}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Post Composer Modal */}
            <PostComposer
                isOpen={showComposer}
                onClose={() => setShowComposer(false)}
            />

            {/* Comments Sheet */}
            {selectedPost && (
                <CommentsSheet
                    post={selectedPost}
                    onClose={() => setSelectedPost(null)}
                />
            )}
        </div>
    );
}
