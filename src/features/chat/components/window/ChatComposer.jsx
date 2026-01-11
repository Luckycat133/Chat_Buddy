import React, { useState, useRef } from 'react';
import { Smile, Mic, Paperclip, Plus, Heart, Keyboard, Gift, Coins, Gamepad2, BarChart3, X } from 'lucide-react';
import { cn } from '../../../../utils/cn';
import { useLanguage } from '../../../../context/LanguageContext';
import EmojiPicker from '../../../../components/EmojiPicker';
import StickerPicker from '../../../../components/StickerPicker';
import FileUploader from '../../../../components/FileUploader';

export default function ChatComposer({
    onSendMessage,
    quotedMessage,
    onCancelQuote,
    chatId,
    personas,
    headerInfo, // For sticker picker
    // Menu triggers
    onOpenGift,
    onOpenRedPacket,
    onOpenGame,
    onOpenPoll,
    onFileSelect
}) {
    const { t, language } = useLanguage();
    const [inputValue, setInputValue] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const [isRecordingMode, setIsRecordingMode] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStart, setRecordingStart] = useState(0);
    const [showFileUploader, setShowFileUploader] = useState(false);

    // @mention state
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const inputRef = useRef(null);

    // Helpers
    const getSenderName = (senderId) => {
        if (senderId === 'user-me') return t('you');
        const sender = personas.find(p => p.id === senderId);
        return language === 'zh' ? (sender?.name_zh || sender?.name) : sender?.name;
    };

    const mentionCandidates = chat ? chat.participants
        .filter(pid => pid !== 'user-me')
        .map(pid => personas.find(p => p.id === pid))
        .filter(p => p && (p.name.toLowerCase().includes(mentionQuery) || (p.name_zh || '').includes(mentionQuery)))
        : [];

    // Handlers
    const handleSend = (e) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;
        onSendMessage(inputValue, quotedMessage?.id);
        setInputValue('');
        onCancelQuote();
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);

        // Check for @ trigger
        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const textAfterAt = value.slice(lastAtIndex + 1);
            if (lastAtIndex === 0 || value[lastAtIndex - 1] === ' ') {
                setMentionQuery(textAfterAt.toLowerCase());
                setShowMentionDropdown(true);
                return;
            }
        }
        setShowMentionDropdown(false);
    };

    const handleMentionSelect = (person) => {
        const lastAtIndex = inputValue.lastIndexOf('@');
        const beforeAt = inputValue.slice(0, lastAtIndex);
        const personName = language === 'zh' ? (person.name_zh || person.name) : person.name;
        setInputValue(beforeAt + '@' + personName + ' ');
        setShowMentionDropdown(false);
        inputRef.current?.focus();
    };

    const handleEmojiSelect = (emoji) => {
        setInputValue(prev => prev + emoji);
    };

    const handleStickerSelect = (stickerEmoji) => {
        onSendMessage(`[STICKER:${stickerEmoji}]`);
        setShowStickerPicker(false);
    };

    const closeAll = () => {
        setShowEmojiPicker(false);
        setShowStickerPicker(false);
        setShowPlusMenu(false);
    };

    return (
        <div className="flex flex-col bg-[var(--color-bg-chat)] relative z-20">
            {/* Quoted Preview */}
            {quotedMessage && (
                <div className="px-3 py-2 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-1 h-8 bg-[var(--color-primary)] rounded-full flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--color-primary)]">
                                {t('reply_to')} {getSenderName(quotedMessage.senderId)}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                {quotedMessage.content.slice(0, 50)}...
                            </p>
                        </div>
                    </div>
                    <button onClick={onCancelQuote} className="p-1 hover:bg-gray-200 rounded text-gray-500">
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="p-4">
                <div className="bg-white rounded-2xl shadow-lg border border-[var(--color-border-light)] p-2">
                    <form onSubmit={handleSend} className="flex items-end gap-2">
                        <button
                            type="button"
                            className={cn("p-2 rounded-full hover:bg-gray-100 transition-colors mb-0.5", isRecordingMode ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]")}
                            onClick={() => setIsRecordingMode(!isRecordingMode)}
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
                                    "flex-1 rounded-xl border-none px-4 py-3 text-[15px] font-medium transition-all select-none text-center shadow-inner",
                                    isRecording ? "bg-[var(--color-primary-light)] text-[var(--color-primary-active)] scale-95" : "bg-gray-100 hover:bg-gray-200 text-[var(--color-text-main)]"
                                )}
                            >
                                {isRecording ? (language === 'zh' ? '松开 发送' : 'Release to Send') : (language === 'zh' ? '按住 说话' : 'Hold to Talk')}
                            </button>
                        ) : (
                            <div className="flex-1 relative min-h-[44px] flex items-center">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    placeholder={t('type_message')}
                                    className="w-full bg-transparent border-none px-2 py-2 text-[15px] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                                />
                                {showMentionDropdown && mentionCandidates.length > 0 && (
                                    <div className="absolute bottom-full left-0 mb-3 bg-white rounded-xl shadow-float border border-[var(--color-border)] py-2 min-w-[200px] max-h-[240px] overflow-y-auto z-40">
                                        {/* Simplified Mention List for brevity */}
                                        {mentionCandidates.map(p => (
                                            <button key={p.id} onClick={() => handleMentionSelect(p)} className="block w-full text-left px-4 py-2 hover:bg-gray-50">@{p.name}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-1 mb-0.5">
                            <button
                                type="button"
                                className={cn("p-2 rounded-full hover:bg-gray-100 transition-colors", showEmojiPicker ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")}
                                onClick={() => { closeAll(); setShowEmojiPicker(!showEmojiPicker); }}
                            >
                                <Smile size={24} />
                            </button>
                            <button
                                type="button"
                                className={cn("p-2 rounded-full hover:bg-gray-100 transition-colors", showStickerPicker ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")}
                                onClick={() => { closeAll(); setShowStickerPicker(!showStickerPicker); }}
                            >
                                <Heart size={24} />
                            </button>

                            {inputValue.trim() ? (
                                <button type="submit" className="ml-1 bg-[var(--color-primary)] text-white px-5 py-2 rounded-xl text-[15px] font-medium hover:bg-[var(--color-primary-hover)]">
                                    {t('send')}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className={cn("p-2 rounded-full hover:bg-gray-100 transition-colors", showPlusMenu ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")}
                                    onClick={() => { closeAll(); setShowPlusMenu(!showPlusMenu); }}
                                >
                                    <Plus size={24} />
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Popups */}
                {showEmojiPicker && <div className="absolute bottom-full left-0 mb-2 z-30"><EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} /></div>}
                {showStickerPicker && <div className="absolute bottom-full left-0 mb-2 z-30"><StickerPicker aiId={headerInfo.id} onSelect={handleStickerSelect} onClose={() => setShowStickerPicker(false)} /></div>}
                {showPlusMenu && (
                    <div className="absolute bottom-full right-2 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-[200px] grid grid-cols-4 gap-2 z-30 animate-scale-in">
                        <MenuButton icon={Paperclip} label={t('file')} onClick={() => setShowFileUploader(true)} color="text-blue-500" bg="bg-blue-50" />
                        <MenuButton icon={Gift} label={language === 'zh' ? '礼物' : 'Gift'} onClick={onOpenGift} color="text-pink-500" bg="bg-pink-50" />
                        <MenuButton icon={Coins} label={language === 'zh' ? '红包' : 'Packet'} onClick={onOpenRedPacket} color="text-red-500" bg="bg-red-50" />
                        <MenuButton icon={Gamepad2} label={language === 'zh' ? '游戏' : 'Game'} onClick={onOpenGame} color="text-purple-500" bg="bg-purple-50" />
                        <MenuButton icon={BarChart3} label={language === 'zh' ? '投票' : 'Poll'} onClick={onOpenPoll} color="text-orange-500" bg="bg-orange-50" />
                    </div>
                )}
            </div>

            {showFileUploader && (
                <div className="absolute bottom-16 left-2 mb-2 z-40">
                    <FileUploader onFileSelect={(file) => { onFileSelect(file); setShowFileUploader(false); closeAll(); }} onClose={() => setShowFileUploader(false)} />
                </div>
            )}
        </div>
    );
}

function MenuButton({ icon: Icon, label, onClick, color, bg }) {
    return (
        <button onClick={onClick} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-1", bg, color)}>
                <Icon size={24} />
            </div>
            <span className="text-xs text-gray-600">{label}</span>
        </button>
    );
}
