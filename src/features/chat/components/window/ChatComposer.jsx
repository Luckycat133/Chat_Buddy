import React, { useState, useRef, useEffect } from 'react';
import {
    Smile, Paperclip, Mic, Send, MoreVertical, X,
    Image as ImageIcon, FileText, Gift, Heart,
    Gamepad2, BarChart3, Coins, Plus, Keyboard, MoreHorizontal
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useLanguage } from '../../../../context/LanguageContext';
import { useDraft } from '../../hooks/useDraft';
import { cn } from '../../../../utils/cn';
import EmojiPicker from '../../../../components/EmojiPicker';
import StickerPicker from '../../../../components/StickerPicker';
import FileUploader from '../../../../components/FileUploader';

// Menu Button Helper
// eslint-disable-next-line no-unused-vars
const MenuButton = ({ icon: IconComponent, label, onClick, color = "text-[var(--color-text-secondary)]", bg = "bg-[var(--color-bg-hover)]" }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-[var(--color-bg-hover)] transition-colors group"
    >
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm", bg)}>
            <IconComponent size={24} className={color} />
        </div>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
    </button>
);

export default function ChatComposer({ chat, onSendMessage, onSendFile, onSendSticker, quotedMessage: externalQuotedMessage, onCancelQuote }) {
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

    const handleSend = (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        onSendMessage(inputValue, quotedMessage?.id || null);
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

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            alert(t('invalid_image_file'));
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
            alert(t('image_read_error'));
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

    // Features
    const onOpenGift = () => {
        alert(t('gift_coming_soon'));
    };
    const onOpenRedPacket = () => {
        alert(t('red_packet_coming_soon'));
    };
    const onOpenGame = () => {
        alert(t('game_coming_soon'));
    };
    const onOpenPoll = () => {
        alert(t('poll_coming_soon'));
    };

    return (
        <div className="flex flex-col relative z-20 pb-4 px-4">
            {/* Quoted Preview - Floating Pill */}
            {quotedMessage && (
                <div className="mx-2 mb-2 px-4 py-3 glass-crystal rounded-[var(--radius-lg)] shadow-floating 
                    flex items-center justify-between animate-fade-slide-up ring-1 ring-[var(--color-border)]">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-1 h-10 rounded-full animate-aurora"
                            style={{ background: 'var(--character-gradient, var(--gradient-aurora))' }} />
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
            <div className="glass-crystal rounded-[var(--radius-xl)] shadow-floating p-2 ring-1 ring-[var(--color-border)] relative">
                <form onSubmit={handleSend} className="flex items-end gap-2">
                    {/* Voice/Keyboard Toggle */}
                    <button
                        type="button"
                        className={cn(
                            "p-3 rounded-full transition-all duration-300 mb-0.5",
                            isRecordingMode
                                ? "text-[var(--color-primary)] bg-[var(--color-primary-softer)] shadow-inner"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-hover)]"
                        )}
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
                                ? `🎙️ ${t('release_to_send_voice')}`
                                : t('hold_to_talk')}
                        </button>
                    ) : (
                        <div className="flex-1 relative min-h-[48px] flex items-center bg-[var(--color-bg-white)]/50 rounded-[var(--radius-lg)] transition-all hover:bg-[var(--color-bg-white)]/70 focus-within:bg-[var(--color-bg-white)] focus-within:shadow-sm ring-1 ring-transparent focus-within:ring-[var(--character-primary,var(--color-primary))]/20 px-4">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={handleInputChange}
                                aria-label={t('type_message')}
                                placeholder={t('type_message')}
                                className="w-full bg-transparent border-none py-3 text-[16px] 
                                    text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] 
                                    focus:outline-none font-medium"
                            />
                            {showMentionDropdown && mentionCandidates.length > 0 && (
                                <div className="absolute bottom-full left-0 mb-4 glass-crystal rounded-[var(--radius-lg)] 
                                    shadow-floating border border-[var(--color-border)] py-2 min-w-[220px] max-h-[240px] 
                                    overflow-y-auto z-40 animate-scale-spring">
                                    {mentionCandidates.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleMentionSelect(p)}
                                            className="w-full text-left px-4 py-3 hover:bg-[var(--color-bg-hover)]
                                                flex items-center gap-3 transition-all"
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
                            className={cn(
                                "p-3 rounded-full transition-all duration-200",
                                showEmojiPicker
                                    ? "text-[var(--color-primary)] bg-[var(--color-primary-softer)]"
                                    : "text-[var(--color-text-muted)] hover:text-[var(--color-accent-gold)] hover:bg-[var(--color-bg-hover)]"
                            )}
                            onClick={() => { closeAll(); setShowEmojiPicker(!showEmojiPicker); }}
                            aria-label={t('emoji') || 'Emoji'}
                        >
                            <Smile size={24} />
                        </button>

                        {inputValue.trim() ? (
                            <button
                                type="submit"
                                className="ml-1 p-3 rounded-full text-white shadow-lg
                                    hover:scale-105 active:scale-95
                                    transition-all duration-300 animate-aurora"
                                style={{ background: 'var(--character-gradient, var(--gradient-aurora))', backgroundSize: '150% 150%' }}
                                aria-label={t('send') || 'Send'}
                            >
                                <Send size={22} className="ml-0.5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                className={cn(
                                    "p-3 rounded-full transition-all duration-300",
                                    showPlusMenu
                                        ? "text-white rotate-45 shadow-md"
                                        : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-hover)]"
                                )}
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
                <div className="absolute bottom-full right-4 mb-3 glass-crystal rounded-[var(--radius-xl)] shadow-floating
                    border border-[var(--color-border)] p-4 min-w-[280px] grid grid-cols-4 gap-3 z-30 animate-scale-spring">
                    <MenuButton icon={ImageIcon} label={t('image')} onClick={onOpenImageUpload}
                        color="text-[var(--color-accent-lavender)]" bg="bg-purple-50" />
                    <MenuButton icon={Paperclip} label={t('file')} onClick={() => setShowFileUploader(true)}
                        color="text-[var(--color-accent-sky)]" bg="bg-sky-50" />
                    <MenuButton icon={Heart} label={t('sticker')} onClick={() => setShowStickerPicker(true)}
                        color="text-[var(--color-accent-coral)]" bg="bg-pink-50" />
                    <MenuButton icon={Gift} label={t('gift')} onClick={onOpenGift}
                        color="text-[var(--color-accent-coral)]" bg="bg-pink-50" />
                    <MenuButton icon={Coins} label={t('red_packet')} onClick={onOpenRedPacket}
                        color="text-red-500" bg="bg-red-50" />
                    <MenuButton icon={Gamepad2} label={t('game')} onClick={onOpenGame}
                        color="text-[var(--color-accent-lavender)]" bg="bg-purple-50" />
                    <MenuButton icon={BarChart3} label={t('poll')} onClick={onOpenPoll}
                        color="text-[var(--color-primary)]" bg="bg-orange-50" />
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
