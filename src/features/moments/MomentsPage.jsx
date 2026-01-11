import React, { useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { useMoments } from './context/MomentsContext';
import { useUser } from '../../context/UserContext';
import { useLanguage } from '../../context/LanguageContext';
import MomentCard from './components/MomentCard';
import PostComposer from './components/PostComposer';
import CommentsSheet from './components/CommentsSheet';

export default function MomentsPage() {
    const { posts } = useMoments();
    const { userProfile, getDisplayName } = useUser();
    const { t, language } = useLanguage();

    const [showComposer, setShowComposer] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);

    // Sort posts by date, newest first
    const sortedPosts = [...posts].sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-hidden flex flex-col pb-16 md:pb-0">
            {/* Header with Cover Photo */}
            <div className="relative h-48 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]">
                {/* Cover pattern */}
                <div className="absolute inset-0 opacity-10">
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                <circle fill="white" cx="10" cy="10" r="2" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#dots)" />
                    </svg>
                </div>

                {/* Title */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <h1 className="text-white text-[20px] font-bold drop-shadow-md">
                        {t('moments') || 'Moments'}
                    </h1>
                    <button
                        onClick={() => setShowComposer(true)}
                        className="bg-white/20 backdrop-blur-sm p-2 rounded-full text-white hover:bg-white/30 transition-colors"
                    >
                        <Camera size={22} />
                    </button>
                </div>

                {/* User Profile at bottom right */}
                <div className="absolute bottom-4 right-4 flex items-center gap-3">
                    <span className="text-white font-medium drop-shadow-md">
                        {getDisplayName(language)}
                    </span>
                    <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-[var(--color-primary)]">
                        {userProfile.avatar ? (
                            <img src={userProfile.avatar} alt="You" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                                {getDisplayName(language).charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Posts Feed */}
            <div className="flex-1 overflow-y-auto">
                {sortedPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
                        <Camera size={48} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium">{t('no_posts') || 'No moments yet'}</p>
                        <p className="text-sm mt-1">{t('be_first') || 'Be the first to share!'}</p>
                        <button
                            onClick={() => setShowComposer(true)}
                            className="mt-4 px-6 py-2 bg-[var(--color-primary)] text-white rounded-full font-medium"
                        >
                            {t('post') || 'Post'}
                        </button>
                    </div>
                ) : (
                    sortedPosts.map((post) => (
                        <MomentCard
                            key={post.id}
                            post={post}
                            onCommentClick={setSelectedPost}
                        />
                    ))
                )}
            </div>

            {/* Floating Action Button */}
            <button
                onClick={() => setShowComposer(true)}
                className="fixed bottom-20 right-4 md:bottom-8 w-14 h-14 bg-[var(--color-primary)] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[var(--color-primary-hover)] transition-all z-40"
            >
                <Camera size={24} />
            </button>

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
