import React, { useState, useRef, useEffect } from 'react';
import {
    Smile, Paperclip, Mic, Send, X,
    Image as ImageIcon, Gift, Heart,
    Gamepad2, BarChart3, Coins, Plus, Keyboard
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useLanguage } from '../../../../context/LanguageContext';
import { useDraft } from '../../hooks/useDraft';
import { cn } from '../../../../utils/cn';
import EmojiPicker from '../../../../components/EmojiPicker';
import StickerPicker from '../../../../components/StickerPicker';
import FileUploader from '../../../../components/FileUploader';

// Menu Button Helper
const MenuButton = ({ icon: IconComponent, label, onClick, color = "text-[var(--color-text-secondary)]", bg = "bg-[var(--color-bg-hover)]" }) => (
    <button
        type="button"
        onClick={onClick}
        className="plus-menu-btn group"
        aria-label={label}
    >
        <div className={cn("plus-menu-btn-icon", bg)}>
            <IconComponent size={24} className={color} />
        </div>
        <span className="plus-menu-btn-label">{label}</span>
    </button>
);

export default function ChatComposer({ chat, onSendMessage, onSendFile, onSendSticker, quotedMessage: externalQuotedMessage, onCancelQuote, onOpenGift, onOpenRedPacket, onOpenGame, onOpenPoll, onError }) {
    const { t, language } = useLanguage();
    const { personas } = useChat();

    // T07: Draft auto-save
    const {
        draftContent,
        updateDraftContent,
        clearDraft
    } = useDraft(chat?.id);

    const [inputValue, setInputValue] = useState(() => draftContent || '');
    const [internalQuotedMessage, setInternalQuotedMessage] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showFileUploader, setShowFileUploader] = useState(false);
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const inputRef = useRef(null);
    const [recordingStart, setRecordingStart] = useState(0);
    const [isRecordingMode, setIsRecordingMode] = useState(false);
    const prevDraftContentRef = useRef(draftContent);

    // Mention state
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionCandidates, setMentionCandidates] = useState([]);
    const [_mentionQuery, setMentionQuery] = useState('');

    // T07: Sync input with draft when chat changes
    useEffect(() => {
        if (draftContent !== prevDraftContentRef.current) {
            // Defer setState to avoid cascading renders
            requestAnimationFrame(() => {
                setInputValue(draftContent || '');
                prevDraftContentRef.current = draftContent;
            });
        }
    }, [draftContent]);

    // Combine external and internal quoted message
    const quotedMessage = externalQuotedMessage || internalQuotedMessage;

    const headerInfo = (() => {
        if (!chat) return {};
        const isDM = chat.participants.length === 2;
        if (isDM) {
            const otherId = chat.participants.find(p => p !== 'user-me');
            const other = personas.find(p => p.id === otherId);
            return other || {};
        }
        return { name: chat.name, id: chat.id };
    })();

    // Close all popups
    const closeAll = () => {
        setShowEmojiPicker(false);
        setShowStickerPicker(false);
        setShowPlusMenu(false);
        setShowFileUploader(false);
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);

        // T07: Auto-save draft
        updateDraftContent(val, quotedMessage?.id || null);

        // Detect mention trigger '@'
        const lastChar = val.slice(-1);
        if (lastChar === '@') {
            setShowMentionDropdown(true);
            setMentionQuery('');
            setMentionCandidates(
                chat.participants
                    .filter(pid => pid !== 'user-me')
                    .map(pid => personas.find(p => p.id === pid))
                    .filter(Boolean)
            );
        } else if (showMentionDropdown) {
            // Simple logic: if space, close. If typing, filter (simplified)
            if (lastChar === ' ') {
                setShowMentionDropdown(false);
            }
        }
    };

    const handleMentionSelect = (persona) => {
        setInputValue(prev => prev + (persona.name || 'User') + ' ');
        setShowMentionDropdown(false);
        inputRef.current?.focus();
    };

    const handleSend = (e, submittedValue = inputValue) => {
        e.preventDefault();
        if (!submittedValue.trim()) return;
        onSendMessage(submittedValue, quotedMessage?.id || null);
        setInputValue('');
        // T07: Clear draft on send
        clearDraft();
        // Clear internal quoted message
        setInternalQuotedMessage(null);
        // Call external cancel quote if exists
        onCancelQuote?.();
        closeAll();
    };

    const getSenderName = (senderId) => {
        if (senderId === 'user-me') return t('you');
        const p = personas.find(p => p.id === senderId);
        return p ? (p.name || 'AI') : 'Unknown';
    };

    const onFileSelect = (file) => {
        onSendFile(file);
        // Logic handled by parent or hook
    };

    // T07: Image upload handler
    const imageInputRef = useRef(null);

    // Maximum image size (10MB)
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            onError?.(t('invalid_image_file'));
            return;
        }

        // Check file size
        if (file.size > MAX_IMAGE_SIZE) {
            onError?.(t('image_too_large') || 'Image too large (max 10MB)');
            return;
        }

        // Convert to data URL
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            // Send as [IMG:url] format
            onSendMessage(`[IMG:${dataUrl}]`);
            closeAll();
        };
        reader.onerror = () => {
            onError?.(t('image_read_error'));
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const onOpenImageUpload = () => {
        imageInputRef.current?.click();
    };

    const handleEmojiSelect = (emoji) => {
        setInputValue(prev => prev + emoji);
    };

    const handleStickerSelect = (stickerUrl) => {
        onSendSticker(stickerUrl);
        setShowStickerPicker(false);
    };

    // Feature handlers — delegate to ChatWindow
    const handleOpenGift = () => onOpenGift?.();
    const handleOpenRedPacket = () => onOpenRedPacket?.();
    const handleOpenGame = () => onOpenGame?.();
    const handleOpenPoll = () => onOpenPoll?.();

    return (
        <div className="composer-wrap">
            {/* Quoted Preview - Floating Pill */}
            {quotedMessage && (
                <div className="quote-preview glass-crystal animate-fade-slide-up">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="quote-preview-bar animate-aurora" />
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--color-primary)]">
                                {t('reply_to')} {getSenderName(quotedMessage.senderId)}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5 font-medium opacity-80">
                                {quotedMessage.content.slice(0, 50)}...
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setInternalQuotedMessage(null);
                            onCancelQuote?.();
                            // T07: Update draft to remove quoted message
                            updateDraftContent(inputValue, null);
                        }}
                        className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full text-[var(--color-text-muted)]
                            hover:text-[var(--color-danger)] transition-colors"
                        aria-label={t('cancel')}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Main Composer Area - Floating Crystal Pill box */}
            <div className="composer-box glass-crystal">
                <form onSubmit={handleSend} className="flex items-end gap-2">
                    {/* Voice/Keyboard Toggle */}
                    <button
                        type="button"
                        className={cn("composer-btn mb-0.5", isRecordingMode && "active")}
                        onClick={() => setIsRecordingMode(!isRecordingMode)}
                        aria-label={isRecordingMode ? t('keyboard') || 'Keyboard' : t('voice') || 'Voice'}
                    >
                        {isRecordingMode ? <Keyboard size={24} /> : <Mic size={24} />}
                    </button>

                    {isRecordingMode ? (
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setIsRecording(true); setRecordingStart(Date.now()); }}
                            onMouseUp={(e) => {
                                e.preventDefault();
                                if (isRecording) {
                                    setIsRecording(false);
                                    const duration = Math.round((Date.now() - recordingStart) / 1000);
                                    if (duration >= 1) onSendMessage(`[VOICE:${duration}s]`);
                                }
                            }}
                            onMouseLeave={() => setIsRecording(false)}
                            className={cn(
                                "flex-1 rounded-[var(--radius-lg)] px-4 py-3 text-[15px] font-bold transition-all select-none text-center",
                                isRecording
                                    ? "text-white scale-[0.98] shadow-inner animate-aurora"
                                    : "bg-[var(--color-bg-white)]/50 hover:bg-[var(--color-bg-white)]/80 text-[var(--color-text-main)]"
                            )}
                            style={isRecording ? { background: 'var(--character-gradient, var(--gradient-aurora))', backgroundSize: '150% 150%' } : {}}
                        >
                            {isRecording
                                ? <><Mic size={16} className="inline mr-1" />{t('release_to_send_voice')}</>
                                : t('hold_to_talk')}
                        </button>
                    ) : (
                        <div className="composer-input-wrap flex-1">
                            <textarea
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => {
                                    handleInputChange(e);
                                    // Auto-resize
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        handleSend(e, e.currentTarget.value);
                                        // Reset height
                                        if (inputRef.current) inputRef.current.style.height = 'auto';
                                    }
                                }}
                                aria-label={t('type_message')}
                                placeholder={t('type_message')}
                                className="composer-input resize-none overflow-y-auto"
                                rows={1}
                            />
                            {showMentionDropdown && mentionCandidates.length > 0 && (
                                <div className="mention-dropdown glass-crystal animate-scale-spring">
                                    {mentionCandidates.map(p => (
                                        <button
                                            type="button"
                                            key={p.id}
                                            onClick={() => handleMentionSelect(p)}
                                            className="mention-item"
                                        >
                                            <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm">
                                                {p.avatar
                                                    ? <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                                                        style={{ background: 'var(--gradient-aurora)' }}>{p.name.charAt(0)}</div>
                                                }
                                            </div>
                                            <span className="font-bold text-[var(--color-text-main)]">
                                                @{language === 'zh' ? (p.name_zh || p.name) : p.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 mb-0.5">
                        <button
                            type="button"
                            className={cn("composer-btn", showEmojiPicker && "active")}
                            onClick={() => { closeAll(); setShowEmojiPicker(!showEmojiPicker); }}
                            aria-label={t('emoji') || 'Emoji'}
                        >
                            <Smile size={24} />
                        </button>

                        {inputValue.trim() ? (
                            <button
                                type="submit"
                                className="composer-send-btn"
                                aria-label={t('send') || 'Send'}
                            >
                                <Send size={22} className="ml-0.5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                className={cn("composer-btn", showPlusMenu && "rotate-45 shadow-md text-white")}
                                style={showPlusMenu ? { background: 'var(--character-gradient, var(--gradient-aurora))' } : {}}
                                onClick={() => { closeAll(); setShowPlusMenu(!showPlusMenu); }}
                                aria-label={t('more') || 'More'}
                            >
                                <Plus size={24} />
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Popups - Premium Glass Stylings */}
            {showEmojiPicker && (
                <div className="absolute bottom-full left-4 mb-3 z-30 animate-scale-spring max-h-[400px]">
                    <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
                </div>
            )}
            {showStickerPicker && (
                <div className="absolute bottom-full left-4 mb-3 z-30 animate-scale-spring">
                    <StickerPicker aiId={headerInfo.id} onSelect={handleStickerSelect} onClose={() => setShowStickerPicker(false)} />
                </div>
            )}
            {showPlusMenu && (
                <div className="plus-menu glass-crystal animate-scale-spring">
                    <MenuButton icon={ImageIcon} label={t('image')} onClick={onOpenImageUpload}
                        color="text-[var(--color-text-main)]" bg="bg-[var(--color-bg-active)]" />
                    <MenuButton icon={Paperclip} label={t('file')} onClick={() => setShowFileUploader(true)}
                        color="text-[var(--color-text-main)]" bg="bg-[var(--color-bg-active)]" />
                    <MenuButton icon={Heart} label={t('sticker')} onClick={() => setShowStickerPicker(true)}
                        color="text-[var(--color-text-main)]" bg="bg-[var(--color-bg-active)]" />
                    <MenuButton icon={Gift} label={t('gift')} onClick={handleOpenGift}
                        color="text-[var(--color-text-main)]" bg="bg-[var(--color-bg-active)]" />
                    <MenuButton icon={Coins} label={t('red_packet')} onClick={handleOpenRedPacket}
                        color="text-[var(--color-text-main)]" bg="bg-[var(--color-bg-active)]" />
                    <MenuButton icon={Gamepad2} label={t('game')} onClick={handleOpenGame}
                        color="text-[var(--color-text-main)]" bg="bg-[var(--color-bg-active)]" />
                    <MenuButton icon={BarChart3} label={t('poll')} onClick={handleOpenPoll}
                        color="text-[var(--color-text-main)]" bg="bg-[var(--color-bg-active)]" />
                </div>
            )}

            {showFileUploader && (
                <div className="absolute bottom-20 left-4 mb-2 z-40 animate-scale-spring">
                    <FileUploader
                        onFileSelect={(file) => { onFileSelect(file); setShowFileUploader(false); closeAll(); }}
                        onClose={() => setShowFileUploader(false)}
                    />
                </div>
            )}

            {/* T07: Hidden image file input */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                aria-hidden="true"
            />
        </div>
    );
}
