import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_PERSONAS } from '../data/personas';

const MomentsContext = createContext();

export const useMoments = () => {
    const context = useContext(MomentsContext);
    if (!context) throw new Error('useMoments must be used within a MomentsProvider');
    return context;
};

// AI custom locations for different personas (especially anime characters)
const AI_LOCATIONS = {
    'ai-miku': ['Tokyo·Virtual Concert Hall', '札幌·雪初音舞台', 'Crypton Studio', '虚拟世界·MIKU EXPO'],
    'ai-rem': ['Roswaal Manor', '罗兹瓦尔宅邸·厨房', 'Arlam Village', '卢格尼卡王国'],
    'ai-naruto': ['Konohagakure', '木叶村·一乐拉面', 'Training Ground 7', '火影岩'],
    'ai-l': ['Kira Investigation HQ', '日本警察厅', 'Wammy\'s House', '某高级酒店'],
    'ai-zerotwo': ['Plantation 13', '樱花林', 'FRANXX Cockpit', '海边悬崖'],
    'ai-gojo': ['Jujutsu High', '东京都立咒术高专', 'Shibuya', '渋谷·封印之地'],
    'ai-rin': ['Fuyuki City', '�的冬木市·远坂宅邸', 'Clock Tower', '魔术工房'],
    'ai-asuna': ['Aincrad Floor 22', '艾恩葛朗特·小木屋', 'ALO Fairy World', 'SAO Survivor School'],
    'ai-1': ['Stargazing Hill', '天文台', 'Cozy Café', '独立音乐节'],
    'ai-2': ['Gaming Arena', '电竞馆', 'Tech Lab', '黑客空间'],
    'ai-3': ['Home Kitchen', '美食街', 'Bakery', '私房菜馆'],
    'ai-4': ['British Library', '历史博物馆', 'Chess Club', '古典书店'],
    'ai-5': ['Yoga Studio', '健身房', 'Mountain Trail', '晨跑公园'],
};

// Default locations
const DEFAULT_LOCATIONS = ['Home', '家里', 'Somewhere nice ✨', '某个美好的地方 ✨'];

const DEFAULT_MOMENTS_DATA = {
    posts: [],
    lastAIPostTime: {},
    imageApiKey: '', // Placeholder for image generation API
    imageApiUrl: '',
};

// Helper: Call AI API for Moments content
async function callMomentsAI(messages, maxTokens = 200) {
    const apiUrl = import.meta.env.VITE_AI_API_URL || 'https://api.perplexity.ai';
    const apiKey = import.meta.env.VITE_AI_API_KEY;
    const model = import.meta.env.VITE_AI_MODEL || 'llama-3.1-sonar-small-128k-chat';

    if (!apiKey) {
        console.warn('[MomentsAI] No API key configured');
        return null;
    }

    try {
        const response = await fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.9,
                max_tokens: maxTokens
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error('[MomentsAI] API Error:', data.error);
            return null;
        }
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.trim();
        }
        return null;
    } catch (error) {
        console.error('[MomentsAI] API Call Failed:', error);
        return null;
    }
}

export const MomentsProvider = ({ children }) => {
    const [momentsData, setMomentsData] = useLocalStorage('chat-buddy-moments', DEFAULT_MOMENTS_DATA);
    const aiPostIntervalRef = useRef(null);
    const aiInteractionIntervalRef = useRef(null);

    const posts = momentsData.posts || [];
    const lastAIPostTime = momentsData.lastAIPostTime || {};

    // ========== Image API Configuration ==========
    const setImageApiConfig = useCallback((apiKey, apiUrl) => {
        setMomentsData(prev => ({
            ...prev,
            imageApiKey: apiKey,
            imageApiUrl: apiUrl
        }));
    }, [setMomentsData]);

    const getImageApiConfig = useCallback(() => {
        return {
            apiKey: momentsData.imageApiKey || '',
            apiUrl: momentsData.imageApiUrl || ''
        };
    }, [momentsData]);

    // ========== Post Management ==========

    // Create a new post with enhanced fields
    const createPost = useCallback((content, images = [], video = null, authorId = 'user-me', options = {}) => {
        const {
            location = null,
            visibility = 'public', // 'public' | 'partial' | 'hidden' | 'private'
            visibleTo = null,      // array of user IDs for 'partial'
            hiddenFrom = null      // array of user IDs for 'hidden'
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
            reactions: {} // { emoji: [userId1, userId2] }
        };

        setMomentsData(prev => ({
            ...prev,
            posts: [newPost, ...(prev.posts || [])]
        }));

        // Trigger AI interactions after user posts
        if (authorId === 'user-me') {
            setTimeout(() => triggerAIInteractions(newPost.id), 2000 + Math.random() * 5000);
        }

        return newPost.id;
    }, [setMomentsData]);

    // Delete a post
    const deletePost = useCallback((postId) => {
        setMomentsData(prev => ({
            ...prev,
            posts: (prev.posts || []).filter(p => p.id !== postId)
        }));
    }, [setMomentsData]);

    // ========== Likes ==========

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

    // ========== Reactions (emoji) ==========

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

    // ========== Comments with Reply Support ==========

    const addComment = useCallback((postId, content, authorId = 'user-me', replyTo = null) => {
        const newComment = {
            id: `cmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            authorId,
            content,
            createdAt: new Date().toISOString(),
            replyTo // { commentId, authorId, authorName } or null
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

    // ========== AI Dynamic Content Generation ==========

    // Generate dynamic AI post using API
    const generateDynamicAIPost = useCallback(async (aiId) => {
        const persona = INITIAL_PERSONAS.find(p => p.id === aiId);
        if (!persona) return null;

        const hour = new Date().getHours();
        let timeContext = 'daytime';
        if (hour >= 5 && hour < 9) timeContext = 'early morning';
        else if (hour >= 9 && hour < 12) timeContext = 'morning';
        else if (hour >= 12 && hour < 14) timeContext = 'lunch time';
        else if (hour >= 14 && hour < 18) timeContext = 'afternoon';
        else if (hour >= 18 && hour < 21) timeContext = 'evening';
        else if (hour >= 21 || hour < 5) timeContext = 'late night';

        const locations = AI_LOCATIONS[aiId] || DEFAULT_LOCATIONS;
        const randomLocation = locations[Math.floor(Math.random() * locations.length)];

        const systemPrompt = `You are ${persona.name} (${persona.name_zh}).
Personality: ${persona.personality}
Style: ${persona.style}
Interests: ${persona.interests?.join(', ')}

Current time context: ${timeContext}
Location: ${randomLocation}

Generate a social media post (like WeChat Moments) that this character would share.
The post should:
- Be 1-3 sentences, natural and in character
- Sometimes in Chinese, sometimes in English, sometimes mixed (based on character)
- Include relevant emojis
- Reflect the time of day naturally
- Match the character's personality perfectly

Output ONLY the post content, nothing else.`;

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

    // Generate AI comment with context
    const generateAIComment = useCallback(async (postId, aiId, replyToComment = null) => {
        const post = posts.find(p => p.id === postId);
        if (!post) return null;

        const persona = INITIAL_PERSONAS.find(p => p.id === aiId);
        if (!persona) return null;

        const postAuthor = getAuthor(post.authorId);
        const existingComments = post.comments.slice(-5).map(c => {
            const author = getAuthor(c.authorId);
            return `${author.name}: ${c.content}`;
        }).join('\n');

        let systemPrompt = `You are ${persona.name}.
Personality: ${persona.personality}
Style: ${persona.style}

A friend "${postAuthor.name}" posted: "${post.content}"

${existingComments ? `Recent comments:\n${existingComments}` : ''}

${replyToComment ? `You are replying to ${replyToComment.authorName}'s comment: "${replyToComment.content}"` : ''}

Generate a short, natural comment (1 sentence max) that fits your personality.
Output ONLY the comment text.`;

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
    }, [posts, addComment]);

    // Evaluate if AI should like a post based on interests
    const evaluateShouldLike = useCallback((post, aiId) => {
        const persona = INITIAL_PERSONAS.find(p => p.id === aiId);
        if (!persona) return false;

        // Always high chance to like user posts
        if (post.authorId === 'user-me') return Math.random() > 0.3;

        // Check interest overlap
        const postContent = post.content.toLowerCase();
        const interests = persona.interests || [];
        const hasInterestMatch = interests.some(interest =>
            postContent.includes(interest.toLowerCase())
        );

        if (hasInterestMatch) return Math.random() > 0.2;
        return Math.random() > 0.6;
    }, []);

    // Trigger AI interactions on a specific post
    const triggerAIInteractions = useCallback(async (postId) => {
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        // Select random AIs to interact
        const shuffledPersonas = [...INITIAL_PERSONAS].sort(() => Math.random() - 0.5);
        const interactors = shuffledPersonas.slice(0, 3 + Math.floor(Math.random() * 4)); // 3-6 AIs

        for (let i = 0; i < interactors.length; i++) {
            const persona = interactors[i];
            const delay = (i + 1) * (2000 + Math.random() * 4000);

            setTimeout(async () => {
                // Maybe like
                if (evaluateShouldLike(post, persona.id)) {
                    toggleLike(postId, persona.id);
                }

                // Maybe react with emoji
                if (Math.random() > 0.7) {
                    const emojis = ['😂', '❤️', '👍', '🔥', '😮', '😢'];
                    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                    addReaction(postId, emoji, persona.id);
                }

                // Maybe comment (lower chance)
                if (Math.random() > 0.6) {
                    await generateAIComment(postId, persona.id);
                }
            }, delay);
        }
    }, [posts, toggleLike, addReaction, generateAIComment, evaluateShouldLike]);

    // Periodic AI posting
    const checkAIPosts = useCallback(async () => {
        const now = Date.now();
        const MIN_INTERVAL = 30 * 60 * 1000; // 30 min for testing (normally 2h)
        const MAX_INTERVAL = 2 * 60 * 60 * 1000; // 2h for testing (normally 6h)

        for (const persona of INITIAL_PERSONAS) {
            const lastPost = lastAIPostTime[persona.id] || 0;
            const interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);

            if (now - lastPost > interval) {
                // Random chance to post
                if (Math.random() > 0.85) {
                    await generateDynamicAIPost(persona.id);
                    break; // Only one AI posts per check
                }
            }
        }
    }, [lastAIPostTime, generateDynamicAIPost]);

    // AI mutual interaction: AI comments on other AI posts
    const triggerAIMutualInteraction = useCallback(async () => {
        const recentAIPosts = posts
            .filter(p => p.authorId !== 'user-me' && p.authorId.startsWith('ai-'))
            .slice(0, 10);

        if (recentAIPosts.length === 0) return;

        const randomPost = recentAIPosts[Math.floor(Math.random() * recentAIPosts.length)];
        const otherAIs = INITIAL_PERSONAS.filter(p => p.id !== randomPost.authorId);

        if (otherAIs.length > 0 && Math.random() > 0.7) {
            const randomAI = otherAIs[Math.floor(Math.random() * otherAIs.length)];

            // Check if this AI hasn't already interacted
            const hasLiked = randomPost.likes.includes(randomAI.id);
            const hasCommented = randomPost.comments.some(c => c.authorId === randomAI.id);

            if (!hasLiked && !hasCommented) {
                if (Math.random() > 0.4) {
                    toggleLike(randomPost.id, randomAI.id);
                }
                if (Math.random() > 0.6) {
                    await generateAIComment(randomPost.id, randomAI.id);
                }
            }
        }
    }, [posts, toggleLike, generateAIComment]);

    // Initialize with AI posts if empty
    useEffect(() => {
        if (posts.length === 0) {
            const initialAIs = [...INITIAL_PERSONAS]
                .sort(() => Math.random() - 0.5)
                .slice(0, 4);

            initialAIs.forEach((persona, index) => {
                setTimeout(() => generateDynamicAIPost(persona.id), index * 2000);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Periodic checks
    useEffect(() => {
        aiPostIntervalRef.current = setInterval(checkAIPosts, 10 * 60 * 1000); // Every 10 min
        aiInteractionIntervalRef.current = setInterval(triggerAIMutualInteraction, 15 * 60 * 1000); // Every 15 min

        return () => {
            clearInterval(aiPostIntervalRef.current);
            clearInterval(aiInteractionIntervalRef.current);
        };
    }, [checkAIPosts, triggerAIMutualInteraction]);

    // Get author info
    const getAuthor = useCallback((authorId) => {
        if (authorId === 'user-me') {
            return { id: 'user-me', name: 'You', name_zh: '我', avatar: null };
        }
        return INITIAL_PERSONAS.find(p => p.id === authorId) || { id: authorId, name: 'Unknown', avatar: null };
    }, []);

    // ========== Content Search for AI Context ==========

    const getAIAccessibleContent = useCallback((aiId) => {
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
    }, [posts]);

    const value = {
        posts,
        createPost,
        deletePost,
        toggleLike,
        addReaction,
        addComment,
        deleteComment,
        generateDynamicAIPost,
        generateAIComment,
        triggerAIInteractions,
        getAuthor,
        getAIAccessibleContent,
        setImageApiConfig,
        getImageApiConfig
    };

    return (
        <MomentsContext.Provider value={value}>
            {children}
        </MomentsContext.Provider>
    );
};
