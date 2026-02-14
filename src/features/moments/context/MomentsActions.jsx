import React, { createContext, useContext, useCallback } from 'react';
import { INITIAL_PERSONAS } from '../../../data/personas';
import {
    callMomentsAI,
    getTimeContext,
    getRandomLocation,
    generatePostSystemPrompt,
    generateCommentSystemPrompt
} from '../services/momentsService';

const MomentsActionContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useMomentsActions = () => {
    const context = useContext(MomentsActionContext);
    if (!context) throw new Error('useMomentsActions must be used within a MomentsProvider');
    return context;
};

export const MomentsActionProvider = ({ children, setMomentsData, momentsData: _momentsData }) => {
    // We need to read current posts from momentsData prop or ref?
    // Using functional state updates is safer for simple things, but for AI logic that needs to read *other* data, 
    // we might need the latest state. 
    // In ChatContext we used Refs. Here we can use the prop `momentsData` but be careful about staleness in closures.
    // Ideally we pass a Ref for reading latest state in async ops.
    // Let's assume the parent passes a `momentsDataRef`.

    // Actually, let's use the functional updates where possible.

    // ========== CRUD ACTIONS ==========

    const createPost = useCallback((content, images = [], video = null, authorId = 'user-me', options = {}) => {
        const {
            location = null,
            visibility = 'public',
            visibleTo = null,
            hiddenFrom = null
        } = options;

        const newPost = {
            id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            authorId,
            content,
            images,
            video,
            location,
            visibility,
            visibleTo,
            hiddenFrom,
            createdAt: new Date().toISOString(),
            likes: [],
            comments: [],
            reactions: {}
        };

        setMomentsData(prev => ({
            ...prev,
            posts: [newPost, ...(prev.posts || [])]
        }));

        // AI Hook will detect this and trigger interactions if needed
        return newPost.id;
    }, [setMomentsData]);

    const deletePost = useCallback((postId) => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).filter(p => p.id !== postId)
        }));
    }, [setMomentsData]);

    const toggleLike = useCallback((postId, userId = 'user-me') => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;
                const hasLiked = post.likes.includes(userId);
                return {
                    ...post,
                    likes: hasLiked
                        ? post.likes.filter(id => id !== userId)
                        : [...post.likes, userId]
                };
            })
        }));
    }, [setMomentsData]);

    const addReaction = useCallback((postId, emoji, userId = 'user-me') => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;
                const reactions = { ...post.reactions };
                if (!reactions[emoji]) reactions[emoji] = [];
                if (!reactions[emoji].includes(userId)) {
                    reactions[emoji] = [...reactions[emoji], userId];
                }
                return { ...post, reactions };
            })
        }));
    }, [setMomentsData]);

    const addComment = useCallback((postId, content, authorId = 'user-me', replyTo = null) => {
        const newComment = {
            id: `cmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            authorId,
            content,
            createdAt: new Date().toISOString(),
            replyTo
        };

        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;
                return {
                    ...post,
                    comments: [...post.comments, newComment]
                };
            })
        }));
        return newComment.id;
    }, [setMomentsData]);

    const deleteComment = useCallback((postId, commentId) => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;
                return {
                    ...post,
                    comments: post.comments.filter(c => c.id !== commentId)
                };
            })
        }));
    }, [setMomentsData]);

    const setImageApiConfig = useCallback((apiKey, apiUrl) => {
        setMomentsData(prev => ({
            ...prev,
            imageApiKey: apiKey,
            imageApiUrl: apiUrl
        }));
    }, [setMomentsData]);

    // ========== AI ACTIONS ==========

    const generateDynamicAIPost = useCallback(async (aiId) => {
        const persona = INITIAL_PERSONAS.find(p => p.id === aiId);
        if (!persona) return false;

        const timeContext = getTimeContext();
        const randomLocation = getRandomLocation(aiId);
        const systemPrompt = generatePostSystemPrompt(persona, timeContext, randomLocation);

        const response = await callMomentsAI([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Generate a post.' }
        ], 150);

        if (response) {
            createPost(response, [], null, aiId, { location: randomLocation });
            setMomentsData(prev => ({
                ...prev,
                lastAIPostTime: {
                    ...prev.lastAIPostTime,
                    [aiId]: Date.now()
                }
            }));
            console.log(`[MomentsAI] ${persona.name} posted: ${response.substring(0, 50)}...`);
            return true;
        }
        return false;
    }, [createPost, setMomentsData]);

    const generateAIComment = useCallback(async (postId, aiId, replyToComment = null, postsSnapshot) => {
        // We need a snapshot of posts to read content. 
        // passing `postsSnapshot` as arg allows caller (hook) to provide latest state.

        const post = postsSnapshot.find(p => p.id === postId);
        if (!post) return null;

        const persona = INITIAL_PERSONAS.find(p => p.id === aiId);
        if (!persona) return null;

        const getAuthorName = (id) => {
            if (id === 'user-me') return 'You';
            return INITIAL_PERSONAS.find(p => p.id === id)?.name || 'Unknown';
        };

        const postAuthorName = getAuthorName(post.authorId);
        const existingComments = post.comments.slice(-5).map(c => {
            const authorName = getAuthorName(c.authorId);
            return `${authorName}: ${c.content}`;
        }).join('\n');

        const systemPrompt = generateCommentSystemPrompt(persona, postAuthorName, post.content, existingComments, replyToComment);

        const response = await callMomentsAI([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Write your comment.' }
        ], 80);

        if (response) {
            const replyData = replyToComment ? {
                commentId: replyToComment.commentId,
                authorId: replyToComment.authorId,
                authorName: replyToComment.authorName
            } : null;

            addComment(postId, response, aiId, replyData);
            console.log(`[MomentsAI] ${persona.name} commented: ${response}`);
            return response;
        }
        return null;
    }, [addComment]);

    // Export values
    const value = {
        createPost,
        deletePost,
        toggleLike,
        addReaction,
        addComment,
        deleteComment,
        setImageApiConfig,
        generateDynamicAIPost,
        generateAIComment
    };

    return (
        <MomentsActionContext.Provider value={value}>
            {children}
        </MomentsActionContext.Provider>
    );
};
