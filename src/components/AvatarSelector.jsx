import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

// Preset avatars from public/avatars
const PRESET_AVATARS = [
    { id: 'miku', name: 'Miku', path: '/avatars/avatar_miku.png' },
    { id: 'rem', name: 'Rem', path: '/avatars/avatar_rem.png' },
    { id: 'rin', name: 'Rin', path: '/avatars/avatar_rin.png' },
    { id: 'naruto', name: 'Naruto', path: '/avatars/avatar_naruto.png' },
    { id: 'l', name: 'L', path: '/avatars/avatar_l.png' },
    { id: 'zerotwo', name: 'Zero Two', path: '/avatars/avatar_zerotwo.png' },
    { id: 'asuna', name: 'Asuna', path: '/avatars/avatar_asuna.png' },
    { id: 'gojo', name: 'Gojo', path: '/avatars/avatar_gojo.png' },
    { id: 'bella', name: 'Bella', path: '/avatars/avatar_bella.png' },
    { id: 'luna', name: 'Luna', path: '/avatars/avatar_luna.png' },
    { id: 'max', name: 'Max', path: '/avatars/avatar_max.png' },
    { id: 'oliver', name: 'Oliver', path: '/avatars/avatar_oliver.png' },
    { id: 'sophie', name: 'Sophie', path: '/avatars/avatar_sophie.png' },
];

export default function AvatarSelector({ isOpen, onClose, currentAvatar, onSelect }) {
    const { t } = useLanguage();
    const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setSelectedAvatar(currentAvatar);
    }, [currentAvatar, isOpen]);

    if (!isOpen) return null;

    const handlePresetSelect = (avatarPath) => {
        setSelectedAvatar(avatarPath);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert(t('unsupported_file_type') || 'Unsupported file type');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert(t('file_too_large') || 'File too large (max 2MB)');
            return;
        }

        setIsUploading(true);

        try {
            // Read and resize image
            const reader = new FileReader();
            reader.onload = async (event) => {
                const img = new Image();
                img.onload = () => {
                    // Create canvas for resizing
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 200;
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height = (height * MAX_SIZE) / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width = (width * MAX_SIZE) / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Draw resized image
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to base64
                    const base64 = canvas.toDataURL('image/jpeg', 0.85);
                    setSelectedAvatar(base64);
                    setIsUploading(false);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error uploading avatar:', error);
            setIsUploading(false);
        }
    };

    const handleConfirm = () => {
        onSelect(selectedAvatar);
        onClose();
    };

    const handleCancel = () => {
        setSelectedAvatar(currentAvatar);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl w-[90%] max-w-md max-h-[80vh] overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <button onClick={handleCancel} className="text-[var(--color-text-muted)]">
                        <X size={24} />
                    </button>
                    <h3 className="font-medium text-[17px]">{t('select_avatar') || 'Select Avatar'}</h3>
                    <button
                        onClick={handleConfirm}
                        className="text-[var(--color-primary)] font-medium"
                    >
                        {t('confirm') || 'Confirm'}
                    </button>
                </div>

                {/* Preview */}
                <div className="flex justify-center py-6 bg-[var(--color-bg-app)]">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg">
                            {selectedAvatar ? (
                                <img
                                    src={selectedAvatar}
                                    alt="Avatar preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white text-3xl font-bold">
                                    ?
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Upload Button */}
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className={cn(
                            "w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all",
                            "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
                            "hover:bg-[var(--color-primary)] hover:text-white",
                            isUploading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <Upload size={20} />
                        {isUploading ? (t('uploading') || 'Uploading...') : (t('upload_avatar') || 'Upload Photo')}
                    </button>
                </div>

                {/* Preset Avatars */}
                <div className="p-4 overflow-y-auto max-h-[300px]">
                    <h4 className="text-[var(--color-text-muted)] text-sm mb-3">
                        {t('preset_avatars') || 'Preset Avatars'}
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                        {PRESET_AVATARS.map((avatar) => (
                            <button
                                key={avatar.id}
                                onClick={() => handlePresetSelect(avatar.path)}
                                className={cn(
                                    "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                                    selectedAvatar === avatar.path
                                        ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary-light)]"
                                        : "border-transparent hover:border-[var(--color-border)]"
                                )}
                            >
                                <img
                                    src={avatar.path}
                                    alt={avatar.name}
                                    className="w-full h-full object-cover"
                                />
                                {selectedAvatar === avatar.path && (
                                    <div className="absolute inset-0 bg-[var(--color-primary)]/20 flex items-center justify-center">
                                        <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                                            <Check size={14} className="text-white" />
                                        </div>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
