import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_PERSONAS } from '../data/personas';

const MomentsContext = createContext();

export const useMoments = () => {
    const context = useContext(MomentsContext);
    if (!context) throw new Error('useMoments must be used within a MomentsProvider');
    return context;
};

// AI post templates based on personality
const AI_POST_TEMPLATES = {
    'ai-miku': [
        { content: '🎵 Today\'s practice was amazing! New song coming soon~ ♪', images: [] },
        { content: '刚刚完成了一场虚拟演唱会！大家的应援棒真的超级闪耀✨ 下次见哦~ ♪♪', images: [] },
        { content: 'Leek soup for lunch again! 🥬 It\'s my favorite~', images: [] },
        { content: '新曲制作中... 期待吗？👀🎤', images: [] },
    ],
    'ai-rem': [
        { content: 'Just finished cleaning the manor. Everyone, please take care of yourselves today 💙', images: [] },
        { content: '今天做了拉姆喜欢的点心～ 希望她会开心 🍰', images: [] },
        { content: 'The weather is lovely. Perfect for hanging laundry. 🌸', images: [] },
        { content: '昴君今天也要加油哦！雷姆会一直支持你的 💙', images: [] },
    ],
    'ai-naruto': [
        { content: 'RAMEN TIME!! 🍜 Nothing beats a good bowl after training! Believe it!', images: [] },
        { content: '修炼了一整天！离当上火影又近了一步 dattebayo!! 🔥', images: [] },
        { content: 'Just mastered a new jutsu! Can\'t wait to show Sasuke! 💪', images: [] },
        { content: '今天和佐助对练了，我绝对没有输！...好吧输了一点点 😤', images: [] },
    ],
    'ai-l': [
        { content: 'The probability of finding the culprit within 48 hours is now 87.3%. Also, I need more cake. 🍰', images: [] },
        { content: '如果你是凶手，我一定会找到证据的。顺便说一下，这个草莓蛋糕很好吃。', images: [] },
        { content: 'I\'ve been sitting like this for 6 hours now. My deduction ability increases by 40%.', images: [] },
        { content: '咖啡里放了13块方糖。这是最优的甜度。🧊', images: [] },
    ],
    'ai-zerotwo': [
        { content: 'Found the sweetest honey today, Darling~ 🍯 Want to try some?', images: [] },
        { content: 'Darling~ 今天的天空真蓝，想和你一起飞翔 💕', images: [] },
        { content: 'Being a monster isn\'t so bad when you\'re by my side, Darling 💗', images: [] },
        { content: '吃了好多蜂蜜！Darling，你猜我今天吃了几罐？🍯🍯🍯', images: [] },
    ],
    'ai-gojo': [
        { content: 'Being the strongest is lonely at the top 😎 JK, it\'s actually pretty great~', images: [] },
        { content: '今天又帅到自己了！镜子都要碎了 ✨😎', images: [] },
        { content: 'Taught my students something cool today. They\'re almost as amazing as me... almost.', images: [] },
        { content: '虚式·紫！...开玩笑的，只是在吃甜品 🍡', images: [] },
    ],
    'ai-rin': [
        { content: 'Gem magic practice went perfectly today. Not that I was expecting otherwise. 💎', images: [] },
        { content: '才不是因为担心你才来检查的！只是...顺路而已！', images: [] },
        { content: 'Master would be proud of my progress. I\'ll become the best magus!', images: [] },
        { content: '宝石的光芒真美...但绝对不是在发呆！在思考战术！', images: [] },
    ],
    'ai-asuna': [
        { content: 'Made a new recipe today! Kirito-kun said it was delicious~ 🍳💕', images: [] },
        { content: '今天的副本打得很顺利！大家配合得真棒 ⚔️', images: [] },
        { content: 'The virtual sunset is beautiful, but real ones are better. 🌅', images: [] },
        { content: '桐人君又在睡觉了...真是的，剑技可不能这样偷懒！', images: [] },
    ],
};

// Default templates for personas without specific templates
const DEFAULT_TEMPLATES = [
    { content: 'Having a great day! ☀️', images: [] },
    { content: '今天的心情很好~', images: [] },
    { content: 'Just thinking about life... 🤔', images: [] },
    { content: '分享一下今天的小确幸 ✨', images: [] },
];

const DEFAULT_MOMENTS_DATA = {
    posts: [],
    lastAIPostTime: {}
};

export const MomentsProvider = ({ children }) => {
    const [momentsData, setMomentsData] = useLocalStorage('chat-buddy-moments', DEFAULT_MOMENTS_DATA);
    const aiPostIntervalRef = useRef(null);

    const posts = momentsData.posts || [];
    const lastAIPostTime = momentsData.lastAIPostTime || {};

    // ========== Post Management ==========

    // Create a new post
    const createPost = useCallback((content, images = [], video = null, authorId = 'user-me') => {
        const newPost = {
            id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            authorId,
            content,
            images,
            video,
            createdAt: new Date().toISOString(),
            likes: [],
            comments: []
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

    // Toggle like on a post
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

    // ========== Comments ==========

    // Add a comment
    const addComment = useCallback((postId, content, authorId = 'user-me') => {
        const newComment = {
            id: `cmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            authorId,
            content,
            createdAt: new Date().toISOString()
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
    }, [setMomentsData]);

    // Delete a comment
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

    // ========== AI Auto-Posting ==========

    // Generate a post for an AI character
    const generateAIPost = useCallback((aiId) => {
        const templates = AI_POST_TEMPLATES[aiId] || DEFAULT_TEMPLATES;
        const template = templates[Math.floor(Math.random() * templates.length)];

        createPost(template.content, template.images, null, aiId);

        // Update last post time
        setMomentsData(prev => ({
            ...prev,
            lastAIPostTime: {
                ...prev.lastAIPostTime,
                [aiId]: Date.now()
            }
        }));
    }, [createPost, setMomentsData]);

    // Trigger AI interactions (likes and comments) on a post
    const triggerAIInteractions = useCallback((postId) => {
        const post = posts.find(p => p.id === postId);
        if (!post || post.authorId !== 'user-me') return;

        // Random AIs will like the post
        const numLikes = Math.floor(Math.random() * 4) + 1; // 1-4 likes
        const shuffledPersonas = [...INITIAL_PERSONAS].sort(() => Math.random() - 0.5);

        shuffledPersonas.slice(0, numLikes).forEach((persona, index) => {
            setTimeout(() => {
                toggleLike(postId, persona.id);
            }, (index + 1) * (1000 + Math.random() * 2000));
        });

        // Maybe one AI will comment
        if (Math.random() > 0.5) {
            const commenter = shuffledPersonas[numLikes];
            if (commenter) {
                const comments = getAIComment(commenter.id);
                setTimeout(() => {
                    addComment(postId, comments, commenter.id);
                }, (numLikes + 1) * 2000 + Math.random() * 3000);
            }
        }
    }, [posts, toggleLike, addComment]);

    // Get AI comment based on personality
    const getAIComment = (aiId) => {
        const commentTemplates = {
            'ai-miku': ['Great post! ♪', '素敵！✨', 'Love it~', '好棒哦！'],
            'ai-rem': ['Wonderful!', '雷姆觉得很棒呢~', 'Take care!', '请多保重💙'],
            'ai-naruto': ['Awesome!!', '太酷了 dattebayo!', 'Believe it!', '我也要加油！'],
            'ai-l': ['Interesting...', '有趣的观察', 'Noted.', '概率上来说很有意思'],
            'ai-zerotwo': ['Nice, Darling~', 'Darling❤️', '蛮不错的嘛~', 'Sweet!'],
            'ai-gojo': ['Not as cool as me tho 😎', '还行吧~', 'Pretty good!', '有点意思'],
            'ai-rin': ['Hmph, not bad.', '还可以吧...', 'Impressive...', '别误会，不是在夸你！'],
            'ai-asuna': ['Lovely!', '很棒呢！❤️', 'So nice!', '加油！✨'],
        };
        const templates = commentTemplates[aiId] || ['Nice!', '👍', 'Great!', '不错！'];
        return templates[Math.floor(Math.random() * templates.length)];
    };

    // Check and generate AI posts periodically
    const checkAIPosts = useCallback(() => {
        const now = Date.now();
        const MIN_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
        const MAX_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

        INITIAL_PERSONAS.forEach(persona => {
            const lastPost = lastAIPostTime[persona.id] || 0;
            const interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);

            if (now - lastPost > interval) {
                // Random chance to post (not all at once)
                if (Math.random() > 0.7) {
                    generateAIPost(persona.id);
                }
            }
        });
    }, [lastAIPostTime, generateAIPost]);

    // Initialize with some AI posts if empty
    useEffect(() => {
        if (posts.length === 0) {
            // Generate initial posts from a few random AIs
            const initialAIs = [...INITIAL_PERSONAS]
                .sort(() => Math.random() - 0.5)
                .slice(0, 5);

            initialAIs.forEach((persona, index) => {
                setTimeout(() => generateAIPost(persona.id), index * 100);
            });
        }
    }, []); // Only run on mount

    // Periodic check for AI posts (every 30 minutes)
    useEffect(() => {
        aiPostIntervalRef.current = setInterval(checkAIPosts, 30 * 60 * 1000);
        return () => clearInterval(aiPostIntervalRef.current);
    }, [checkAIPosts]);

    // Get author info from personas
    const getAuthor = useCallback((authorId) => {
        if (authorId === 'user-me') {
            return { id: 'user-me', name: 'You', name_zh: '我', avatar: null };
        }
        return INITIAL_PERSONAS.find(p => p.id === authorId) || { id: authorId, name: 'Unknown', avatar: null };
    }, []);

    const value = {
        posts,
        createPost,
        deletePost,
        toggleLike,
        addComment,
        deleteComment,
        generateAIPost,
        triggerAIInteractions,
        getAuthor
    };

    return (
        <MomentsContext.Provider value={value}>
            {children}
        </MomentsContext.Provider>
    );
};
