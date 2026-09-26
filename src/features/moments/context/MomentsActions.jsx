import React, { createContext, useContext, useCallback } from 'react';
import { INITIAL_PERSONAS } from '../../../data/personas';
import { useLanguage } from '../../../context/LanguageContext';
import {
    callMomentsAI,
    getTimeContext,
    getRandomLocation,
    evaluateInterestMatch,
} from '../services/momentsService';
import {
    buildCommentSuggestions,
    buildFallbackMomentComment,
    buildFallbackMomentPost,
    buildLocalMomentFeedback,
    buildMomentWritingAssistPrompt,
    createLocalWritingAssist,
    detectMomentLanguage,
    parseMomentAssistResponse,
    sanitizeMomentText,
} from '../services/momentsContentService';
import { isRenderableMomentImage } from '../services/momentsMediaService';
import {
    DEFAULT_AUDIENCE_POLICY,
    HEART_REACTION,
    createCloudInteraction,
    createCloudMoment,
    mapCloudMoment,
    newClientInteractionKey,
} from '../services/momentsCloudService';

const MomentsActionContext = createContext();

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useMomentsActions = () => {
    const context = useContext(MomentsActionContext);
    if (!context) throw new Error('useMomentsActions must be used within a MomentsProvider');
    return context;
};

export const MomentsActionProvider = ({
    children,
    setMomentsData,
    setImageApiKey,
    setCloudFeedError = () => {},
    cloudMode = false,
    actorNames = {},
    posts = [],
}) => {
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

    const createPostLocal = useCallback((content, images = [], video = null, authorId = 'user-me', options = {}) => {
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

    const createPost = useCallback((content, images = [], video = null, authorId = 'user-me', options = {}) => {
        if (!cloudMode || authorId !== 'user-me') {
            return createPostLocal(content, images, video, authorId, options);
        }

        const {
            location = null,
            visibility = 'public',
            visibleTo = null,
            hiddenFrom = null,
            language: postLanguage = preferredLanguage,
        } = options;
        const placeholder = {
            id: createId('cloud-post-pending'),
            authorId: 'user-me',
            content: sanitizeMomentText(content, postLanguage),
            images: (Array.isArray(images) ? images : []).filter(isRenderableMomentImage),
            video,
            location,
            visibility,
            visibleTo,
            hiddenFrom,
            language: postLanguage,
            storyTitle: null,
            hashtags: [],
            createdAt: new Date().toISOString(),
            likes: [],
            comments: [],
            reactions: {},
            shareCount: 0,
            shares: [],
            aiFeedback: null,
            aiAssist: null,
            repostOf: null,
            cloud: true,
            pending: true,
        };

        setMomentsData(prev => ({ ...prev, posts: [placeholder, ...(prev.posts || [])] }));
        setCloudFeedError(null);

        (async () => {
            try {
                const created = await createCloudMoment({
                    content: placeholder.content,
                    audiencePolicy: DEFAULT_AUDIENCE_POLICY,
                    mediaAssets: [],
                });
                // The current service returns the Moment directly; tolerate the
                // documented envelope as well so the client stays contract-safe.
                const moment = created?.moment || created;
                const mappedPost = mapCloudMoment(moment, new Map(Object.entries(actorNames)));
                if (!mappedPost) throw new Error('Cloud moment response was invalid');

                setMomentsData(prev => ({
                    ...prev,
                    posts: (prev.posts || []).map(post => (
                        post.id === placeholder.id ? mappedPost : post
                    )),
                }));
            } catch (error) {
                setMomentsData(prev => ({
                    ...prev,
                    posts: (prev.posts || []).filter(post => post.id !== placeholder.id),
                }));
                setCloudFeedError(error?.message || 'Failed to create cloud moment');
            }
        })();

        return placeholder.id;
    }, [actorNames, cloudMode, createPostLocal, preferredLanguage, setCloudFeedError, setMomentsData]);

    // The cloud API has no moment-delete endpoint, so deletion remains a local optimistic action.
    const deletePost = useCallback((postId) => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).filter(post => post.id !== postId),
        }));
    }, [setMomentsData]);

    const toggleLike = useCallback((postId, userId = 'user-me') => {
        const targetPost = posts.find(post => post.id === postId);
        if (cloudMode && userId === 'user-me' && targetPost) {
            const previousLikes = Array.isArray(targetPost.likes) ? targetPost.likes : [];
            const hadLiked = previousLikes.includes(userId);

            setMomentsData(prev => ({
                ...prev,
                posts: (prev.posts || []).map(post => {
                    if (post.id !== postId) return post;
                    const likes = Array.isArray(post.likes) ? post.likes : [];
                    return {
                        ...post,
                        likes: hadLiked ? likes.filter(id => id !== userId) : [...likes, userId],
                    };
                }),
            }));

            if (hadLiked) return;
            setCloudFeedError(null);
            createCloudInteraction(postId, {
                type: 'reaction',
                content: HEART_REACTION,
                clientIdempotencyKey: newClientInteractionKey(),
            }).catch(error => {
                setMomentsData(prev => ({
                    ...prev,
                    posts: (prev.posts || []).map(post => (
                        post.id === postId ? { ...post, likes: previousLikes } : post
                    )),
                }));
                setCloudFeedError(error?.message || 'Failed to like cloud moment');
            });
            return;
        }

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
    }, [cloudMode, posts, setCloudFeedError, setMomentsData]);

    const addReaction = useCallback((postId, emoji, userId = 'user-me') => {
        const targetPost = posts.find(post => post.id === postId);
        if (cloudMode && userId === 'user-me' && targetPost) {
            const previousUsers = Array.isArray(targetPost.reactions?.[emoji])
                ? targetPost.reactions[emoji]
                : [];
            if (previousUsers.includes(userId)) return;

            setMomentsData(prev => ({
                ...prev,
                posts: (prev.posts || []).map(post => {
                    if (post.id !== postId) return post;
                    const reactions = { ...(post.reactions || {}) };
                    const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
                    return { ...post, reactions: { ...reactions, [emoji]: [...users, userId] } };
                }),
            }));
            setCloudFeedError(null);
            createCloudInteraction(postId, {
                type: 'reaction',
                content: emoji,
                clientIdempotencyKey: newClientInteractionKey(),
            }).catch(error => {
                setMomentsData(prev => ({
                    ...prev,
                    posts: (prev.posts || []).map(post => {
                        if (post.id !== postId) return post;
                        const reactions = { ...(post.reactions || {}) };
                        if (previousUsers.length > 0) {
                            reactions[emoji] = previousUsers;
                        } else {
                            delete reactions[emoji];
                        }
                        return { ...post, reactions };
                    }),
                }));
                setCloudFeedError(error?.message || 'Failed to react to cloud moment');
            });
            return;
        }

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
    }, [cloudMode, posts, setCloudFeedError, setMomentsData]);

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

        if (cloudMode && authorId === 'user-me' && posts.some(post => post.id === postId)) {
            setCloudFeedError(null);
            createCloudInteraction(postId, {
                type: 'comment',
                content: newComment.content,
                clientIdempotencyKey: newClientInteractionKey(),
            }).catch(error => {
                setMomentsData(prev => ({
                    ...prev,
                    posts: (prev.posts || []).map(post => (
                        post.id === postId
                            ? { ...post, comments: (post.comments || []).filter(comment => comment.id !== newComment.id) }
                            : post
                    )),
                }));
                setCloudFeedError(error?.message || 'Failed to comment on cloud moment');
            });
        }

        return newComment;
    }, [cloudMode, posts, preferredLanguage, setCloudFeedError, setMomentsData]);

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

    // The cloud API has no share endpoint, so share tracking remains a local optimistic action.
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

    // The cloud API has no repost endpoint, so repost remains a local optimistic action.
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
        const normalizedFeedback = {
            ...fallback,
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

    const generateDynamicAIPost = useCallback(async (aiId, _options = {}) => {
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

        // Background social activity is local by design. Browsing Moments must
        // never spend text or image requests without a direct user action.
        createPost(fallbackPost, [], null, aiId, {
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
    }, [createPost, preferredLanguage, setMomentsData]);

    const generateAIComment = useCallback(async (postId, aiId, replyToComment = null, postsSnapshot = []) => {
        const post = postsSnapshot.find(item => item.id === postId);
        if (!post) return null;

        const persona = INITIAL_PERSONAS.find(item => item.id === aiId);
        if (!persona) return null;

        const postLanguage = post.language || preferredLanguage;
        const postAuthorName = getLocalizedName(post.authorId, postLanguage);
        const fallbackComment = buildFallbackMomentComment({
            persona,
            language: postLanguage,
            postAuthorName,
            postContent: post.content,
            replyToComment,
        });

        const replyData = replyToComment ? {
            commentId: replyToComment.commentId,
            authorId: replyToComment.authorId,
            authorName: replyToComment.authorName,
        } : null;

        addComment(postId, fallbackComment, aiId, replyData);
        return fallbackComment;
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

        const eventDetail = preferredLanguage === 'zh'
            ? eventType === 'birthday'
                ? '今天也想把这份生日的小开心分享给你。'
                : `今天是${eventName || '特别的日子'}，愿你也有一点轻松的节日心情。`
            : eventType === 'birthday'
                ? 'Sharing a small birthday joy with you today.'
                : `It is ${eventName || 'a special day'}—hope it brings you a lighter moment.`;
        const finalContent = `${fallbackPost} ${eventDetail}`;

        createPost(finalContent, [], null, aiId, {
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
    }, [createPost, preferredLanguage, setMomentsData]);

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
