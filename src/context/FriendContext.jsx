import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const FriendContext = createContext();

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

const DEFAULT_FRIEND_DATA = {
    groups: DEFAULT_GROUPS,
    friendMeta: {}
};

export const FriendProvider = ({ children }) => {
    const [friendData, setFriendData] = useLocalStorage('chat-buddy-friend-data', DEFAULT_FRIEND_DATA);

    // Ensure groups and friendMeta exist
    const groups = friendData.groups || DEFAULT_GROUPS;
    const friendMeta = friendData.friendMeta || {};

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

    const value = {
        groups,
        friendMeta,
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
        getUngroupedFriends
    };

    return (
        <FriendContext.Provider value={value}>
            {children}
        </FriendContext.Provider>
    );
};
