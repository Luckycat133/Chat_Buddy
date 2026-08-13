import React, { createContext, useContext, useCallback } from 'react';
import { INITIAL_PERSONAS } from '../../../data/personas';
import { useLanguage } from '../../../context/LanguageContext';
import {
    callMomentsAI,
    getTimeContext,
    getRandomLocation,
    generatePostSystemPrompt,
    generateCommentSystemPrompt,
    generateBirthdayPostSystemPrompt,
    generateHolidayPostSystemPrompt,
    evaluateInterestMatch,
} from '../services/momentsService';
import {
    buildCommentSuggestions,
    buildFallbackMomentComment,
    buildFallbackMomentPost,
    buildLocalMomentFeedback,
    buildMomentFeedbackPrompt,
    buildMomentWritingAssistPrompt,
    createLocalWritingAssist,
    detectMomentLanguage,
    normalizeGeneratedMomentText,
    parseMomentAssistResponse,
    sanitizeMomentText,
} from '../services/momentsContentService';
import { isRenderableMomentImage } from '../services/momentsMediaService';
import { generateMomentsImage, isMiniMaxConfigured } from '../../../services/minimaxService';

const MomentsActionContext = createContext();

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractJsonObject(raw) {
    if (!raw) return null;
    const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) return fencedMatch[1].trim();
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    return objectMatch?.[0] || null;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useMomentsActions = () => {
    const context = useContext(MomentsActionContext);
    if (!context) throw new Error('useMomentsActions must be used within a MomentsProvider');
    return context;
};

export const MomentsActionProvider = ({ children, setMomentsData, setImageApiKey }) => {
    const { language, resolvedAiLanguage } = useLanguage();
    const preferredLanguage = resolvedAiLanguage || language || 'zh';

    const getLocalizedName = useCallback((authorId, targetLanguage = preferredLanguage) => {
        if (authorId === 'user-me') {
            return targetLanguage === 'zh' ? '你' : 'You';
        }

        const persona = INITIAL_PERSONAS.find(item => item.id === authorId);
        if (!persona) return targetLanguage === 'zh' ? '未知角色' : 'Unknown';
        return targetLanguage === 'zh' ? (persona.name_zh || persona.name) : persona.name;
    }, [preferredLanguage]);

    const createPost = useCallback((content, images = [], video = null, authorId = 'user-me', options = {}) => {
        const {
            location = null,
            visibility = 'public',
            visibleTo = null,
            hiddenFrom = null,
            language: postLanguage = preferredLanguage,
            storyTitle = null,
            hashtags = [],
            aiFeedback = null,
            aiAssist = null,
            repostOf = null,
            shareCount = 0,
            shares = [],
        } = options;

        const normalizedContent = sanitizeMomentText(content, postLanguage);
        const sanitizedImages = (Array.isArray(images) ? images : []).filter(isRenderableMomentImage);

        const newPost = {
            id: createId('post'),
            authorId,
            content: normalizedContent,
            images: sanitizedImages,
            video,
            location,
            visibility,
            visibleTo,
            hiddenFrom,
            language: postLanguage,
            storyTitle,
            hashtags: [...new Set(Array.isArray(hashtags) ? hashtags.filter(Boolean) : [])],
            createdAt: new Date().toISOString(),
            likes: [],
            comments: [],
            reactions: {},
            shareCount,
            shares,
            aiFeedback,
            aiAssist,
            repostOf,
        };

        setMomentsData(prev => ({
            ...prev,
            posts: [newPost, ...(prev.posts || [])],
        }));

        return newPost.id;
    }, [preferredLanguage, setMomentsData]);

    const deletePost = useCallback((postId) => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).filter(post => post.id !== postId),
        }));
    }, [setMomentsData]);

    const toggleLike = useCallback((postId, userId = 'user-me') => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;
                const likes = Array.isArray(post.likes) ? post.likes : [];
                const hasLiked = likes.includes(userId);
                return {
                    ...post,
                    likes: hasLiked ? likes.filter(id => id !== userId) : [...likes, userId],
                };
            }),
        }));
    }, [setMomentsData]);

    const addReaction = useCallback((postId, emoji, userId = 'user-me') => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;
                const reactions = { ...(post.reactions || {}) };
                const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
                if (!users.includes(userId)) {
                    reactions[emoji] = [...users, userId];
                }
                return { ...post, reactions };
            }),
        }));
    }, [setMomentsData]);

    const addComment = useCallback((postId, content, authorId = 'user-me', replyTo = null) => {
        const detectedLanguage = detectMomentLanguage(content);
        const commentLanguage = detectedLanguage === 'en' || detectedLanguage === 'zh'
            ? detectedLanguage
            : preferredLanguage;
        const newComment = {
            id: createId('cmt'),
            authorId,
            content: sanitizeMomentText(content, commentLanguage),
            createdAt: new Date().toISOString(),
            replyTo,
        };

        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;
                return {
                    ...post,
                    comments: [...(post.comments || []), newComment],
                };
            }),
        }));

        return newComment;
    }, [preferredLanguage, setMomentsData]);

    const deleteComment = useCallback((postId, commentId) => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;
                return {
                    ...post,
                    comments: (post.comments || []).filter(comment => comment.id !== commentId),
                };
            }),
        }));
    }, [setMomentsData]);

    const incrementShare = useCallback((postId, meta = {}) => {
        const {
            sharerId = 'user-me',
            target = 'chat',
            targetId = null,
        } = meta;

        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;

                return {
                    ...post,
                    shareCount: (post.shareCount || 0) + 1,
                    shares: [
                        ...(post.shares || []),
                        {
                            id: createId('share'),
                            sharerId,
                            target,
                            targetId,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                };
            }),
        }));
    }, [setMomentsData]);

    const repostPost = useCallback((postId, note = '', authorId = 'user-me') => {
        let repostedPostId = null;

        setMomentsData(prev => {
            const sourcePost = (prev.posts || []).find(post => post.id === postId);
            if (!sourcePost) return prev;

            const postLanguage = sourcePost.language || preferredLanguage;
            const normalizedNote = sanitizeMomentText(note, postLanguage);

            const repost = {
                id: createId('post'),
                authorId,
                content: normalizedNote,
                images: [],
                video: null,
                location: sourcePost.location || null,
                visibility: 'public',
                visibleTo: null,
                hiddenFrom: null,
                language: postLanguage,
                storyTitle: null,
                hashtags: sourcePost.hashtags || [],
                createdAt: new Date().toISOString(),
                likes: [],
                comments: [],
                reactions: {},
                shareCount: 0,
                shares: [],
                aiFeedback: null,
                aiAssist: null,
                repostOf: {
                    id: sourcePost.id,
                    authorId: sourcePost.authorId,
                    authorName: getLocalizedName(sourcePost.authorId, postLanguage),
                    content: sourcePost.content,
                    images: sourcePost.images || [],
                    location: sourcePost.location || null,
                    storyTitle: sourcePost.storyTitle || null,
                },
            };

            repostedPostId = repost.id;

            return {
                ...prev,
                posts: [
                    repost,
                    ...(prev.posts || []).map(post => {
                        if (post.id !== postId) return post;
                        return {
                            ...post,
                            shareCount: (post.shareCount || 0) + 1,
                            shares: [
                                ...(post.shares || []),
                                {
                                    id: createId('share'),
                                    sharerId: authorId,
                                    target: 'moments',
                                    targetId: repost.id,
                                    createdAt: repost.createdAt,
                                },
                            ],
                        };
                    }),
                ],
            };
        });

        return repostedPostId;
    }, [getLocalizedName, preferredLanguage, setMomentsData]);

    const setImageApiConfig = useCallback((apiKey, apiUrl) => {
        setImageApiKey(typeof apiKey === 'string' ? apiKey : '');
        setMomentsData(prev => ({
            ...prev,
            imageApiUrl: apiUrl,
        }));
    }, [setImageApiKey, setMomentsData]);

    const saveDraft = useCallback((draft) => {
        setMomentsData(prev => ({ ...prev, draft }));
    }, [setMomentsData]);

    const clearDraft = useCallback(() => {
        setMomentsData(prev => ({ ...prev, draft: null }));
    }, [setMomentsData]);

    const generateWritingAssist = useCallback(async ({ content = '', location = '' } = {}) => {
        const fallback = createLocalWritingAssist({ content, language: preferredLanguage, location });

        if (!content.trim()) {
            return fallback;
        }

        const response = await callMomentsAI([
            { role: 'system', content: buildMomentWritingAssistPrompt(preferredLanguage) },
            {
                role: 'user',
                content: `Draft:\n${content}\n\nLocation: ${location || 'N/A'}`,
            },
        ], 260);

        return parseMomentAssistResponse(response, preferredLanguage, fallback);
    }, [preferredLanguage]);

    const generateAIFeedback = useCallback(async (postId, aiId = null, postsSnapshot = []) => {
        const targetPost = postsSnapshot.find(post => post.id === postId);
        if (!targetPost) return null;

        const postLanguage = targetPost.language || preferredLanguage;
        const persona = aiId
            ? INITIAL_PERSONAS.find(item => item.id === aiId)
            : INITIAL_PERSONAS.find(item => evaluateInterestMatch(targetPost.content, item.interests))
                || INITIAL_PERSONAS[0];

        const fallback = buildLocalMomentFeedback(targetPost, postLanguage);
        const personaName = getLocalizedName(persona?.id, postLanguage);
        let feedback = fallback;

        const response = await callMomentsAI([
            { role: 'system', content: buildMomentFeedbackPrompt(postLanguage, getLocalizedName(targetPost.authorId, postLanguage)) },
            {
                role: 'user',
                content: `Post:\n${targetPost.content}\n\nLocation: ${targetPost.location || 'N/A'}`,
            },
        ], 180);

        const jsonCandidate = extractJsonObject(response || '');
        if (jsonCandidate) {
            try {
                const parsed = JSON.parse(jsonCandidate);
                feedback = {
                    summary: sanitizeMomentText(parsed.summary || fallback.summary, postLanguage),
                    nextMove: sanitizeMomentText(parsed.nextMove || fallback.nextMove, postLanguage),
                    suggestedComment: normalizeGeneratedMomentText(
                        parsed.suggestedComment,
                        postLanguage,
                        fallback.suggestedComment
                    ),
                };
            } catch (e) {
                console.warn('[MomentsActions] Feedback parsing failed:', e?.message);
                feedback = fallback;
            }
        }

        const normalizedFeedback = {
            ...feedback,
            authorId: persona?.id || 'ai-1',
            authorName: personaName,
            generatedAt: new Date().toISOString(),
        };

        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).map(post => {
                if (post.id !== postId) return post;
                return {
                    ...post,
                    aiFeedback: normalizedFeedback,
                };
            }),
        }));

        return normalizedFeedback;
    }, [getLocalizedName, preferredLanguage, setMomentsData]);

    const maybeGenerateCachedImages = useCallback(async (text, persona, location, options = {}, chance = 0.4) => {
        if (!isMiniMaxConfigured() || Math.random() >= chance) return [];

        try {
            const imageResult = await generateMomentsImage(
                text,
                { ...persona, id: persona.id },
                location,
                options
            );

            if (!imageResult?.imageUrl) return [];

            return [imageResult.imageUrl];
        } catch (error) {
            console.warn(`[MomentsAI] Image generation failed, falling back to text-only post: ${error.message}`);
            return [];
        }
    }, []);

    const generateDynamicAIPost = useCallback(async (aiId, options = {}) => {
        const persona = INITIAL_PERSONAS.find(item => item.id === aiId);
        if (!persona) return false;

        const timeContext = getTimeContext();
        const location = getRandomLocation(aiId, preferredLanguage);
        const fallbackPost = buildFallbackMomentPost({
            persona,
            language: preferredLanguage,
            timeContext,
            location,
        });

        const response = options.localOnly
            ? fallbackPost
            : await callMomentsAI([
                { role: 'system', content: generatePostSystemPrompt(persona, timeContext, location, preferredLanguage) },
                { role: 'user', content: 'Generate a post.' },
            ], 160);

        const finalContent = normalizeGeneratedMomentText(response, preferredLanguage, fallbackPost);
        const images = await maybeGenerateCachedImages(
            finalContent,
            persona,
            location,
            { aspectRatio: '4:3' },
            0.4
        );

        createPost(finalContent, images, null, aiId, {
            location,
            language: preferredLanguage,
        });

        setMomentsData(prev => ({
            ...prev,
            lastAIPostTime: {
                ...prev.lastAIPostTime,
                [aiId]: Date.now(),
            },
        }));

        return true;
    }, [createPost, maybeGenerateCachedImages, preferredLanguage, setMomentsData]);

    const generateAIComment = useCallback(async (postId, aiId, replyToComment = null, postsSnapshot = []) => {
        const post = postsSnapshot.find(item => item.id === postId);
        if (!post) return null;

        const persona = INITIAL_PERSONAS.find(item => item.id === aiId);
        if (!persona) return null;

        const postLanguage = post.language || preferredLanguage;
        const postAuthorName = getLocalizedName(post.authorId, postLanguage);
        const existingComments = (post.comments || []).slice(-5).map(comment => {
            const authorName = getLocalizedName(comment.authorId, postLanguage);
            return `${authorName}: ${comment.content}`;
        }).join('\n');

        const fallbackComment = buildFallbackMomentComment({
            persona,
            language: postLanguage,
            postAuthorName,
            postContent: post.content,
            replyToComment,
        });

        const response = await callMomentsAI([
            {
                role: 'system',
                content: generateCommentSystemPrompt(
                    persona,
                    postAuthorName,
                    post.content,
                    existingComments,
                    replyToComment,
                    postLanguage
                ),
            },
            { role: 'user', content: 'Write your comment.' },
        ], 90);

        const finalComment = normalizeGeneratedMomentText(response, postLanguage, fallbackComment);
        const replyData = replyToComment ? {
            commentId: replyToComment.commentId,
            authorId: replyToComment.authorId,
            authorName: replyToComment.authorName,
        } : null;

        addComment(postId, finalComment, aiId, replyData);
        return finalComment;
    }, [addComment, getLocalizedName, preferredLanguage]);

    const generateStoryPost = useCallback(async (aiId, eventType, eventName) => {
        const persona = INITIAL_PERSONAS.find(item => item.id === aiId);
        if (!persona) return false;

        const location = getRandomLocation(aiId, preferredLanguage);
        const timeContext = getTimeContext();
        const fallbackPost = buildFallbackMomentPost({
            persona,
            language: preferredLanguage,
            timeContext,
            location,
        });

        const response = await callMomentsAI([
            {
                role: 'system',
                content: eventType === 'birthday'
                    ? generateBirthdayPostSystemPrompt(persona, preferredLanguage)
                    : generateHolidayPostSystemPrompt(persona, eventName, preferredLanguage),
            },
            { role: 'user', content: 'Generate a post.' },
        ], 160);

        const finalContent = normalizeGeneratedMomentText(response, preferredLanguage, fallbackPost);
        const imageSeed = eventType === 'birthday'
            ? `${finalContent} birthday celebration`
            : `${finalContent} ${eventName || 'holiday'} celebration`;
        const images = await maybeGenerateCachedImages(
            imageSeed,
            persona,
            location,
            { aspectRatio: '1:1', promptOptimizer: true },
            0.7
        );

        createPost(finalContent, images, null, aiId, {
            location,
            language: preferredLanguage,
        });

        setMomentsData(prev => ({
            ...prev,
            lastAIPostTime: {
                ...prev.lastAIPostTime,
                [aiId]: Date.now(),
            },
        }));

        return true;
    }, [createPost, maybeGenerateCachedImages, preferredLanguage, setMomentsData]);

    const value = {
        createPost,
        deletePost,
        toggleLike,
        addReaction,
        addComment,
        deleteComment,
        incrementShare,
        repostPost,
        setImageApiConfig,
        saveDraft,
        clearDraft,
        generateWritingAssist,
        generateAIFeedback,
        generateDynamicAIPost,
        generateAIComment,
        generateStoryPost,
        buildCommentSuggestions,
    };

    return (
        <MomentsActionContext.Provider value={value}>
            {children}
        </MomentsActionContext.Provider>
    );
};
