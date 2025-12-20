import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Send } from 'lucide-react';
import { useMoments } from '../context/MomentsContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

export default function PostComposer({ isOpen, onClose }) {
    const { createPost } = useMoments();
    const { userProfile, getDisplayName } = useUser();
    const { t, language } = useLanguage();

    const [content, setContent] = useState('');
    const [images, setImages] = useState([]);
    const [isPosting, setIsPosting] = useState(false);
    const fileInputRef = useRef(null);

    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Limit to 9 images total
        const remaining = 9 - images.length;
        const filesToProcess = files.slice(0, remaining);

        filesToProcess.forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                // Resize image
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 800;
                    let { width, height } = img;

                    if (width > height && width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    setImages(prev => [...prev, resizedDataUrl].slice(0, 9));
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Reset input
        e.target.value = '';
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handlePost = async () => {
        if (!content.trim() && images.length === 0) return;

        setIsPosting(true);

        // Create the post
        createPost(content.trim(), images);

        // Reset and close
        setContent('');
        setImages([]);
        setIsPosting(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <button
                    onClick={onClose}
                    className="text-[var(--color-text-muted)]"
                >
                    <X size={24} />
                </button>
                <h3 className="font-medium text-[17px]">{t('new_post') || 'New Moment'}</h3>
                <button
                    onClick={handlePost}
                    disabled={isPosting || (!content.trim() && images.length === 0)}
                    className={cn(
                        "px-4 py-1.5 rounded-full font-medium text-[14px] transition-all",
                        content.trim() || images.length > 0
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]"
                    )}
                >
                    {t('post') || 'Post'}
                </button>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--color-primary)]">
                    {userProfile.avatar ? (
                        <img src={userProfile.avatar} alt="You" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold">
                            {getDisplayName(language).charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <span className="font-medium text-[var(--color-text-main)]">
                    {getDisplayName(language)}
                </span>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('whats_new') || "What's on your mind?"}
                    className="w-full h-40 resize-none outline-none text-[16px] placeholder:text-[var(--color-text-light)]"
                    autoFocus
                />

                {/* Image Grid Preview */}
                {images.length > 0 && (
                    <div className={cn(
                        "grid gap-2 mt-4",
                        images.length === 1 && "grid-cols-1",
                        images.length === 2 && "grid-cols-2",
                        images.length >= 3 && "grid-cols-3"
                    )}>
                        {images.map((img, index) => (
                            <div key={index} className="relative aspect-square">
                                <img
                                    src={img}
                                    alt=""
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                    onClick={() => removeImage(index)}
                                    className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-[var(--color-border)] px-4 py-3">
                <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= 9}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                        images.length >= 9
                            ? "text-[var(--color-text-light)]"
                            : "text-[var(--color-primary)] hover:bg-[var(--color-bg-app)]"
                    )}
                >
                    <ImageIcon size={20} />
                    <span className="text-[14px]">
                        {t('add_photos') || 'Add Photos'} {images.length > 0 && `(${images.length}/9)`}
                    </span>
                </button>
            </div>
        </div>
    );
}
