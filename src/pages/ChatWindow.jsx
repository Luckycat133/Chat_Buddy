import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, MoreHorizontal, Plus, Smile, Mic, Paperclip, X, Heart, Gift, Trophy, Gamepad2, Coins, Keyboard, Search, BarChart3 } from 'lucide-react';
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
import MessageSearchPanel from '../components/MessageSearchPanel';
import ForwardModal from '../components/ForwardModal';
import GiftPanel from '../components/GiftPanel';
import RedPacketPanel from '../components/RedPacketPanel';
import RockPaperScissors from '../components/RockPaperScissors';
import PollMessage from '../components/PollMessage';
import GroupPoll from '../components/GroupPoll';

export default function ChatWindow() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { chats, personas, currentUser, sendMessage, updateChat, typingIndicators, deleteMessage, pinMessage, votePoll } = useChat();
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
    const [showSearchPanel, setShowSearchPanel] = useState(false);

    // Voice Message states
    const [isRecordingMode, setIsRecordingMode] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStart, setRecordingStart] = useState(0);

    // Feature modals
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showGiftPanel, setShowGiftPanel] = useState(false);
    const [showRedPacketPanel, setShowRedPacketPanel] = useState(false);
    const [showGame, setShowGame] = useState(false);
    const [showPoll, setShowPoll] = useState(false);
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

    const handleCreatePoll = (poll) => {
        // Logic similar to GroupDetails but we need to update chat polling data
        // For now, simpler: just send message, but we need to persist poll data to show it interactive
        // In GroupDetails we did: updateChat(id, { polls: [poll, ...] })
        // We need updateChat here too? It's not in useChat return destructure in ChatWindow yet.
        // Let's check useChat destructuring below.
        // It's missing 'updateChat'. I need to add it.
        // If I can't add it easily, I might skip persistence or do it via context.
        // Actually, updateChat IS returned by useChat context, I just didn't destructure it in ChatWindow.
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
            <div className="px-4 py-3 bg-white/80 backdrop-blur-md flex items-center justify-between border-b border-[var(--color-border-light)] sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="md:hidden p-1.5 -ml-1.5 rounded-full hover:bg-black/5 text-[var(--color-text-main)] transition-colors">
                        <ArrowLeft size={22} />
                    </button>
                    <div>
                        <h2
                            className="font-semibold text-[var(--color-text-main)] text-[17px] cursor-pointer flex items-center gap-2"
                            onClick={() => navigate(`/chat/${chat.id}/details`)}
                        >
                            {headerInfo.name}
                            {headerInfo.memberCount && <span className="px-2 py-0.5 bg-[var(--color-gray-100)] text-[var(--color-text-muted)] text-xs rounded-full font-medium">{headerInfo.memberCount}</span>}
                        </h2>
                        {typingNames.length > 0 && (
                            <p className="text-xs text-[var(--color-primary)] font-medium flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] inline-block" />
                                {typingNames.length === 1
                                    ? `${typingNames[0]} ${t('is_typing')}`
                                    : `${typingNames.length} ${t('people_typing')}`
                                }
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button className="p-2 rounded-full hover:bg-black/5 text-[var(--color-text-main)] transition-colors" onClick={() => setShowSearchPanel(true)}>
                        <Search size={20} />
                    </button>
                    <button className="p-2 rounded-full hover:bg-black/5 text-[var(--color-text-main)] transition-colors" onClick={() => navigate(`/chat/${chat.id}/details`)}>
                        <MoreHorizontal size={20} />
                    </button>
                </div>
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
                    } else if (content.startsWith('[POLL:')) {
                        type = 'poll';
                        const match = content.match(/\[POLL:(.+?)\]/);
                        if (match) {
                            const pollId = match[1];
                            const poll = chat.polls?.find(p => p.id === pollId);
                            if (poll) {
                                meta = { poll };
                            } else {
                                type = 'text'; // Fallback if poll not found
                                content = '[Poll not found]';
                            }
                        }
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
                                className={cn("flex mb-4 animate-message-in group/msg", isMe ? "justify-end" : "justify-start")}
                                onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                            >
                                <div className={cn("flex max-w-[75%] gap-2.5", isMe ? "flex-row-reverse" : "flex-row")}>
                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                                        {sender?.avatar ? (
                                            <img src={sender.avatar} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-active)] flex items-center justify-center text-white text-xs font-bold">
                                                {senderName?.charAt(0)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bubble */}
                                    <div className="relative">
                                        <div className={cn(
                                            "relative shadow-sm transition-all duration-200",
                                            (type === 'text' || type === 'file')
                                                ? (isMe
                                                    ? "px-4 py-2.5 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-active)] text-white rounded-2xl rounded-tr-sm"
                                                    : "px-4 py-2.5 bg-white text-[var(--color-text-main)] rounded-2xl rounded-tl-sm border border-[var(--color-border-light)]")
                                                : "bg-transparent"
                                        )}>
                                            {/* Content based on type */}
                                            {quotedData && (
                                                <QuotedMessage quotedMessage={quotedData} senderName={quotedData.senderName} />
                                            )}

                                            {type === 'sticker' ? (
                                                <div className="text-7xl drop-shadow-md hover:scale-110 transition-transform cursor-pointer origin-bottom">
                                                    {content}
                                                </div>
                                            ) : type === 'gift' && meta ? (
                                                <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-3 rounded-2xl shadow-lg flex items-center gap-3 min-w-[160px]">
                                                    <div className="text-3xl bg-white/20 p-2 rounded-xl">{meta.emoji}</div>
                                                    <div>
                                                        <p className="font-bold text-sm">{language === 'zh' ? meta.name : meta.name_en}</p>
                                                        <p className="text-xs opacity-90">{language === 'zh' ? '赠送礼物' : 'Gift Sent'}</p>
                                                    </div>
                                                </div>
                                            ) : type === 'red_packet' && meta ? (
                                                <div className="bg-gradient-to-r from-[#FA9D3B] to-[#F76B1C] text-white p-1 rounded-2xl shadow-md cursor-pointer hover:shadow-lg transition-shadow min-w-[220px]">
                                                    <div className="flex items-center gap-3 p-3">
                                                        <div className="bg-[#FEF2DC] rounded-xl p-2.5 text-[#FA9D3B]">
                                                            <Coins size={24} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold">{meta.message || (language === 'zh' ? '恭喜发财' : 'Best Wishes')}</p>
                                                            <p className="text-xs opacity-90">{language === 'zh' ? '查看红包' : 'Open Packet'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white/10 px-3 py-1 rounded-b-xl text-[10px] opacity-80">
                                                        Chat Buddy Red Packet
                                                    </div>
                                                </div>
                                            ) : type === 'game' ? (
                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2">
                                                    <Gamepad2 size={24} className="text-[var(--color-primary)]" />
                                                    <p className="font-medium text-center text-sm">{content}</p>
                                                </div>
                                            ) : type === 'poll' && meta?.poll ? (
                                                <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 p-1">
                                                    <PollMessage
                                                        poll={meta.poll}
                                                        onVote={(pollId, optionId) => votePoll(chat.id, pollId, optionId)}
                                                    />
                                                </div>
                                            ) : type === 'file' ? (
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("p-2 rounded-lg", isMe ? "bg-white/20" : "bg-gray-100")}>
                                                        <Paperclip size={20} className={isMe ? "text-white" : "text-[var(--color-text-muted)]"} />
                                                    </div>
                                                    <div className="text-sm underline underline-offset-2 opacity-90 hover:opacity-100 cursor-pointer">
                                                        {content}
                                                    </div>
                                                </div>
                                            ) : (
                                                // Text
                                                <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>
                                            )}

                                            {reaction && (
                                                <span className="absolute -bottom-2 -right-2 bg-white rounded-full p-0.5 shadow-sm text-xs border border-gray-100 z-10 scale-110">
                                                    {reaction}
                                                </span>
                                            )}
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

                                    {/* Action Menu Trigger (Visible on Hover) */}
                                    <button
                                        onClick={(e) => handleMessageContextMenu(e, msg)}
                                        className={cn(
                                            "opacity-0 group-hover/msg:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-gray-100 text-gray-400 self-center",
                                            isMe ? "mr-1" : "ml-1"
                                        )}
                                    >
                                        <MoreHorizontal size={14} />
                                    </button>
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
            <div className="p-4 bg-[var(--color-bg-chat)] relative z-20">
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
                                    "flex-1 rounded-xl border-none px-4 py-3 text-[15px] font-medium transition-all select-none text-center shadow-inner",
                                    isRecording
                                        ? "bg-[var(--color-primary-light)] text-[var(--color-primary-active)] scale-95"
                                        : "bg-gray-100 hover:bg-gray-200 text-[var(--color-text-main)]"
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
                                {/* @mention dropdown */}
                                {showMentionDropdown && mentionCandidates.length > 0 && (
                                    <div className="absolute bottom-full left-0 mb-3 bg-white rounded-xl shadow-float border border-[var(--color-border)] py-2 min-w-[200px] max-h-[240px] overflow-y-auto z-40">
                                        {mentionCandidates.map((person) => {
                                            const pName = language === 'zh' ? (person.name_zh || person.name) : person.name;
                                            return (
                                                <button
                                                    key={person.id}
                                                    onClick={() => handleMentionSelect(person)}
                                                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200">
                                                        {person.avatar ? (
                                                            <img src={person.avatar} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white text-xs font-bold">
                                                                {pName.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[var(--color-text-main)] font-medium">@{pName}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-1 mb-0.5">
                            <button
                                type="button"
                                className={cn("p-2 rounded-full hover:bg-gray-100 transition-colors", showEmojiPicker ? "text-[var(--color-primary)] bg-[var(--color-primary-softer)]" : "text-[var(--color-text-muted)]")}
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
                                className={cn("p-2 rounded-full hover:bg-gray-100 transition-colors", showStickerPicker ? "text-[var(--color-primary)] bg-[var(--color-primary-softer)]" : "text-[var(--color-text-muted)]")}
                                onClick={() => {
                                    setShowStickerPicker(!showStickerPicker);
                                    setShowEmojiPicker(false);
                                    setShowPlusMenu(false);
                                }}
                            >
                                <Heart size={24} />
                            </button>

                            {inputValue.trim() ? (
                                <button type="submit" className="ml-1 bg-[var(--color-primary)] text-white px-5 py-2 rounded-xl text-[15px] font-medium hover:bg-[var(--color-primary-hover)] active:scale-95 shadow-lg shadow-orange-200 transition-all">
                                    {t('send')}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className={cn("p-2 rounded-full hover:bg-gray-100 transition-colors", showPlusMenu ? "text-[var(--color-primary)] bg-[var(--color-primary-softer)]" : "text-[var(--color-text-muted)]")}
                                    onClick={() => {
                                        setShowPlusMenu(!showPlusMenu);
                                        setShowEmojiPicker(false);
                                        setShowStickerPicker(false);
                                    }}
                                >
                                    <Plus size={24} />
                                </button>
                            )}
                        </div>
                    </form>
                </div>

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
                        <MenuButton icon={BarChart3} label={language === 'zh' ? '投票' : 'Poll'} onClick={() => setShowPoll(true)} color="text-orange-500" bg="bg-orange-50" />
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

            {showPoll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg w-full max-w-md mx-4 overflow-hidden shadow-2xl animate-scale-in">
                        <GroupPoll
                            onClose={() => setShowPoll(false)}
                            onCreatePoll={(poll) => {
                                const currentPolls = chat.polls || [];
                                updateChat(chat.id, { polls: [poll, ...currentPolls] });
                                sendMessage(chat.id, `[POLL:${poll.id}]`);
                                setShowPoll(false);
                                setShowPlusMenu(false);
                            }}
                        />
                    </div>
                </div>
            )}

            {showSearchPanel && (
                <MessageSearchPanel
                    currentChatId={chat.id}
                    onClose={() => setShowSearchPanel(false)}
                    onSelectMessage={(chatId, messageId) => {
                        // Navigate to message or highlight it
                        // For now we just close, as we are already in the chat or will stay here
                        // Theoretically we should scroll to message, but that requires more complex logic
                        setShowSearchPanel(false);
                    }}
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
