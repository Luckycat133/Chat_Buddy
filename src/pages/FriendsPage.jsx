import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Users, ChevronRight, Settings, Sparkles, X } from 'lucide-react';
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
    const [searchFocused, setSearchFocused] = useState(false);
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
            {/* Header - Premium with aurora accent */}
            <div className="glass-strong px-4 py-4 flex items-center justify-between border-b border-[var(--color-border-light)]
                sticky top-0 z-20 animate-fade-slide-down">
                {/* Aurora accent */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] opacity-40"
                    style={{ background: 'var(--gradient-aurora)' }} />
                
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ background: 'var(--gradient-aurora-soft)' }}>
                        <Users size={20} className="text-[var(--color-primary)]" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-[var(--color-text-main)] font-display">
                            {t('friends') || 'Friends'}
                        </h1>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {personas.length} {language === 'zh' ? '位AI伙伴' : 'AI companions'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/friends/groups')}
                    className="p-2.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)]
                        hover:bg-[var(--color-bg-hover)] transition-all duration-200"
                >
                    <Settings size={22} />
                </button>
            </div>

            {/* Search - Premium */}
            <div className="p-4 bg-[var(--color-bg-app)]">
                <div className={cn(
                    "relative transition-all duration-300",
                    searchFocused && "scale-[1.02]"
                )}>
                    <Search className={cn(
                        "absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300",
                        searchFocused ? "text-[var(--color-primary)] scale-110" : "text-[var(--color-text-muted)]"
                    )} size={18} />
                    <input
                        type="text"
                        placeholder={t('search') || 'Search'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        className={cn(
                            "w-full bg-white border-2 rounded-xl py-3 pl-11 pr-10 text-sm",
                            "text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]",
                            "focus:outline-none transition-all duration-300 shadow-sm",
                            searchFocused
                                ? "border-[var(--color-primary)] shadow-lg"
                                : "border-transparent hover:border-[var(--color-border)]"
                        )}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full
                                hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Tabs - Premium Pills */}
            <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
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

            {/* Friend List - Card style */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {filteredFriends.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 animate-fade-slide-up">
                        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-float"
                            style={{ background: 'var(--gradient-aurora-soft)' }}>
                            <Users size={40} className="text-[var(--color-primary)] opacity-80" />
                        </div>
                        <p className="text-[var(--color-text-muted)] text-center">
                            {t('no_friends_found') || 'No friends found'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredFriends.map((friend, index) => {
                            const meta = getFriendMeta(friend.id);
                            const displayName = getDisplayName(friend, language);
                            const originalName = language === 'zh' ? (friend.name_zh || friend.name) : friend.name;
                            const friendGroup = groups.find(g => g.id === meta.groupId);

                            return (
                                <div
                                    key={friend.id}
                                    onClick={() => setSelectedFriend(friend)}
                                    className="flex items-center px-4 py-3.5 bg-white rounded-2xl shadow-sm
                                        border border-transparent hover:border-[var(--color-border-aurora)]
                                        hover:shadow-md active:scale-[0.99] cursor-pointer
                                        transition-all duration-300 group animate-fade-slide-up"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    {/* Avatar with hover effect */}
                                    <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 mr-4
                                        shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-300">
                                        <img src={friend.avatar} alt={displayName} className="w-full h-full object-cover" />
                                        {/* Online indicator */}
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[var(--color-success)]
                                            rounded-full border-2 border-white shadow-sm" />
                                    </div>

                                    {/* Name and Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[15px] font-semibold text-[var(--color-text-main)] truncate
                                                group-hover:text-[var(--color-primary)] transition-colors">
                                                {displayName}
                                            </span>
                                            {meta.starred && (
                                                <Star size={14} className="text-[var(--color-accent-gold)] fill-current flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {meta.remark && displayName !== originalName && (
                                                <span className="text-[12px] text-[var(--color-text-muted)]">
                                                    ({originalName})
                                                </span>
                                            )}
                                            {friendGroup && (
                                                <span
                                                    className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                                                    style={{ backgroundColor: friendGroup.color + '15', color: friendGroup.color }}
                                                >
                                                    {friendGroup.icon} {language === 'zh' ? friendGroup.name : friendGroup.name_en}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <ChevronRight size={20} className="text-[var(--color-text-light)] flex-shrink-0
                                        group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all" />
                                </div>
                            );
                        })}
                    </div>
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
                "px-4 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap flex items-center gap-1.5",
                "transition-all duration-300 shadow-sm border",
                active
                    ? "text-white shadow-md border-transparent animate-aurora"
                    : highlight
                        ? "bg-amber-50 text-amber-700 border-amber-100 hover:shadow-md"
                        : color
                            ? "border-transparent hover:shadow-md"
                            : "bg-white text-[var(--color-text-muted)] border-[var(--color-border-light)] hover:border-[var(--color-border)] hover:shadow-md"
            )}
            style={active 
                ? { background: 'var(--gradient-aurora)', backgroundSize: '200% 200%' }
                : !highlight && color 
                    ? { backgroundColor: color + '12', color: color, borderColor: color + '30' } 
                    : {}
            }
        >
            {label}
            {count !== undefined && (
                <span className={cn(
                    "text-[11px] px-1.5 py-0.5 rounded-full font-medium",
                    active ? "bg-white/25 text-white" : "bg-black/5"
                )}>
                    {count}
                </span>
            )}
        </button>
    );
}
