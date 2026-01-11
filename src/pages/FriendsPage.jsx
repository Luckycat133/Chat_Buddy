import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Users, ChevronRight, Settings } from 'lucide-react';
import { useChat } from '../features/chat/context/ChatContext';
import { useFriend } from '../context/FriendContext';
import { useLanguage } from '../context/LanguageContext';
import FriendDetail from '../components/FriendDetail';
import { cn } from '../utils/cn';

export default function FriendsPage() {
    const navigate = useNavigate();
    const { personas } = useChat();
    const { groups, getFriendMeta, getDisplayName, getStarredFriends, getFriendsInGroup, getUngroupedFriends } = useFriend();
    const { t, language } = useLanguage();

    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'starred', or group id
    const [selectedFriend, setSelectedFriend] = useState(null);

    // Filter friends based on search and active filter
    const getFilteredFriends = () => {
        let filtered = personas;

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(p => {
                const displayName = getDisplayName(p, language);
                const originalName = language === 'zh' ? (p.name_zh || p.name) : p.name;
                return displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    originalName.toLowerCase().includes(searchTerm.toLowerCase());
            });
        }

        // Apply category filter
        if (activeFilter === 'starred') {
            filtered = getStarredFriends(filtered);
        } else if (activeFilter !== 'all') {
            filtered = getFriendsInGroup(activeFilter, filtered);
        }

        // Sort: starred first, then alphabetically
        return filtered.sort((a, b) => {
            const aMeta = getFriendMeta(a.id);
            const bMeta = getFriendMeta(b.id);
            if (aMeta.starred && !bMeta.starred) return -1;
            if (!aMeta.starred && bMeta.starred) return 1;
            return getDisplayName(a, language).localeCompare(getDisplayName(b, language));
        });
    };

    const filteredFriends = getFilteredFriends();
    const starredCount = getStarredFriends(personas).length;

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-hidden flex flex-col pb-16 md:pb-0">
            {/* Header */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-[var(--color-border)]">
                <h1 className="text-[17px] font-medium text-[var(--color-text-main)]">
                    {t('friends') || 'Friends'}
                </h1>
                <button
                    onClick={() => navigate('/friends/groups')}
                    className="text-[var(--color-primary)]"
                >
                    <Settings size={22} />
                </button>
            </div>

            {/* Search */}
            <div className="p-2 bg-[var(--color-bg-app)]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#B2B2B2]" size={14} />
                    <input
                        type="text"
                        placeholder={t('search') || 'Search'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border-none rounded py-1.5 pl-8 pr-3 text-sm placeholder:text-[#B2B2B2] focus:outline-none"
                    />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="bg-white px-2 py-2 flex gap-2 overflow-x-auto border-b border-[var(--color-border)]">
                <FilterTab
                    active={activeFilter === 'all'}
                    onClick={() => setActiveFilter('all')}
                    label={t('all_friends') || 'All'}
                    count={personas.length}
                />
                <FilterTab
                    active={activeFilter === 'starred'}
                    onClick={() => setActiveFilter('starred')}
                    label={<><Star size={14} className="inline mr-1" />{t('starred_friends') || 'Starred'}</>}
                    count={starredCount}
                    highlight
                />
                {groups.map(group => (
                    <FilterTab
                        key={group.id}
                        active={activeFilter === group.id}
                        onClick={() => setActiveFilter(group.id)}
                        label={<><span className="mr-1">{group.icon}</span>{language === 'zh' ? group.name : group.name_en}</>}
                        count={getFriendsInGroup(group.id, personas).length}
                        color={group.color}
                    />
                ))}
            </div>

            {/* Friend List */}
            <div className="flex-1 overflow-y-auto bg-white">
                {filteredFriends.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
                        <Users size={48} className="mb-4 opacity-50" />
                        <p>{t('no_friends_found') || 'No friends found'}</p>
                    </div>
                ) : (
                    filteredFriends.map((friend) => {
                        const meta = getFriendMeta(friend.id);
                        const displayName = getDisplayName(friend, language);
                        const originalName = language === 'zh' ? (friend.name_zh || friend.name) : friend.name;
                        const friendGroup = groups.find(g => g.id === meta.groupId);

                        return (
                            <div
                                key={friend.id}
                                onClick={() => setSelectedFriend(friend)}
                                className="flex items-center px-4 py-3 border-b border-[var(--color-border-light)] active:bg-[#ECECEC] cursor-pointer"
                            >
                                {/* Avatar */}
                                <div className="w-11 h-11 rounded-[4px] overflow-hidden flex-shrink-0 bg-[#E0E0E0] mr-3">
                                    <img src={friend.avatar} alt={displayName} className="w-full h-full object-cover" />
                                </div>

                                {/* Name and Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[16px] text-[var(--color-text-main)] truncate">
                                            {displayName}
                                        </span>
                                        {meta.starred && (
                                            <Star size={14} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {meta.remark && displayName !== originalName && (
                                            <span className="text-[12px] text-[var(--color-text-muted)]">
                                                ({originalName})
                                            </span>
                                        )}
                                        {friendGroup && (
                                            <span
                                                className="text-[11px] px-1.5 py-0.5 rounded-full"
                                                style={{ backgroundColor: friendGroup.color + '20', color: friendGroup.color }}
                                            >
                                                {friendGroup.icon} {language === 'zh' ? friendGroup.name : friendGroup.name_en}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <ChevronRight size={20} className="text-[#C7C7CC] flex-shrink-0" />
                            </div>
                        );
                    })
                )}
            </div>

            {/* Friend Detail Modal */}
            {selectedFriend && (
                <FriendDetail
                    friend={selectedFriend}
                    onClose={() => setSelectedFriend(null)}
                />
            )}
        </div>
    );
}

function FilterTab({ active, onClick, label, count, highlight, color }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap flex items-center gap-1 transition-all",
                active
                    ? "bg-[var(--color-primary)] text-white"
                    : highlight
                        ? "bg-yellow-100 text-yellow-700"
                        : color
                            ? "bg-opacity-20 text-[var(--color-text-main)]"
                            : "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]"
            )}
            style={!active && color ? { backgroundColor: color + '20', color: color } : {}}
        >
            {label}
            {count !== undefined && (
                <span className={cn(
                    "text-[11px] px-1.5 py-0.5 rounded-full",
                    active ? "bg-white/20 text-white" : "bg-black/5"
                )}>
                    {count}
                </span>
            )}
        </button>
    );
}
