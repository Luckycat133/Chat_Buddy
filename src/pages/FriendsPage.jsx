import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Users, ChevronRight, Settings, X, Clock, UserPlus } from 'lucide-react';
import { useChat } from '../features/chat/context/ChatContext';
import { useFriend } from '../context/FriendContext';
import { useLanguage } from '../context/LanguageContext';
import FriendDetail from '../components/FriendDetail';
import CharacterCreatorModal from '../components/CharacterCreatorModal';
import { SkeletonList, SkeletonFriendCard } from '../components/Skeleton';
import HighlightText from '../components/HighlightText';
import { cn } from '../utils/cn';
import { saveCustomPersona } from '../data/personas';

export default function FriendsPage() {
    const navigate = useNavigate();
    const { personas, addPersona } = useChat();
    const { groups, getFriendMeta, getDisplayName, getStarredFriends, getFriendsInGroup, getFriendSubtitle } = useFriend();
    const { t, language } = useLanguage();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'starred', or group id
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreator, setShowCreator] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

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
    const handleCreatePersona = (persona) => {
        saveCustomPersona({
            ...persona,
            agentType: 'social-companion'
        });
        addPersona?.({
            ...persona,
            agentType: 'social-companion'
        });
        setShowCreator(false);
    };

    return (
        <div className="page-container custom-scrollbar">
            {/* Ambient Background Glow */}
            <div className="page-ambient-glow" />

            <div className="page-content space-y-4">
                {/* Header - Premium with aurora accent */}
                <div className="page-header animate-fade-slide-down">
                    <div className="page-header-icon" style={{ background: 'var(--gradient-aurora-soft)' }}>
                        <Users size={22} className="text-[var(--color-primary)]" />
                    </div>
                    <div>
                        <h1 className="page-header-title">
                            {t('friends') || 'Friends'}
                        </h1>
                        <p className="page-header-desc">
                            {t('ai_companions_count', { count: personas.length })}
                        </p>
                    </div>
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={() => navigate('/friends/groups')}
                        className="btn btn-ghost btn-icon"
                        aria-label={t('friend_groups') || 'Friend groups'}
                    >
                        <Settings size={20} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowCreator(true)}
                        className="btn btn-ghost btn-icon ml-2"
                        title={t('create_custom_character') || 'Create Custom Character'}
                        aria-label={t('create_custom_character') || 'Create Custom Character'}
                    >
                        <UserPlus size={20} />
                    </button>
                </div>

                {/* Search - Premium */}
                <div className="px-1 animate-fade-slide-up" style={{ animationDelay: '100ms' }}>
                    <div className={cn(
                        "relative transition-all duration-300",
                        searchFocused && "scale-[1.01]"
                    )}>
                        <Search className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300",
                            searchFocused ? "text-[var(--color-primary)] scale-110" : "text-[var(--color-text-muted)]"
                        )} size={18} />
                        <input
                            type="text"
                            placeholder={t('search') || 'Search companions...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                            className={cn(
                                "w-full rounded-[var(--radius-xl)] border border-[var(--color-border)]",
                                "bg-[var(--color-bg-white)] text-[var(--color-text-main)]",
                                "py-3 pl-12 pr-10 text-[15px] font-medium placeholder:text-[var(--color-text-muted)]",
                                "focus:outline-none focus:border-[var(--color-primary)]",
                                searchFocused && "ring-4 ring-[var(--color-primary)]/10"
                            )}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full
                                    hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
                                aria-label={t('clear_search') || 'Clear search'}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Tabs - Premium Pills */}
                <div className="flex gap-2 py-2 overflow-x-auto scrollbar-hide px-1 animate-fade-slide-up" style={{ animationDelay: '150ms' }}>
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
                <div className="flex-1 px-1">
                    {isLoading ? (
                        <SkeletonList count={6} skeleton={SkeletonFriendCard} className="grid grid-cols-1 md:grid-cols-2 gap-3" />
                    ) : filteredFriends.length === 0 ? (
                        <div className="card flex flex-col items-center justify-center py-24 animate-fade-slide-up">
                            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-float"
                                style={{ background: 'var(--gradient-aurora-soft)' }}>
                                <Users size={40} className="text-[var(--color-primary)] opacity-80" />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-2">
                                {t('no_results') || 'No Friends Found'}
                            </h3>
                            <p className="text-[var(--color-text-muted)] text-center max-w-xs">
                                {t('no_friends_found_tip') || "Try searching for another name or check your group filters."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredFriends.map((friend, index) => {
                                const meta = getFriendMeta(friend.id);
                                const displayName = getDisplayName(friend, language);
                                const originalName = language === 'zh' ? (friend.name_zh || friend.name) : friend.name;
                                const friendGroup = groups.find(g => g.id === meta.groupId);
                                const { signature, recentActivity } = getFriendSubtitle(friend.id, language);

                                return (
                                    <button
                                        type="button"
                                        key={friend.id}
                                        onClick={() => setSelectedFriend(friend)}
                                        className="card w-full text-left p-4 hover:border-[var(--color-primary)]/40 hover:-translate-y-1
                                            active:scale-[0.98] cursor-pointer group animate-fade-slide-up"
                                        style={{ animationDelay: `${index * 30 + 200}ms` }}
                                        aria-label={`${t('view_profile') || 'View profile'}: ${displayName}`}
                                    >
                                        <div className="flex items-center">
                                            <div className="relative w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 mr-4
                                                shadow-glass-sm group-hover:shadow-glass group-hover:scale-105 transition-all duration-300">
                                                <img src={friend.avatar} alt={displayName} className="w-full h-full object-cover" />
                                                <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-[var(--color-success)]
                                                    rounded-full border-2 border-white dark:border-slate-800 shadow-sm" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base font-bold text-[var(--color-text-main)] truncate
                                                        group-hover:text-[var(--color-primary)] transition-colors font-display">
                                                        <HighlightText text={displayName} highlight={searchTerm} />
                                                    </span>
                                                    {meta.starred && (
                                                        <Star size={14} className="text-[var(--color-accent-gold)] fill-current flex-shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {meta.remark && displayName !== originalName && (
                                                        <span className="text-xs text-[var(--color-text-muted)] truncate">
                                                            {originalName}
                                                        </span>
                                                    )}
                                                    {friendGroup && (
                                                        <span
                                                            className="badge"
                                                            style={{ backgroundColor: friendGroup.color + '15', color: 'var(--color-text-main)', border: `1px solid ${friendGroup.color}30` }}
                                                        >
                                                            {friendGroup.icon} {language === 'zh' ? friendGroup.name : friendGroup.name_en}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <ChevronRight size={20} className="text-[var(--color-text-light)] group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all" />
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-[var(--color-border-light)]">
                                            <p className="text-sm text-[var(--color-text-secondary)] truncate italic">
                                                {signature}
                                            </p>
                                            {recentActivity && (
                                                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--color-text-muted)]">
                                                    <Clock size={12} />
                                                    <span>{recentActivity.timeAgo}</span>
                                                    <span className="text-[var(--color-text-light)]">{recentActivity.text}</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Friend Detail Modal */}
            {selectedFriend && (
                <FriendDetail
                    friend={selectedFriend}
                    onClose={() => setSelectedFriend(null)}
                />
            )}

            {showCreator && (
                <CharacterCreatorModal
                    isOpen={showCreator}
                    onClose={() => setShowCreator(false)}
                    onCreate={handleCreatePersona}
                />
            )}
        </div>
    );
}

function FilterTab({ active, onClick, label, count, highlight, color }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "min-h-11 px-4 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap flex items-center gap-1.5",
                "transition-all duration-300 shadow-sm border",
                active
                    ? "text-white shadow-md border-transparent animate-aurora"
                    : highlight
                        ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800/30 hover:shadow-md"
                        : color
                            ? "border-transparent hover:shadow-md"
                            : "bg-[var(--color-bg-white)] text-[var(--color-text-muted)] border-[var(--color-border-light)] hover:border-[var(--color-border)] hover:shadow-md"
            )}
            style={active
                ? { background: 'var(--gradient-aurora)', backgroundSize: '200% 200%' }
                : !highlight && color
                    ? { backgroundColor: color + '12', color: 'var(--color-text-main)', borderColor: color + '40' }
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
