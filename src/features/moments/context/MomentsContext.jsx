import React, { createContext, useEffect, useRef, useCallback } from 'react';
import { INITIAL_PERSONAS } from '../../../data/personas';
import { MomentsStateProvider, useMomentsState } from './MomentsState';
import { MomentsActionProvider, useMomentsActions } from './MomentsActions';
import { evaluateInterestMatch, getTodayEvents } from '../services/momentsService';

const MomentsContext = createContext();

// Facade Hook
// eslint-disable-next-line react-refresh/only-export-components
export const useMoments = () => {
    const state = useMomentsState();
    const actions = useMomentsActions();

    // Selectors / Helpers
    const getAuthor = useCallback((authorId) => {
        if (authorId === 'user-me') {
            return { id: 'user-me', name: 'You', name_zh: '我', avatar: null };
        }
        return INITIAL_PERSONAS.find(p => p.id === authorId) || { id: authorId, name: 'Unknown', avatar: null };
    }, []);

    const getImageApiConfig = useCallback(() => {
        return {
            apiKey: state.imageApiKey || '',
            apiUrl: state.imageApiUrl || ''
        };
    }, [state.imageApiKey, state.imageApiUrl]);

    const getAIAccessibleContent = useCallback((aiId) => {
        const posts = state.posts || [];
        // Get AI's own posts
        const ownPosts = posts.filter(p => p.authorId === aiId).slice(0, 5);
        // Get posts AI has interacted with
        const interactedPosts = posts.filter(p =>
            p.likes.includes(aiId) ||
            p.comments.some(c => c.authorId === aiId)
        ).slice(0, 5);
        // Get recent user posts
        const userPosts = posts.filter(p => p.authorId === 'user-me').slice(0, 3);

        return {
            ownPosts,
            interactedPosts,
            userPosts,
            summary: `${ownPosts.length} own posts, ${interactedPosts.length} interactions, ${userPosts.length} user posts`
        };
    }, [state.posts]);

    return {
        ...state,
        ...actions,
        getAuthor,
        getImageApiConfig,
        getAIAccessibleContent,
    };
};

export const MomentsProvider = ({ children }) => {
    return (
        <MomentsStateProvider>
            <InternalMomentsProvider>
                {children}
            </InternalMomentsProvider>
        </MomentsStateProvider>
    );
};

// Internal provider to access state/actions for AI Hook
const InternalMomentsProvider = ({ children }) => {
    const { momentsData, setMomentsData } = useMomentsState();

    return (
        <MomentsActionProvider momentsData={momentsData} setMomentsData={setMomentsData}>
            <MomentsAIOrchestrator />
            {children}
        </MomentsActionProvider>
    );
};

// Component to run AI hooks (needs access to both State and Actions)
const MomentsAIOrchestrator = () => {
    const { posts, lastAIPostTime, lastStoryEventDate } = useMomentsState();
    const { generateDynamicAIPost, generateAIComment, toggleLike, addReaction, generateStoryPost } = useMomentsActions();
    const { setMomentsData } = useMomentsState();

    useMomentsAI({
        posts,
        lastAIPostTime,
        generateDynamicAIPost,
        generateAIComment,
        toggleLike,
        addReaction
    });

    useStoryEvents({
        posts,
        lastStoryEventDate,
        generateStoryPost,
        setMomentsData,
    });

    return null;
};

// -----------------------------------------------------------------------------
// AI ORCHESTRATION HOOK
// -----------------------------------------------------------------------------
function useMomentsAI({ posts, lastAIPostTime, generateDynamicAIPost, generateAIComment, toggleLike, addReaction }) {

    const aiPostIntervalRef = useRef(null);
    const aiInteractionIntervalRef = useRef(null);
    const processedPostIdsRef = useRef(new Set());

    // Evaluate if AI should like a post
    const evaluateShouldLike = useCallback((post, aiId) => {
        const persona = INITIAL_PERSONAS.find(p => p.id === aiId);
        if (!persona) return false;

        // High chance for user posts
        if (post.authorId === 'user-me') return Math.random() > 0.3;

        // Check interests
        if (evaluateInterestMatch(post.content, persona.interests)) {
            return Math.random() > 0.2;
        }
        return Math.random() > 0.6;
    }, []);

    // Trigger AI interactions on a specific post
    const _triggerAIInteractions = useCallback(async (postId, currentPosts) => {
        const post = currentPosts.find(p => p.id === postId);
        if (!post) return;

        const shuffledPersonas = [...INITIAL_PERSONAS].sort(() => Math.random() - 0.5);
        const interactors = shuffledPersonas.slice(0, 3 + Math.floor(Math.random() * 4));

        for (let i = 0; i < interactors.length; i++) {
            const persona = interactors[i];
            const delay = (i + 1) * (2000 + Math.random() * 4000);

            setTimeout(async () => {
                // Like
                if (evaluateShouldLike(post, persona.id)) {
                    toggleLike(postId, persona.id);
                }
                // React
                if (Math.random() > 0.7) {
                    const emojis = ['😂', '❤️', '👍', '🔥', '😮', '😢'];
                    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                    addReaction(postId, emoji, persona.id);
                }
                // Comment
                if (Math.random() > 0.6) {
                    // Need fresh posts snapshot for comment generation? 
                    // `generateAIComment` uses `callMomentsAI`.
                    // We need to pass the *current* posts to `generateAIComment`?
                    // In `MomentsActions`, `generateAIComment` accepts a snapshot. 
                    // But here we rely on the closure `posts` or we need access to fresh `posts` via ref?
                    // The hook re-runs when `posts` changes, so `triggerAIInteractions` is recreated.
                    // But `setTimeout` closure might capture OLD `triggerAIInteractions` scope...
                    // Wait, `triggerAIInteractions` is called with `currentPosts`.
                    // But `generateAIComment` implementation in Actions (which I defined in prev step) 
                    // assumed it will be passed a snapshot OR uses state? 
                    // In my previous step, I defined `generateAIComment` to take `postsSnapshot`.

                    // Wait, looking at `MomentsActions.jsx` I wrote:
                    // `const generateAIComment = useCallback(async (postId, aiId, replyToComment = null, postsSnapshot) => { ...`
                    // So I MUST pass `posts` (which is passed to this hook) to it.

                    // The issue is `posts` inside `setTimeout` will be STALE.
                    // I need a ref to posts.

                    // But `triggerAIInteractions` is only called from effects where we pass explicit post list or
                    // we use a Ref.

                    // Actually, let's keep it simple. It's okay if it's slightly stale for comments context,
                    // or I should maintain a `postsRef`.

                    // For now, assume `generateAIComment` handles it or I pass the `post` object directly?
                    // `generateAIComment` finds the post by ID from `postsSnapshot`.

                    // Let's use a ref for posts in this hook.

                }
            }, delay);
        }
    }, [evaluateShouldLike, toggleLike, addReaction]); // Missing `posts` dependency usually, but we handle it via Ref

    const postsRef = useRef(posts);
    useEffect(() => { postsRef.current = posts; }, [posts]);

    const triggerAIInteractionsWithRef = useCallback((postId) => {
        const currentPosts = postsRef.current;
        const post = currentPosts.find(p => p.id === postId);
        if (!post) return;

        const shuffledPersonas = [...INITIAL_PERSONAS].sort(() => Math.random() - 0.5);
        const interactors = shuffledPersonas.slice(0, 3 + Math.floor(Math.random() * 4));

        interactors.forEach((persona, i) => {
            const delay = (i + 1) * (2000 + Math.random() * 4000);
            setTimeout(async () => {
                if (evaluateShouldLike(post, persona.id)) {
                    toggleLike(postId, persona.id);
                }
                if (Math.random() > 0.7) {
                    const emojis = ['😂', '❤️', '👍', '🔥', '😮', '😢'];
                    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                    addReaction(postId, emoji, persona.id);
                }
                if (Math.random() > 0.6) {
                    await generateAIComment(postId, persona.id, null, postsRef.current);
                }
            }, delay);
        });
    }, [evaluateShouldLike, toggleLike, addReaction, generateAIComment]);

    // Effect: Detect new user posts
    useEffect(() => {
        if (!posts.length) return;
        const latestPost = posts[0]; // Assuming NEWEST first

        if (latestPost.authorId === 'user-me' && !processedPostIdsRef.current.has(latestPost.id)) {
            // It's a new user post!
            processedPostIdsRef.current.add(latestPost.id);
            setTimeout(() => triggerAIInteractionsWithRef(latestPost.id), 2000 + Math.random() * 5000);
        }
    }, [posts, triggerAIInteractionsWithRef]);

    // Periodic AI Posts
    const checkAIPosts = useCallback(async () => {
        const now = Date.now();
        const MIN_INTERVAL = 30 * 60 * 1000;
        const MAX_INTERVAL = 2 * 60 * 60 * 1000;

        for (const persona of INITIAL_PERSONAS) {
            const lastPost = lastAIPostTime[persona.id] || 0;
            const interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);

            if (now - lastPost > interval) {
                if (Math.random() > 0.85) {
                    await generateDynamicAIPost(persona.id);
                    break;
                }
            }
        }
    }, [lastAIPostTime, generateDynamicAIPost]);

    // Periodic Mutual Interactions
    const triggerAIMutualInteraction = useCallback(async () => {
        const currentPosts = postsRef.current;
        const recentAIPosts = currentPosts
            .filter(p => p.authorId !== 'user-me' && p.authorId.startsWith('ai-'))
            .slice(0, 10);

        if (recentAIPosts.length === 0) return;

        const randomPost = recentAIPosts[Math.floor(Math.random() * recentAIPosts.length)];
        const otherAIs = INITIAL_PERSONAS.filter(p => p.id !== randomPost.authorId);

        if (otherAIs.length > 0 && Math.random() > 0.7) {
            const randomAI = otherAIs[Math.floor(Math.random() * otherAIs.length)];
            const hasLiked = randomPost.likes.includes(randomAI.id);
            const hasCommented = randomPost.comments.some(c => c.authorId === randomAI.id);

            if (!hasLiked && !hasCommented) {
                if (Math.random() > 0.4) {
                    toggleLike(randomPost.id, randomAI.id);
                }
                if (Math.random() > 0.6) {
                    await generateAIComment(randomPost.id, randomAI.id, null, currentPosts);
                }
            }
        }
    }, [toggleLike, generateAIComment]);

    // Intervals
    useEffect(() => {
        aiPostIntervalRef.current = setInterval(checkAIPosts, 10 * 60 * 1000);
        aiInteractionIntervalRef.current = setInterval(triggerAIMutualInteraction, 15 * 60 * 1000);

        return () => {
            clearInterval(aiPostIntervalRef.current);
            clearInterval(aiInteractionIntervalRef.current);
        };
    }, [checkAIPosts, triggerAIMutualInteraction]);

    // Init AI posts if empty
    useEffect(() => {
        if (posts.length === 0) {
            const initialAIs = [...INITIAL_PERSONAS].sort(() => Math.random() - 0.5).slice(0, 4);
            initialAIs.forEach((persona, index) => {
                setTimeout(() => generateDynamicAIPost(persona.id), index * 2000);
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once
}

// -----------------------------------------------------------------------------
// STORY EVENTS HOOK (birthday & seasonal holiday posts)
// -----------------------------------------------------------------------------
function useStoryEvents({ posts, lastStoryEventDate, generateStoryPost, setMomentsData }) {
    useEffect(() => {
        const today = new Date().toDateString();
        if (lastStoryEventDate === today) return; // Already ran today

        const { birthdays, holiday } = getTodayEvents();
        if (birthdays.length === 0 && !holiday) return;

        // Mark today as processed first to prevent re-runs on hot reload
        setMomentsData(prev => ({ ...prev, lastStoryEventDate: today }));

        const alreadyPostedToday = (aiId) => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            return posts.some(
                p => p.authorId === aiId && new Date(p.createdAt) >= todayStart
            );
        };

        // Birthday posts
        birthdays.forEach((aiId, i) => {
            if (alreadyPostedToday(aiId)) return;
            setTimeout(() => {
                generateStoryPost(aiId, 'birthday', null);
            }, (i + 1) * 3000);
        });

        // Holiday posts — pick 2 random personas
        if (holiday) {
            const candidates = [...INITIAL_PERSONAS]
                .sort(() => Math.random() - 0.5)
                .slice(0, 2)
                .filter(p => !alreadyPostedToday(p.id));
            candidates.forEach((persona, i) => {
                setTimeout(() => {
                    generateStoryPost(persona.id, 'holiday', holiday.nameEn);
                }, (birthdays.length + i + 1) * 3000);
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount
}
