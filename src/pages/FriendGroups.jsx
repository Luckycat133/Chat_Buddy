import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Edit2, Trash2, X, Check, Users } from 'lucide-react';
import { useFriend } from '../context/FriendContext';
import { useChat } from '../features/chat/context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

// Preset colors for groups
const PRESET_COLORS = [
    '#FF6B9D', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#FF6F61'
];

// Preset icons for groups
const PRESET_ICONS = [
    '🌸', '📚', '🎮', '🎵', '💼', '❤️',
    '⭐', '🔥', '💎', '🎯', '🌟', '🎨'
];

export default function FriendGroups() {
    const navigate = useNavigate();
    const { groups, addGroup, updateGroup, deleteGroup, getFriendsInGroup } = useFriend();
    const { personas } = useChat();
    const { t, language } = useLanguage();

    const [editingGroup, setEditingGroup] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupNameEn, setNewGroupNameEn] = useState('');
    const [newGroupColor, setNewGroupColor] = useState(PRESET_COLORS[0]);
    const [newGroupIcon, setNewGroupIcon] = useState(PRESET_ICONS[0]);

    const handleAddGroup = () => {
        if (!newGroupName.trim()) return;
        addGroup(newGroupName.trim(), newGroupNameEn.trim() || newGroupName.trim(), newGroupColor, newGroupIcon);
        resetForm();
    };

    const handleUpdateGroup = () => {
        if (!editingGroup || !newGroupName.trim()) return;
        updateGroup(editingGroup.id, {
            name: newGroupName.trim(),
            name_en: newGroupNameEn.trim() || newGroupName.trim(),
            color: newGroupColor,
            icon: newGroupIcon
        });
        resetForm();
    };

    const handleDeleteGroup = (groupId) => {
        if (confirm(t('confirm_delete_group') || 'Delete this group? Friends will be moved to Ungrouped.')) {
            deleteGroup(groupId);
        }
    };

    const startEditing = (group) => {
        setEditingGroup(group);
        setNewGroupName(group.name);
        setNewGroupNameEn(group.name_en);
        setNewGroupColor(group.color);
        setNewGroupIcon(group.icon);
        setIsAdding(false);
    };

    const startAdding = () => {
        setIsAdding(true);
        setEditingGroup(null);
        setNewGroupName('');
        setNewGroupNameEn('');
        setNewGroupColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
        setNewGroupIcon(PRESET_ICONS[Math.floor(Math.random() * PRESET_ICONS.length)]);
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingGroup(null);
        setNewGroupName('');
        setNewGroupNameEn('');
    };

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto pb-16 md:pb-0">
            {/* Header */}
            <div className="bg-[var(--color-bg-white)] sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <button onClick={() => navigate(-1)} className="flex items-center text-[var(--color-primary)]">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="font-medium text-[17px]">{t('friend_groups') || 'Friend Groups'}</h1>
                <button onClick={startAdding} className="text-[var(--color-primary)]">
                    <Plus size={24} />
                </button>
            </div>

            {/* Add/Edit Form */}
            {(isAdding || editingGroup) && (
                <div className="bg-[var(--color-bg-white)] m-4 rounded-xl shadow-lg overflow-hidden animate-scale-in">
                    <div className="p-4 border-b border-[var(--color-border)]">
                        <h3 className="font-medium text-[15px] mb-4">
                            {editingGroup ? (t('edit_group') || 'Edit Group') : (t('add_group') || 'Add Group')}
                        </h3>

                        {/* Group Name */}
                        <div className="mb-3">
                            <label className="text-[var(--color-text-muted)] text-sm mb-1 block">
                                {t('group_name') || 'Group Name'} ({t('group_name_zh_label') || 'Chinese'})
                            </label>
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder={t('group_name_zh_placeholder') || 'e.g. Anime'}
                                maxLength={10}
                                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-[15px] outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>

                        <div className="mb-3">
                            <label className="text-[var(--color-text-muted)] text-sm mb-1 block">
                                {t('group_name') || 'Group Name'} (English)
                            </label>
                            <input
                                type="text"
                                value={newGroupNameEn}
                                onChange={(e) => setNewGroupNameEn(e.target.value)}
                                placeholder="e.g. Anime"
                                maxLength={15}
                                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-[15px] outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>

                        {/* Icon Selector */}
                        <div className="mb-3">
                            <label className="text-[var(--color-text-muted)] text-sm mb-2 block">
                                {t('group_icon') || 'Icon'}
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_ICONS.map((icon) => (
                                    <button
                                        key={icon}
                                        onClick={() => setNewGroupIcon(icon)}
                                        className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all",
                                            newGroupIcon === icon
                                                ? "bg-[var(--color-primary)] ring-2 ring-[var(--color-primary)]"
                                                : "bg-[var(--color-bg-app)] hover:bg-[var(--color-border)]"
                                        )}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Color Selector */}
                        <div className="mb-3">
                            <label className="text-[var(--color-text-muted)] text-sm mb-2 block">
                                {t('group_color') || 'Color'}
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setNewGroupColor(color)}
                                        className={cn(
                                            "w-8 h-8 rounded-full transition-all",
                                            newGroupColor === color && "ring-2 ring-offset-2 ring-[var(--color-primary)]"
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex">
                        <button
                            onClick={resetForm}
                            className="flex-1 py-3 text-[var(--color-text-muted)] font-medium border-r border-[var(--color-border)]"
                        >
                            {t('cancel') || 'Cancel'}
                        </button>
                        <button
                            onClick={editingGroup ? handleUpdateGroup : handleAddGroup}
                            disabled={!newGroupName.trim()}
                            className={cn(
                                "flex-1 py-3 font-medium",
                                newGroupName.trim()
                                    ? "text-[var(--color-primary)]"
                                    : "text-[var(--color-text-light)]"
                            )}
                        >
                            {t('save') || 'Save'}
                        </button>
                    </div>
                </div>
            )}

            {/* Groups List */}
            <div className="bg-[var(--color-bg-white)] mt-2">
                {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
                        <Users size={48} className="mb-4 opacity-50" />
                        <p>{t('no_groups') || 'No groups yet'}</p>
                        <button
                            onClick={startAdding}
                            className="mt-4 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-lg font-medium"
                        >
                            {t('add_group') || 'Add Group'}
                        </button>
                    </div>
                ) : (
                    groups.map((group) => {
                        const memberCount = getFriendsInGroup(group.id, personas).length;
                        return (
                            <div
                                key={group.id}
                                className="flex items-center px-4 py-3 border-b border-[var(--color-border-light)]"
                            >
                                {/* Icon */}
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mr-3"
                                    style={{ backgroundColor: group.color + '20' }}
                                >
                                    {group.icon}
                                </div>

                                {/* Name and Count */}
                                <div className="flex-1">
                                    <div className="font-medium text-[var(--color-text-main)]">
                                        {language === 'zh' ? group.name : group.name_en}
                                    </div>
                                    <div className="text-[var(--color-text-muted)] text-sm">
                                        {memberCount} {t('friend_count') || 'friends'}
                                    </div>
                                </div>

                                {/* Actions */}
                                <button
                                    onClick={() => startEditing(group)}
                                    className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button
                                    onClick={() => handleDeleteGroup(group.id)}
                                    className="p-2 text-[var(--color-text-muted)] hover:text-red-500"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Tips */}
            <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">
                {t('group_tip') || 'Tip: Assign friends to groups from their detail page'}
            </div>
        </div>
    );
}
