import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const FriendContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useFriend = () => {
    const context = useContext(FriendContext);
    if (!context) throw new Error('useFriend must be used within a FriendProvider');
    return context;
};

// Default groups
const DEFAULT_GROUPS = [
    { id: 'group-anime', name: '二次元', name_en: 'Anime', color: '#FF6B9D', icon: '🌸' },
    { id: 'group-study', name: '学习伙伴', name_en: 'Study Buddies', color: '#4ECDC4', icon: '📚' }
];

// Default signatures for AI friends (used when no custom signature)
const DEFAULT_SIGNATURES = {
    'ai-1': { en: 'Dreaming under the stars ✨', zh: '在星空下做梦 ✨' },
    'ai-2': { en: 'Coding something cool 🎮', zh: '正在写很酷的代码 🎮' },
    'ai-3': { en: 'Cooking up something yummy! 🍰', zh: '正在做美味的食物！🍰' },
    'ai-4': { en: 'Lost in a good book 📖', zh: '沉浸在好书之中 📖' },
    'ai-5': { en: 'Ready for a workout! 💪', zh: '准备好锻炼了！💪' },
    'ai-miku': { en: 'Singing my heart out! ♪', zh: '用心歌唱！♪' },
    'ai-rem': { en: 'Here to serve, Master 🫖', zh: '主人，我在这里为您服务 🫖' },
    'ai-rin': { en: 'Perfecting my craft 💎', zh: '追求完美 💎' },
    'ai-naruto': { en: 'Training to be Hokage! 🍥', zh: '朝着火影的目标训练！🍥' },
    'ai-l': { en: 'Thinking... probability: 97% 🔍', zh: '思考中...概率：97% 🔍' },
    'ai-zerotwo': { en: 'Looking for my Darling 🌸', zh: '寻找我的Darling 🌸' },
    'ai-asuna': { en: 'Ready for adventure ⚔️', zh: '准备好冒险了 ⚔️' },
    'ai-gojo': { en: 'The strongest is here 😎', zh: '最强的人来了 😎' },
    'agent-coder': { en: 'Ready to debug your code 💻', zh: '准备好调试你的代码 💻' },
    'agent-muse': { en: 'Crafting words into magic ✍️', zh: '将文字变成魔法 ✍️' },
    'agent-scholar': { en: 'Searching for truth 🔬', zh: '探索真理 🔬' },
    'agent-sensei': { en: 'What do you want to learn today? 📚', zh: '今天想学什么？📚' },
    'agent-aurora': { en: 'Here to listen 💗', zh: '在这里倾听 💗' },
    'agent-pixel': { en: 'Creating visual magic 🎨', zh: '创造视觉魔法 🎨' }
};

// Activity types for interaction records
const ACTIVITY_TYPES = {
    VIEWED_MOMENT: { en: 'viewed your moment', zh: '查看了你的动态' },
    SENT_GIFT: { en: 'sent you a gift', zh: '送了你一份礼物' },
    CHATTED: { en: 'had a chat with you', zh: '和你聊了天' },
    LIKED_MOMENT: { en: 'liked your moment', zh: '赞了你的动态' },
    COMMENTED: { en: 'commented on your moment', zh: '评论了你的动态' },
    MENTIONED: { en: 'mentioned you', zh: '提到了你' }
};

const DEFAULT_FRIEND_DATA = {
    groups: DEFAULT_GROUPS,
    friendMeta: {},
    interactions: {}
};

export const FriendProvider = ({ children }) => {
    const [friendData, setFriendData] = useLocalStorage('chat-buddy-friend-data', DEFAULT_FRIEND_DATA);

    // Ensure groups and friendMeta exist (memoized to prevent dependency churn)
    const groups = friendData.groups || DEFAULT_GROUPS;
    const friendMeta = useMemo(() => friendData.friendMeta || {}, [friendData.friendMeta]);

    // ========== Group Management ==========

    // Add new group
    const addGroup = useCallback((name, name_en, color, icon) => {
        const newGroup = {
            id: `group-${Date.now()}`,
            name,
            name_en: name_en || name,
            color: color || '#808080',
            icon: icon || '📁'
        };
        setFriendData(prev => ({
            ...prev,
            groups: [...(prev.groups || []), newGroup]
        }));
        return newGroup.id;
    }, [setFriendData]);

    // Update group
    const updateGroup = useCallback((groupId, updates) => {
        setFriendData(prev => ({
            ...prev,
            groups: (prev.groups || []).map(g =>
                g.id === groupId ? { ...g, ...updates } : g
            )
        }));
    }, [setFriendData]);

    // Delete group (moves friends to ungrouped)
    const deleteGroup = useCallback((groupId) => {
        setFriendData(prev => {
            // Remove group
            const newGroups = (prev.groups || []).filter(g => g.id !== groupId);

            // Unassign friends from this group
            const newFriendMeta = { ...prev.friendMeta };
            Object.keys(newFriendMeta).forEach(friendId => {
                if (newFriendMeta[friendId]?.groupId === groupId) {
                    newFriendMeta[friendId] = { ...newFriendMeta[friendId], groupId: null };
                }
            });

            return {
                ...prev,
                groups: newGroups,
                friendMeta: newFriendMeta
            };
        });
    }, [setFriendData]);

    // ========== Friend Metadata ==========

    // Get friend metadata
    const getFriendMeta = useCallback((friendId) => {
        return friendMeta[friendId] || { starred: false, groupId: null, remark: '', pinned: false };
    }, [friendMeta]);

    // Toggle star status
    const toggleStar = useCallback((friendId) => {
        setFriendData(prev => {
            const currentMeta = prev.friendMeta?.[friendId] || {};
            return {
                ...prev,
                friendMeta: {
                    ...prev.friendMeta,
                    [friendId]: {
                        ...currentMeta,
                        starred: !currentMeta.starred
                    }
                }
            };
        });
    }, [setFriendData]);

    // Set remark name
    const setRemark = useCallback((friendId, remark) => {
        setFriendData(prev => {
            const currentMeta = prev.friendMeta?.[friendId] || {};
            return {
                ...prev,
                friendMeta: {
                    ...prev.friendMeta,
                    [friendId]: {
                        ...currentMeta,
                        remark: remark.slice(0, 20) // Max 20 chars
                    }
                }
            };
        });
    }, [setFriendData]);

    // Set friend group
    const setFriendGroup = useCallback((friendId, groupId) => {
        setFriendData(prev => {
            const currentMeta = prev.friendMeta?.[friendId] || {};
            return {
                ...prev,
                friendMeta: {
                    ...prev.friendMeta,
                    [friendId]: {
                        ...currentMeta,
                        groupId
                    }
                }
            };
        });
    }, [setFriendData]);

    // Toggle pinned status
    const togglePinned = useCallback((friendId) => {
        setFriendData(prev => {
            const currentMeta = prev.friendMeta?.[friendId] || {};
            return {
                ...prev,
                friendMeta: {
                    ...prev.friendMeta,
                    [friendId]: {
                        ...currentMeta,
                        pinned: !currentMeta.pinned
                    }
                }
            };
        });
    }, [setFriendData]);

    // Get display name (remark or original name)
    const getDisplayName = useCallback((friend, language = 'en') => {
        const meta = friendMeta[friend.id];
        if (meta?.remark) return meta.remark;
        return language === 'zh' ? (friend.name_zh || friend.name) : friend.name;
    }, [friendMeta]);

    // Get group for friend
    const getFriendGroup = useCallback((friendId) => {
        const meta = friendMeta[friendId];
        if (!meta?.groupId) return null;
        return groups.find(g => g.id === meta.groupId) || null;
    }, [friendMeta, groups]);

    // Get friends in a group
    const getFriendsInGroup = useCallback((groupId, allFriends) => {
        return allFriends.filter(f => {
            const meta = friendMeta[f.id];
            return meta?.groupId === groupId;
        });
    }, [friendMeta]);

    // Get starred friends
    const getStarredFriends = useCallback((allFriends) => {
        return allFriends.filter(f => friendMeta[f.id]?.starred);
    }, [friendMeta]);

    // Get ungrouped friends
    const getUngroupedFriends = useCallback((allFriends) => {
        return allFriends.filter(f => {
            const meta = friendMeta[f.id];
            return !meta?.groupId;
        });
    }, [friendMeta]);

    // ========== Signature System ==========

    const getSignature = useCallback((friendId, language = 'en') => {
        const meta = friendMeta[friendId];
        if (meta?.signature) return meta.signature;
        const defaultSig = DEFAULT_SIGNATURES[friendId];
        if (defaultSig) return language === 'zh' ? defaultSig.zh : defaultSig.en;
        return language === 'zh' ? '这个AI很神秘，什么都没写~' : 'This AI is mysterious...';
    }, [friendMeta]);

    const setSignature = useCallback((friendId, signature) => {
        setFriendData(prev => {
            const currentMeta = prev.friendMeta?.[friendId] || {};
            return {
                ...prev,
                friendMeta: {
                    ...prev.friendMeta,
                    [friendId]: {
                        ...currentMeta,
                        signature: signature.slice(0, 50)
                    }
                }
            };
        });
    }, [setFriendData]);

    // ========== Interaction Records ==========

    const interactions = useMemo(() => friendData.interactions || {}, [friendData.interactions]);

    const recordInteraction = useCallback((friendId, activityType) => {
        const activity = ACTIVITY_TYPES[activityType];
        if (!activity) return;

        setFriendData(prev => {
            const currentInteractions = prev.interactions || {};
            const friendInteractions = currentInteractions[friendId] || [];
            return {
                ...prev,
                interactions: {
                    ...currentInteractions,
                    [friendId]: [
                        {
                            type: activityType,
                            timestamp: new Date().toISOString()
                        },
                        ...friendInteractions.slice(0, 9)
                    ]
                }
            };
        });
    }, [setFriendData]);

    const getRecentActivity = useCallback((friendId, language = 'en') => {
        const friendInteractions = interactions[friendId] || [];
        if (friendInteractions.length === 0) return null;

        const latest = friendInteractions[0];
        const activity = ACTIVITY_TYPES[latest.type];
        if (!activity) return null;

        const timestamp = new Date(latest.timestamp);
        const now = new Date();
        const diffMs = now - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeAgo;
        if (language === 'zh') {
            if (diffMins < 1) timeAgo = '刚刚';
            else if (diffMins < 60) timeAgo = `${diffMins}分钟前`;
            else if (diffHours < 24) timeAgo = `${diffHours}小时前`;
            else if (diffDays < 7) timeAgo = `${diffDays}天前`;
            else timeAgo = timestamp.toLocaleDateString('zh-CN');
        } else {
            if (diffMins < 1) timeAgo = 'just now';
            else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
            else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
            else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
            else timeAgo = timestamp.toLocaleDateString('en-US');
        }

        return {
            text: language === 'zh' ? activity.zh : activity.en,
            timeAgo,
            timestamp: latest.timestamp
        };
    }, [interactions]);

    const getFriendSubtitle = useCallback((friendId, language = 'en') => {
        const signature = getSignature(friendId, language);
        const activity = getRecentActivity(friendId, language);
        return { signature, recentActivity: activity };
    }, [getSignature, getRecentActivity]);

    const value = {
        groups,
        friendMeta,
        interactions,
        addGroup,
        updateGroup,
        deleteGroup,
        getFriendMeta,
        toggleStar,
        setRemark,
        setFriendGroup,
        togglePinned,
        getDisplayName,
        getFriendGroup,
        getFriendsInGroup,
        getStarredFriends,
        getUngroupedFriends,
        getSignature,
        setSignature,
        recordInteraction,
        getRecentActivity,
        getFriendSubtitle
    };

    return (
        <FriendContext.Provider value={value}>
            {children}
        </FriendContext.Provider>
    );
};
