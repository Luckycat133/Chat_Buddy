import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, MoreHorizontal, Plus, Smile, Mic, Paperclip, X, Heart, Gift, Trophy, Gamepad2, Coins, Keyboard } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { useDocuments } from '../context/DocumentContext';
import { useUser } from '../context/UserContext';
import { cn } from '../utils/cn';
import { formatTimeSeparator, shouldShowTimeSeparator } from '../utils/formatTime';
import { downloadFile, formatFileSize } from '../utils/fileUtils';
import EmojiPicker from '../components/EmojiPicker';
import StickerPicker from '../components/StickerPicker';
import MessageMenu from '../components/MessageMenu';
import QuotedMessage from '../components/QuotedMessage';
import FileUploader from '../components/FileUploader';
import FileMessage, { GeneratedFileMessage } from '../components/FileMessage';
import ForwardModal from '../components/ForwardModal';
import GiftPanel from '../components/GiftPanel';
import RedPacketPanel from '../components/RedPacketPanel';
import RockPaperScissors from '../components/RockPaperScissors';

export default function ChatWindow() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { chats, personas, currentUser, sendMessage, typingIndicators, deleteMessage, pinMessage } = useChat();
    const { t, language } = useLanguage();
    const { addDocument } = useDocuments();
    const { userProfile } = useUser();
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

    // UI states
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showFileUploader, setShowFileUploader] = useState(false);
    const [showPlusMenu, setShowPlusMenu] = useState(false);

    // Voice Message states
    const [isRecordingMode, setIsRecordingMode] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStart, setRecordingStart] = useState(0);

    // Feature modals
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showGiftPanel, setShowGiftPanel] = useState(false);
    const [showRedPacketPanel, setShowRedPacketPanel] = useState(false);
    const [showGame, setShowGame] = useState(false);
    const [messageToForward, setMessageToForward] = useState(null);

    // Message interaction states
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [quotedMessage, setQuotedMessage] = useState(null);

    // Toast state
    const [toast, setToast] = useState(null);

    // @mention state
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const inputRef = useRef(null);

    const chat = chats.find(c => c.id === id);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, [chat?.messages]);

    // Auto-hide toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    if (!chat) return <div className="flex items-center justify-center h-full bg-[var(--color-bg-app)] text-[var(--color-text-muted)]">{t('select_chat')}</div>;

    const getHeaderInfo = () => {
        if (chat.participants.length === 2) {
            const otherId = chat.participants.find(p => p !== 'user-me');
            const other = personas.find(p => p.id === otherId);
            const name = language === 'zh' && other ? (other.name_zh || other.name) : (other?.name || chat.name);
            return { name: name, avatar: other?.avatar, id: otherId }; // Added ID
        }
        return {
            name: chat.name,
            avatar: null,
            memberCount: chat.participants.length,
            id: null
        };
    };

    const headerInfo = getHeaderInfo();

    const handleSend = (e) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        sendMessage(chat.id, inputValue, quotedMessage?.id);
        setInputValue('');
        setQuotedMessage(null);
    };

    const handleEmojiSelect = (emoji) => {
        setInputValue(prev => prev + emoji);
        // Don't close picker for continuous typing
    };

    // @mention handling
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);

        // Check for @ trigger
        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const textAfterAt = value.slice(lastAtIndex + 1);
            // Only show dropdown if @ is at start or after a space
            const charBeforeAt = value[lastAtIndex - 1];
            if (lastAtIndex === 0 || charBeforeAt === ' ') {
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

    const mentionCandidates = chat ? chat.participants
        .filter(pid => pid !== 'user-me')
        .map(pid => personas.find(p => p.id === pid))
        .filter(p => p && (p.name.toLowerCase().includes(mentionQuery) || (p.name_zh || '').includes(mentionQuery)))
        : [];

    const handleStickerSelect = (stickerEmoji) => {
        // Send sticker as a special message format
        sendMessage(chat.id, `[STICKER:${stickerEmoji}]`);
        setShowStickerPicker(false);
    };

    const handleFileSelect = (fileData) => {
        addDocument(fileData);
        sendMessage(chat.id, `[FILE] ${fileData.name} (${formatFileSize(fileData.size)})`);
        setShowFileUploader(false);
        setShowPlusMenu(false);
        showToast(t('file_uploaded'));
    };

    const handleForwardMessage = (msg) => {
        setMessageToForward(msg);
        setShowForwardModal(true);
    };

    const confirmForward = (message, targetChatIds) => {
        targetChatIds.forEach(targetId => {
            let content = message.content; // Simplify forwarding for now
            sendMessage(targetId, content);
        });
        showToast(t('message_forwarded') || 'Forwarded');
        setMessageToForward(null);
        setShowForwardModal(false);
    };

    const handleGiftSent = (gift, newIntimacy) => {
        // Send a system-like message for the gift
        sendMessage(chat.id, `[GIFT:${gift.emoji}:${gift.name}:${gift.name_en}]`);
        setShowGiftPanel(false);
        setShowPlusMenu(false);
        showToast(language === 'zh' ? '礼物已赠送' : 'Gift sent');
    };

    const handleRedPacketSent = ({ amount, message }) => {
        sendMessage(chat.id, `[RED_PACKET:${amount}:${message}]`);
        setShowRedPacketPanel(false);
        setShowPlusMenu(false);
        showToast(language === 'zh' ? '红包已发送' : 'Red packet sent');
    };

    const handleGameResult = ({ result, score }) => {
        const resultText = result === 'win' ? 'Win' : result === 'lose' ? 'Lose' : 'Draw';
        sendMessage(chat.id, `[GAME:RPS:${resultText}:${score.player}-${score.ai}]`);
        setShowGame(false);
        setShowPlusMenu(false);
    };

    // ... existing handlers ...
    const handleMessageContextMenu = (e, msg) => {
        e.preventDefault();
        setSelectedMessage(msg);
        setMenuPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMessageLongPress = (e, msg) => {
        const touch = e.touches?.[0] || e;
        setSelectedMessage(msg);
        setMenuPosition({ x: touch.clientX, y: touch.clientY });
    };

    const handleCopyMessage = () => {
        showToast(t('message_copied'));
    };

    const handleQuoteMessage = (msg) => {
        setQuotedMessage(msg);
    };

    const handleDeleteMessage = (messageId) => {
        deleteMessage?.(chat.id, messageId);
        showToast(t('message_deleted'));
    };

    const showToast = (message) => {
        setToast(message);
    };

    // Get typing AI names
    const typingAIs = typingIndicators?.[chat.id] || [];
    const typingNames = typingAIs
        .map(aiId => {
            const ai = personas.find(p => p.id === aiId);
            return language === 'zh' ? (ai?.name_zh || ai?.name) : ai?.name;
        })
        .filter(Boolean);

    // Get sender name helper
    const getSenderName = (senderId) => {
        if (senderId === 'user-me') return t('you');
        const sender = personas.find(p => p.id === senderId);
        return language === 'zh' ? (sender?.name_zh || sender?.name) : sender?.name;
    };

    // Find quoted message content
    const getQuotedMessageData = (quotedId) => {
        if (!quotedId) return null;
        const msg = chat.messages.find(m => m.id === quotedId);
        if (!msg) return null;
        return {
            ...msg,
            senderName: getSenderName(msg.senderId)
        };
    };

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-chat)] relative flex-1">
            {/* Header */}
            <div className="px-3 py-2.5 bg-[var(--color-bg-app)] flex items-center justify-between border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/')} className="md:hidden p-1 text-[var(--color-text-main)]">
                        <ArrowLeft size={22} />
                    </button>
                    <div>
                        <h2
                            className="font-medium text-[var(--color-text-main)] text-[17px] cursor-pointer"
                            onClick={() => navigate(`/chat/${chat.id}/details`)}
                        >
                            {headerInfo.name}
                            {headerInfo.memberCount && <span className="text-[var(--color-text-muted)] font-normal">({headerInfo.memberCount})</span>}
                        </h2>
                        {typingNames.length > 0 && (
                            <p className="text-xs text-[var(--color-text-muted)] animate-pulse">
                                {typingNames.length === 1
                                    ? `${typingNames[0]} ${t('is_typing')}`
                                    : `${typingNames.length} ${t('people_typing')}`
                                }
                            </p>
                        )}
                    </div>
                </div>
                <button className="p-1 text-[var(--color-text-main)]" onClick={() => navigate(`/chat/${chat.id}/details`)}>
                    <MoreHorizontal size={22} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 pb-20 md:pb-4">
                {chat.messages.map((msg, index) => {
                    const isMe = msg.senderId === 'user-me';
                    const sender = isMe ? currentUser : personas.find(p => p.id === msg.senderId);
                    const senderName = getSenderName(msg.senderId);

                    let content = msg.content;
                    let reaction = null;
                    let type = 'text';
                    let meta = null;

                    // Parse custom message types
                    if (content.startsWith('[FILE]')) {
                        type = 'file';
                        content = content.replace('[FILE]', '').trim();
                    } else if (content.startsWith('[STICKER:')) {
                        type = 'sticker';
                        const match = content.match(/\[STICKER:(.+?)\]/);
                        content = match ? match[1] : '';
                    } else if (content.startsWith('[GIFT:')) {
                        type = 'gift';
                        const parts = content.match(/\[GIFT:(.+?):(.+?):(.+?)\]/);
                        if (parts) {
                            meta = { emoji: parts[1], name: parts[2], name_en: parts[3] };
                            content = language === 'zh' ? `送出了 ${parts[2]}` : `Sent ${parts[3]}`;
                        }
                    } else if (content.startsWith('[RED_PACKET:')) {
                        type = 'red_packet';
                        const parts = content.match(/\[RED_PACKET:(.+?):(.+?)\]/);
                        if (parts) {
                            meta = { amount: parts[1], message: parts[2] };
                            content = language === 'zh' ? '收到红包' : 'Red Packet';
                        }
                    } else if (content.startsWith('[GAME:')) {
                        type = 'game';
                        content = content.replace('[GAME:', '').replace(']', '');
                    }

                    // React/Img existing parsing...
                    const reactMatch = content.match(/\[REACT:(.+?)\]/);
                    if (reactMatch) {
                        reaction = reactMatch[1];
                        content = content.replace(reactMatch[0], '').trim();
                    }
                    const imgMatch = content.match(/\[IMG:(.+?)\]/);
                    if (imgMatch) {
                        content = content.replace(imgMatch[0], '').trim();
                    }

                    const prevMsg = index > 0 ? chat.messages[index - 1] : null;
                    const showTimeSeparator = shouldShowTimeSeparator(prevMsg?.timestamp, msg.timestamp, 5);
                    const quotedData = getQuotedMessageData(msg.quotedMessageId);

                    return (
                        <React.Fragment key={msg.id}>
                            {showTimeSeparator && (
                                <div className="flex justify-center my-4">
                                    <span className="px-3 py-1 bg-black/5 text-[var(--color-text-muted)] text-xs rounded-full">
                                        {formatTimeSeparator(msg.timestamp, language)}
                                    </span>
                                </div>
                            )}

                            <div
                                className={cn("flex mb-3 animate-message-in", isMe ? "justify-end" : "justify-start")}
                                onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                            >
                                <div className={cn("flex max-w-[70%] gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-[4px] overflow-hidden flex-shrink-0 bg-[#E0E0E0]">
                                        {sender?.avatar ? (
                                            <img src={sender.avatar} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white text-xs font-medium">
                                                {senderName?.charAt(0)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bubble */}
                                    <div className="relative">
                                        {/* Triangle - only for text/file types */}
                                        {(type === 'text' || type === 'file') && (
                                            <div className={cn(
                                                "absolute top-3 w-0 h-0 border-[6px]",
                                                isMe ? "right-[-10px] border-transparent border-l-[var(--color-primary)]" : "left-[-10px] border-transparent border-r-white"
                                            )} />
                                        )}

                                        <div className={cn(
                                            "relative",
                                            (type === 'text' || type === 'file')
                                                ? (isMe ? "px-3 py-2 bg-[var(--color-primary)] text-white rounded-[4px]" : "px-3 py-2 bg-white text-[var(--color-text-main)] rounded-[4px] shadow-sm")
                                                : "bg-transparent"
                                        )}>
                                            {/* Content based on type */}
                                            {quotedData && (
                                                <QuotedMessage quotedMessage={quotedData} senderName={quotedData.senderName} />
                                            )}

                                            {type === 'sticker' ? (
                                                <div className="text-6xl drop-shadow-sm hover:scale-110 transition-transform cursor-pointer">
                                                    {content}
                                                </div>
                                            ) : type === 'gift' && meta ? (
                                                <div className="bg-[#FF4081] text-white p-3 rounded-lg shadow-md flex items-center gap-3 min-w-[150px]">
                                                    <div className="text-3xl">{meta.emoji}</div>
                                                    <div>
                                                        <p className="font-bold text-sm">{language === 'zh' ? meta.name : meta.name_en}</p>
                                                        <p className="text-xs opacity-90">{language === 'zh' ? '赠送礼物' : 'Gift Sent'}</p>
                                                    </div>
                                                </div>
                                            ) : type === 'red_packet' && meta ? (
                                                <div className="bg-[#FA9D3B] text-white p-3 rounded-lg shadow-md flex items-center gap-3 min-w-[200px] cursor-pointer hover:bg-[#E68A2E]">
                                                    <div className="bg-[#FEF2DC] rounded p-2">
                                                        <Coins className="text-[#FA9D3B]" size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold">{meta.message || (language === 'zh' ? '恭喜发财' : 'Best Wishes')}</p>
                                                        <p className="text-xs opacity-90">{language === 'zh' ? '查看红包' : 'Open Packet'}</p>
                                                    </div>
                                                </div>
                                            ) : type === 'game' ? (
                                                <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                                                    <p className="font-medium text-center mb-1">🎮 {content}</p>
                                                </div>
                                            ) : type === 'file' ? (
                                                <div className={cn("text-sm", isMe ? "text-white/90" : "text-gray-600")}>
                                                    📎 {content}
                                                </div>
                                            ) : (
                                                // Text
                                                <p className="whitespace-pre-wrap break-words">{content}</p>
                                            )}

                                            {reaction && <span className="ml-1">{reaction}</span>}
                                        </div>

                                        {/* AI Generated Files */}
                                        {msg.generatedFiles?.map((file, idx) => (
                                            <div key={idx} className="mt-2">
                                                <GeneratedFileMessage
                                                    fileData={file}
                                                    onDownload={() => downloadFile(file.filename, file.content)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

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
                    <button onClick={() => setQuotedMessage(null)} className="p-1 hover:bg-gray-200 rounded text-gray-500">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Input Area */}
            <div className="p-2 bg-[#F7F7F7] border-t border-[var(--color-border)] relative z-20">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <button
                        type="button"
                        className={cn("p-1.5 transition-colors", isRecordingMode ? "text-[var(--color-text-main)]" : "text-[#7F7F7F]")}
                        onClick={() => setIsRecordingMode(!isRecordingMode)}
                    >
                        {isRecordingMode ? <Keyboard size={24} /> : <Mic size={24} />}
                    </button>

                    {isRecordingMode ? (
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setIsRecording(true);
                                setRecordingStart(Date.now());
                            }}
                            onMouseUp={(e) => {
                                e.preventDefault();
                                if (isRecording) {
                                    setIsRecording(false);
                                    const duration = Math.round((Date.now() - recordingStart) / 1000);
                                    if (duration < 1) {
                                        showToast(t('voice_too_short') || 'Too short');
                                    } else {
                                        sendMessage(chat.id, `[VOICE:${duration}s]`);
                                    }
                                }
                            }}
                            onMouseLeave={() => setIsRecording(false)}
                            className={cn(
                                "flex-1 rounded-[4px] border-none px-3 py-2 text-[15px] font-medium transition-colors select-none",
                                isRecording ? "bg-[#c6c6c6]" : "bg-white hover:bg-[#ebedf0] text-[var(--color-text-main)]"
                            )}
                        >
                            {isRecording ? (language === 'zh' ? '松开 发送' : 'Release to Send') : (language === 'zh' ? '按住 说话' : 'Hold to Talk')}
                        </button>
                    ) : (
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={handleInputChange}
                                placeholder={t('type_message')}
                                className="w-full bg-white rounded-[4px] border-none px-3 py-2 text-[15px] text-[var(--color-text-main)] placeholder:text-[#B2B2B2] focus:outline-none"
                            />
                            {/* @mention dropdown */}
                            {showMentionDropdown && mentionCandidates.length > 0 && (
                                <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] max-h-[200px] overflow-y-auto z-40">
                                    {mentionCandidates.map((person) => {
                                        const pName = language === 'zh' ? (person.name_zh || person.name) : person.name;
                                        return (
                                            <button
                                                key={person.id}
                                                onClick={() => handleMentionSelect(person)}
                                                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50"
                                            >
                                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200">
                                                    {person.avatar ? (
                                                        <img src={person.avatar} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white text-xs">
                                                            {pName.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-[var(--color-text-main)]">@{pName}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        className={cn("p-1.5 relative transition-colors", showEmojiPicker ? "text-[var(--color-primary)]" : "text-[#7F7F7F]")}
                        onClick={() => {
                            setShowEmojiPicker(!showEmojiPicker);
                            setShowStickerPicker(false);
                            setShowPlusMenu(false);
                        }}
                    >
                        <Smile size={24} />
                    </button>

                    <button
                        type="button"
                        className={cn("p-1.5 relative transition-colors", showStickerPicker ? "text-[var(--color-primary)]" : "text-[#7F7F7F]")}
                        onClick={() => {
                            setShowStickerPicker(!showStickerPicker);
                            setShowEmojiPicker(false);
                            setShowPlusMenu(false);
                        }}
                    >
                        <Heart size={24} />
                    </button>

                    {inputValue.trim() ? (
                        <button type="submit" className="bg-[var(--color-primary)] text-white px-4 py-1.5 rounded-[4px] text-[15px] font-medium hover:bg-[var(--color-primary-hover)]">
                            {t('send')}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={cn("p-1.5 relative transition-colors", showPlusMenu ? "text-[var(--color-primary)]" : "text-[#7F7F7F]")}
                            onClick={() => {
                                setShowPlusMenu(!showPlusMenu);
                                setShowEmojiPicker(false);
                                setShowStickerPicker(false);
                            }}
                        >
                            <Plus size={24} />
                        </button>
                    )}
                </form>

                {/* Popups */}
                {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 z-30">
                        <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
                    </div>
                )}

                {showStickerPicker && (
                    <div className="absolute bottom-full left-0 mb-2 z-30">
                        <StickerPicker aiId={headerInfo.id} onSelect={handleStickerSelect} onClose={() => setShowStickerPicker(false)} />
                    </div>
                )}

                {showPlusMenu && (
                    <div className="absolute bottom-full right-2 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-[200px] grid grid-cols-4 gap-2 z-30 animate-scale-in">
                        <MenuButton icon={Paperclip} label={t('file')} onClick={() => setShowFileUploader(true)} color="text-blue-500" bg="bg-blue-50" />
                        <MenuButton icon={Gift} label={language === 'zh' ? '礼物' : 'Gift'} onClick={() => setShowGiftPanel(true)} color="text-pink-500" bg="bg-pink-50" />
                        <MenuButton icon={Coins} label={language === 'zh' ? '红包' : 'Packet'} onClick={() => setShowRedPacketPanel(true)} color="text-red-500" bg="bg-red-50" />
                        <MenuButton icon={Gamepad2} label={language === 'zh' ? '游戏' : 'Game'} onClick={() => setShowGame(true)} color="text-purple-500" bg="bg-purple-50" />
                    </div>
                )}
            </div>

            {/* Modals */}
            {showFileUploader && (
                <div className="absolute bottom-16 left-2 mb-2 z-40">
                    <FileUploader onFileSelect={handleFileSelect} onClose={() => setShowFileUploader(false)} />
                </div>
            )}

            {selectedMessage && (
                <MessageMenu
                    message={selectedMessage}
                    isOwnMessage={selectedMessage.senderId === 'user-me'}
                    isPinned={chat?.pinnedMessages?.includes(selectedMessage.id)}
                    position={menuPosition}
                    onClose={() => setSelectedMessage(null)}
                    onCopy={handleCopyMessage}
                    onQuote={handleQuoteMessage}
                    onDelete={handleDeleteMessage}
                    onForward={handleForwardMessage}
                    onPin={(msgId, pin) => {
                        pinMessage(chat.id, msgId, pin);
                        showToast(pin ? (language === 'zh' ? '消息已置顶' : 'Message pinned') : (language === 'zh' ? '已取消置顶' : 'Unpinned'));
                    }}
                />
            )}

            {showForwardModal && (
                <ForwardModal
                    message={messageToForward}
                    onClose={() => setShowForwardModal(false)}
                    onForward={confirmForward}
                />
            )}

            {showGiftPanel && (
                <GiftPanel
                    recipientId={headerInfo.id}
                    recipientName={headerInfo.name}
                    onClose={() => setShowGiftPanel(false)}
                    onGiftSent={handleGiftSent}
                />
            )}

            {showRedPacketPanel && (
                <RedPacketPanel
                    recipientName={headerInfo.name}
                    onClose={() => setShowRedPacketPanel(false)}
                    onSend={handleRedPacketSent}
                />
            )}

            {showGame && (
                <RockPaperScissors
                    aiName={headerInfo.name}
                    onClose={() => setShowGame(false)}
                    onResult={handleGameResult}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 text-white text-sm rounded-lg z-50 animate-fade-in">
                    {toast}
                </div>
            )}
        </div>
    );
}

function MenuButton({ icon: Icon, label, onClick, color, bg }) {
    return (
        <button
            onClick={() => {
                onClick();
                // Close menu handled by parent usually, but good to ensure
            }}
            className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-1", bg, color)}>
                <Icon size={24} />
            </div>
            <span className="text-xs text-gray-600">{label}</span>
        </button>
    );
}
