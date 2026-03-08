import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, User, Edit2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import AvatarSelector from '../components/AvatarSelector';
import { cn } from '../utils/cn';

export default function ProfileEditor() {
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const { userProfile, updateNickname, updateAvatar, updateSignature, getDisplayName } = useUser();

    // Initialize directly from userProfile (available on mount)
    const [nickname, setNickname] = useState(userProfile.nickname || '');
    const [signature, setSignature] = useState(userProfile.signature || '');
    const [showAvatarSelector, setShowAvatarSelector] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [nicknameError, setNicknameError] = useState('');

    const handleSave = () => {
        const normalizedNickname = nickname.trim();
        if (!normalizedNickname) {
            setNicknameError(t('nickname_required') || (language === 'zh' ? '昵称不能为空' : 'Nickname is required'));
            return;
        }

        setIsSaving(true);
        updateNickname(normalizedNickname);
        updateSignature(signature);

        setTimeout(() => {
            setIsSaving(false);
            navigate(-1);
        }, 300);
    };

    const handleAvatarSelect = (avatar) => {
        updateAvatar(avatar);
    };

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto">
            {/* Header */}
            <div className="bg-[var(--color-bg-white)] sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <button onClick={() => navigate(-1)} className="flex items-center text-[var(--color-primary)]">
                    <ChevronLeft size={24} />
                    <span>{t('cancel') || 'Cancel'}</span>
                </button>
                <h1 className="font-medium text-[17px]">{t('edit_profile') || 'Edit Profile'}</h1>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={cn(
                        "text-[var(--color-primary)] font-medium",
                        isSaving && "opacity-50"
                    )}
                >
                    {t('save') || 'Save'}
                </button>
            </div>

            {/* Avatar Section */}
            <div className="bg-[var(--color-bg-white)] mt-2 py-6">
                <div className="flex flex-col items-center">
                    <button
                        onClick={() => setShowAvatarSelector(true)}
                        className="relative group"
                    >
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg">
                            {userProfile.avatar ? (
                                <img
                                    src={userProfile.avatar}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white text-3xl font-bold">
                                    {getDisplayName(language).charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera size={28} className="text-white" />
                        </div>
                    </button>
                    <span className="mt-2 text-[var(--color-text-muted)] text-sm">
                        {t('avatar') || 'Avatar'}
                    </span>
                </div>
            </div>

            {/* Nickname Section */}
            <div className="bg-[var(--color-bg-white)] mt-2">
                <div className="px-4 py-3 border-b border-[var(--color-border-light)]">
                    <label className="block text-[var(--color-text-muted)] text-sm mb-2">
                        {t('nickname') || 'Nickname'}
                    </label>
                    <div className="flex items-center gap-3">
                        <User size={20} className="text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => {
                                setNickname(e.target.value);
                                if (e.target.value.trim()) setNicknameError('');
                            }}
                            onBlur={(e) => setNickname(e.target.value)}
                            onInput={(e) => setNickname(e.target.value)}
                            placeholder={t('nickname_placeholder') || 'Enter your nickname'}
                            maxLength={20}
                            className="flex-1 py-2 text-[16px] bg-transparent outline-none placeholder:text-[var(--color-text-light)]"
                        />
                        <span className="text-[var(--color-text-light)] text-sm">
                            {nickname.length}/20
                        </span>
                    </div>
                    {nicknameError && (
                        <p className="text-sm text-red-500 mt-2">{nicknameError}</p>
                    )}
                </div>
            </div>

            {/* Signature Section */}
            <div className="bg-[var(--color-bg-white)] mt-2">
                <div className="px-4 py-3">
                    <label className="block text-[var(--color-text-muted)] text-sm mb-2">
                        {t('signature') || 'Signature / Status'}
                    </label>
                    <div className="flex items-start gap-3">
                        <Edit2 size={20} className="text-[var(--color-text-muted)] mt-2" />
                        <div className="flex-1">
                            <textarea
                                value={signature}
                                onChange={(e) => setSignature(e.target.value)}
                                placeholder={t('signature_placeholder') || 'Say something about yourself...'}
                                maxLength={100}
                                rows={3}
                                className="w-full py-2 text-[16px] bg-transparent outline-none resize-none placeholder:text-[var(--color-text-light)]"
                            />
                            <div className="text-right text-[var(--color-text-light)] text-sm">
                                {signature.length}/100
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* User ID (Read Only) */}
            <div className="bg-[var(--color-bg-white)] mt-2">
                <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[var(--color-text-muted)]">{t('user_id') || 'User ID'}</span>
                    <span className="text-[var(--color-text-main)]">{userProfile.id}</span>
                </div>
            </div>

            {/* Avatar Selector Modal */}
            {showAvatarSelector && (
                <AvatarSelector
                    isOpen={showAvatarSelector}
                    onClose={() => setShowAvatarSelector(false)}
                    currentAvatar={userProfile.avatar}
                    onSelect={handleAvatarSelect}
                />
            )}
        </div>
    );
}
