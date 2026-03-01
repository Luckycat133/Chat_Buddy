import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit2, MessageCircle, Users, Calendar } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { useChat } from '../features/chat/context/ChatContext';

export default function UserProfile() {
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const { userProfile, getDisplayName } = useUser();
    const { chats } = useChat();

    // Calculate statistics
    const totalChats = chats.length;
    const totalMessages = chats.reduce((sum, chat) => {
        return sum + chat.messages.filter(m => m.senderId === 'user-me').length;
    }, 0);

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto pb-16 md:pb-0">
            {/* Header */}
            <div className="bg-[var(--color-bg-white)] sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <button onClick={() => navigate(-1)} className="flex items-center text-[var(--color-primary)]">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="font-medium text-[17px]">{t('my_profile') || 'My Profile'}</h1>
                <button
                    onClick={() => navigate('/profile/edit')}
                    className="text-[var(--color-primary)]"
                >
                    <Edit2 size={20} />
                </button>
            </div>

            {/* Profile Header */}
            <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pt-8 pb-16 relative">
                <div className="flex flex-col items-center">
                    {/* Avatar */}
                    <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl">
                        {userProfile.avatar ? (
                            <img
                                src={userProfile.avatar}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-white/20 flex items-center justify-center text-white text-4xl font-bold">
                                {getDisplayName(language).charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Nickname */}
                    <h2 className="mt-4 text-2xl font-bold text-white">
                        {getDisplayName(language)}
                    </h2>

                    {/* User ID */}
                    <p className="mt-1 text-white/70 text-sm">
                        ID: {userProfile.id}
                    </p>
                </div>
            </div>

            {/* Signature Card */}
            <div className="mx-4 -mt-8 relative z-10">
                <div className="bg-[var(--color-bg-white)] rounded-xl shadow-lg p-4">
                    <h3 className="text-[var(--color-text-muted)] text-sm mb-2">
                        {t('signature') || 'Signature'}
                    </h3>
                    <p className="text-[var(--color-text-main)] text-[15px] min-h-[40px]">
                        {userProfile.signature || (
                            <span className="text-[var(--color-text-light)] italic">
                                {t('signature_placeholder') || 'Say something about yourself...'}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Statistics */}
            <div className="mx-4 mt-4">
                <div className="bg-[var(--color-bg-white)] rounded-xl shadow-sm overflow-hidden">
                    <div className="grid grid-cols-2 divide-x divide-[var(--color-border-light)]">
                        <div className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                                <MessageCircle size={20} className="text-[var(--color-primary)]" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[var(--color-text-main)]">{totalMessages}</p>
                                <p className="text-[var(--color-text-muted)] text-sm">
                                    {t('messages_stat')}
                                </p>
                            </div>
                        </div>
                        <div className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                                <Users size={20} className="text-[var(--color-primary)]" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[var(--color-text-main)]">{totalChats}</p>
                                <p className="text-[var(--color-text-muted)] text-sm">
                                    {t('chats_stat')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Member Since */}
            <div className="mx-4 mt-4 mb-8">
                <div className="bg-[var(--color-bg-white)] rounded-xl shadow-sm p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                        <Calendar size={20} className="text-[var(--color-primary)]" />
                    </div>
                    <div>
                        <p className="text-[var(--color-text-muted)] text-sm">
                            {t('member_since')}
                        </p>
                        <p className="text-[var(--color-text-main)] font-medium">
                            {formatDate(userProfile.createdAt)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Edit Profile Button */}
            <div className="mx-4 mb-8">
                <button
                    onClick={() => navigate('/profile/edit')}
                    className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium shadow-lg hover:bg-[var(--color-primary-hover)] transition-all active:scale-[0.98]"
                >
                    {t('edit_profile') || 'Edit Profile'}
                </button>
            </div>
        </div>
    );
}
