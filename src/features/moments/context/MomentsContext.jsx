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
    const timeoutIdsRef = useRef([]);

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
            const timeoutId = setTimeout(async () => {
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
            timeoutIdsRef.current.push(timeoutId);
        });
    }, [evaluateShouldLike, toggleLike, addReaction, generateAIComment]);

    // Effect: Detect new user posts
    useEffect(() => {
        if (!posts.length) return;
        const latestPost = posts[0]; // Assuming NEWEST first

        if (latestPost.authorId === 'user-me' && !processedPostIdsRef.current.has(latestPost.id)) {
            // It's a new user post!
            processedPostIdsRef.current.add(latestPost.id);
            const timeoutId = setTimeout(() => triggerAIInteractionsWithRef(latestPost.id), 2000 + Math.random() * 5000);
            timeoutIdsRef.current.push(timeoutId);
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
            // Clear all pending timeouts
            timeoutIdsRef.current.forEach(id => clearTimeout(id));
            timeoutIdsRef.current = [];
        };
    }, [checkAIPosts, triggerAIMutualInteraction]);

    // Init AI posts if empty
    useEffect(() => {
        if (posts.length === 0) {
            const initialAIs = [...INITIAL_PERSONAS].sort(() => Math.random() - 0.5).slice(0, 4);
            initialAIs.forEach((persona, index) => {
                const timeoutId = setTimeout(() => generateDynamicAIPost(persona.id), index * 2000);
                timeoutIdsRef.current.push(timeoutId);
            });
        }
        return () => {
            // Clear timeouts created in this effect
            timeoutIdsRef.current.forEach(id => clearTimeout(id));
            timeoutIdsRef.current = [];
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once
}

// -----------------------------------------------------------------------------
// STORY EVENTS HOOK (birthday & seasonal holiday posts)
// -----------------------------------------------------------------------------
function useStoryEvents({ posts, lastStoryEventDate, generateStoryPost, setMomentsData }) {
    const timeoutIdsRef = useRef([]);

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
            const timeoutId = setTimeout(() => {
                generateStoryPost(aiId, 'birthday', null);
            }, (i + 1) * 3000);
            timeoutIdsRef.current.push(timeoutId);
        });

        // Holiday posts — pick 2 random personas
        if (holiday) {
            const candidates = [...INITIAL_PERSONAS]
                .sort(() => Math.random() - 0.5)
                .slice(0, 2)
                .filter(p => !alreadyPostedToday(p.id));
            candidates.forEach((persona, i) => {
                const timeoutId = setTimeout(() => {
                    generateStoryPost(persona.id, 'holiday', holiday.nameEn);
                }, (birthdays.length + i + 1) * 3000);
                timeoutIdsRef.current.push(timeoutId);
            });
        }

        return () => {
            // Clear all pending timeouts on unmount
            timeoutIdsRef.current.forEach(id => clearTimeout(id));
            timeoutIdsRef.current = [];
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount
}
