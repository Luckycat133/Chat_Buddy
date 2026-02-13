import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Trash2, Megaphone, BarChart3, Download } from 'lucide-react';
import { useChat } from './context/ChatContext';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';
import GroupAnnouncement from './components/GroupAnnouncement';
import GroupPoll from './components/GroupPoll';

export default function GroupDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { chats, personas, deleteChat, updateChat, sendMessage, clearChatMessages } = useChat();
    const { t, language } = useLanguage();

    const chat = chats.find(c => c.id === id);
    const [name, setName] = useState(chat?.name || '');
    const [permissions, setPermissions] = useState(chat?.permissions || { allowReactions: true, allowImages: false });

    // Feature modals
    const [showAnnouncement, setShowAnnouncement] = useState(false);
    const [showPoll, setShowPoll] = useState(false);

    if (!chat) return <div className="flex items-center justify-center h-full bg-[var(--color-bg-app)] text-[var(--color-text-muted)]">{t('chat_not_found')}</div>;

    const handleSaveName = () => {
        if (name.trim()) {
            updateChat(id, { name });
        }
    };

    const togglePermission = (key, value) => {
        const newPerms = { ...permissions, [key]: value };
        setPermissions(newPerms);
        updateChat(id, { permissions: newPerms });
    };

    const handleDeleteChat = () => {
        if (window.confirm(t('confirm_delete'))) {
            deleteChat(id);
            navigate('/');
        }
    };

    const handleSaveAnnouncement = (announcementData) => {
        updateChat(id, { announcement: announcementData });
        // Optionally send a system message
        sendMessage(id, `${t('announcement_prefix')} ${announcementData.content}`);
    };

    const handleDeleteAnnouncement = () => {
        updateChat(id, { announcement: null });
    };

    const handleExportChat = () => {
        if (!chat.messages.length) {
            alert(t('no_messages_export') || 'No messages to export');
            return;
        }

        let content = `${chat.name} - Chat History\nExported: ${new Date().toLocaleString()}\n\n`;

        chat.messages.forEach(msg => {
            const sender = msg.senderId === 'user-me' ? t('me') : personas.find(p => p.id === msg.senderId)?.name || 'Unknown';
            const time = new Date(msg.timestamp).toLocaleString();
            content += `[${time}] ${sender}: ${msg.content}\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chat.name}_original_export.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCreatePoll = (poll) => {
        const currentPolls = chat.polls || [];
        updateChat(id, { polls: [poll, ...currentPolls] });
        sendMessage(id, `[POLL:${poll.id}]`);
    };

    const aiParticipants = chat.participants.filter(pid => pid !== 'user-me');

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto pb-16 md:pb-0">
            {/* Header */}
            <div className="bg-[var(--color-bg-app)] px-3 py-2.5 flex items-center gap-3 border-b border-[var(--color-border)]">
                <button onClick={() => navigate(-1)} className="text-[var(--color-text-main)]">
                    <ArrowLeft size={22} />
                </button>
                <h1 className="text-[17px] font-medium text-[var(--color-text-main)]">{t('chat_info_title')}</h1>
            </div>

            {/* Members Grid */}
            <div className="bg-[var(--color-bg-white)] p-4 mb-2">
                <div className="flex flex-wrap gap-4">
                    {aiParticipants.map(pid => {
                        const persona = personas.find(p => p.id === pid);
                        if (!persona) return null;
                        const pName = language === 'zh' ? (persona.name_zh || persona.name) : persona.name;
                        return (
                            <div key={pid} className="flex flex-col items-center w-14 cursor-pointer" onClick={() => {
                                const currentNickname = chat.nicknames?.[pid] || pName;
                                const newNickname = window.prompt(t('set_group_nickname'), currentNickname);
                                if (newNickname !== null) {
                                    const currentNicknames = chat.nicknames || {};
                                    updateChat(id, { nicknames: { ...currentNicknames, [pid]: newNickname } });
                                }
                            }}>
                                <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-[#E0E0E0] mb-1 relative">
                                    <img src={persona.avatar} alt={pName} className="w-full h-full object-cover" />
                                </div>
                                <span className="text-[12px] text-[var(--color-text-main)] text-center truncate w-full">
                                    {chat.nicknames?.[pid] || pName}
                                </span>
                            </div>
                        );
                    })}
                    {/* Add button */}
                    <div className="flex flex-col items-center w-14">
                        <div className="w-12 h-12 rounded-[4px] border-2 border-dashed border-[#C7C7CC] flex items-center justify-center mb-1 cursor-pointer">
                            <span className="text-[24px] text-[#C7C7CC]">+</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Group Name */}
            <div className="bg-[var(--color-bg-white)] mb-2">
                <div className="flex items-center px-4 py-3 border-b border-[var(--color-border-light)]">
                    <span className="text-[16px] text-[var(--color-text-main)] mr-4">{t('group_name_label')}</span>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleSaveName}
                        className="flex-1 text-right text-[16px] text-[var(--color-text-muted)] focus:outline-none"
                    />
                    <ChevronRight size={20} className="text-[#C7C7CC] ml-1" />
                </div>
            </div>

            {/* Group Features */}
            <div className="bg-[var(--color-bg-white)] mb-2">
                <div
                    className="flex items-center px-4 py-3 border-b border-[var(--color-border-light)] cursor-pointer active:bg-[var(--color-bg-hover)]"
                    onClick={() => setShowAnnouncement(true)}
                >
                    <Megaphone size={20} className="text-[var(--color-primary)] mr-3" />
                    <span className="flex-1 text-[16px] text-[var(--color-text-main)]">
                        {t('group_announcement')}
                    </span>
                    {chat.announcement && (
                        <span className="text-xs text-[var(--color-text-muted)] mr-2 truncate max-w-[100px]">
                            {chat.announcement.content}
                        </span>
                    )}
                    <ChevronRight size={20} className="text-[#C7C7CC]" />
                </div>
                <div
                    className="flex items-center px-4 py-3 border-b border-[var(--color-border-light)] cursor-pointer active:bg-[var(--color-bg-hover)]"
                    onClick={() => setShowPoll(true)}
                >
                    <BarChart3 size={20} className="text-[var(--color-primary)] mr-3" />
                    <span className="flex-1 text-[16px] text-[var(--color-text-main)]">
                        {t('group_poll')}
                    </span>
                    <ChevronRight size={20} className="text-[#C7C7CC]" />
                </div>
            </div>

            {/* Export */}
            <div className="bg-[var(--color-bg-white)] mb-2">
                <div
                    className="flex items-center px-4 py-3 border-b border-[var(--color-border-light)] cursor-pointer active:bg-[var(--color-bg-hover)]"
                    onClick={handleExportChat}
                >
                    <Download size={20} className="text-[var(--color-text-main)] mr-3" />
                    <span className="flex-1 text-[16px] text-[var(--color-text-main)]">
                        {t('export_chat_history')}
                    </span>
                    <ChevronRight size={20} className="text-[#C7C7CC]" />
                </div>
            </div>

            {/* AI Permissions */}
            <div className="bg-[var(--color-bg-white)] mb-2">
                <ToggleItem
                    label={t('allow_reactions')}
                    checked={permissions.allowReactions}
                    onChange={(v) => togglePermission('allowReactions', v)}
                />
                <ToggleItem
                    label={t('allow_images')}
                    checked={permissions.allowImages}
                    onChange={(v) => togglePermission('allowImages', v)}
                />
            </div>

            {/* Group Admin Settings */}
            <div className="bg-[var(--color-bg-white)] mb-2">
                <ToggleItem
                    label={t('mute_notifications')}
                    checked={chat.isMuted || false}
                    onChange={(v) => updateChat(id, { isMuted: v })}
                />
                <ToggleItem
                    label={t('admin_only_chat')}
                    checked={chat.adminOnly || false}
                    onChange={(v) => updateChat(id, { adminOnly: v })}
                />
            </div>

            {/* Danger Zone */}
            <div className="bg-[var(--color-bg-white)] mb-6">
                <button
                    onClick={() => {
                        if (window.confirm(t('confirm_clear_history'))) {
                            clearChatMessages(id);
                            alert(t('chat_history_cleared'));
                        }
                    }}
                    className="w-full px-4 py-3 text-center text-[var(--color-text-main)] text-[16px] border-b border-[var(--color-border-light)]"
                >
                    {t('clear_chat_history')}
                </button>
                <button
                    onClick={handleDeleteChat}
                    className="w-full px-4 py-3 text-center text-[#FA5151] text-[16px]"
                >
                    {t('delete_chat')}
                </button>
            </div>

            {/* Modals */}
            {
                showAnnouncement && (
                    <GroupAnnouncement
                        announcement={chat.announcement}
                        isAdmin={true} // Assuming current user is admin for now
                        onClose={() => setShowAnnouncement(false)}
                        onSave={handleSaveAnnouncement}
                        onDelete={handleDeleteAnnouncement}
                    />
                )
            }

            {
                showPoll && (
                    <GroupPoll
                        chatId={id}
                        onClose={() => setShowPoll(false)}
                        onCreatePoll={handleCreatePoll}
                    />
                )
            }
        </div >
    );
}

function ToggleItem({ label, checked, onChange }) {
    return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
            <span className="text-[16px] text-[var(--color-text-main)]">{label}</span>
            <button
                onClick={() => onChange(!checked)}
                className={cn(
                    "w-12 h-7 rounded-full transition-colors relative",
                    checked ? "bg-[var(--color-primary)]" : "bg-[#E5E5EA]"
                )}
            >
                <div
                    className={cn(
                        "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform",
                        checked ? "translate-x-5" : "translate-x-0.5"
                    )}
                />
            </button>
        </div>
    );
}
