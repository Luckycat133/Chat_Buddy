import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, MoreHorizontal, Plus, Smile, Mic, Paperclip, X } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { useDocuments } from '../context/DocumentContext';
import { cn } from '../utils/cn';
import { formatTimeSeparator, shouldShowTimeSeparator } from '../utils/formatTime';
import { downloadFile, formatFileSize } from '../utils/fileUtils';
import EmojiPicker from '../components/EmojiPicker';
import MessageMenu from '../components/MessageMenu';
import QuotedMessage from '../components/QuotedMessage';
import FileUploader from '../components/FileUploader';
import FileMessage, { GeneratedFileMessage } from '../components/FileMessage';

export default function ChatWindow() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { chats, personas, currentUser, sendMessage, typingIndicators, deleteMessage } = useChat();
    const { t, language } = useLanguage();
    const { addDocument } = useDocuments();
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

    // UI states
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showFileUploader, setShowFileUploader] = useState(false);
    const [showPlusMenu, setShowPlusMenu] = useState(false);

    // Message interaction states
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [quotedMessage, setQuotedMessage] = useState(null);

    // Toast state
    const [toast, setToast] = useState(null);

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

    const handleSend = (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const messageData = {
            content: inputValue,
            quotedMessageId: quotedMessage?.id || null
        };

        sendMessage(chat.id, inputValue);
        setInputValue('');
        setQuotedMessage(null);
    };

    const handleEmojiSelect = (emoji) => {
        setInputValue(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const handleFileSelect = (fileData) => {
        // Add to knowledge base and send as message
        addDocument(fileData);
        sendMessage(chat.id, `[FILE] ${fileData.name} (${formatFileSize(fileData.size)})`);
        setShowFileUploader(false);
        setShowPlusMenu(false);
        showToast(t('file_uploaded'));
    };

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

    const getHeaderInfo = () => {
        if (chat.participants.length === 2) {
            const otherId = chat.participants.find(p => p !== 'user-me');
            const other = personas.find(p => p.id === otherId);
            const name = language === 'zh' && other ? (other.name_zh || other.name) : (other?.name || chat.name);
            return { name: name, avatar: other?.avatar };
        }
        return {
            name: chat.name,
            avatar: null,
            memberCount: chat.participants.length
        };
    };

    const headerInfo = getHeaderInfo();

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
            {/* Header - WeChat style */}
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
                        {/* Typing indicator */}
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

            {/* Messages - WeChat style with time separators */}
            <div className="flex-1 overflow-y-auto p-3 pb-20 md:pb-4">
                {chat.messages.map((msg, index) => {
                    const isMe = msg.senderId === 'user-me';
                    const sender = isMe ? currentUser : personas.find(p => p.id === msg.senderId);
                    const senderName = getSenderName(msg.senderId);

                    let content = msg.content;
                    let reaction = null;
                    let isFileMessage = false;
                    let fileData = msg.fileData;

                    // Check for file message
                    if (content.startsWith('[FILE]')) {
                        isFileMessage = true;
                        content = content.replace('[FILE]', '').trim();
                    }

                    const reactMatch = content.match(/\[REACT:(.+?)\]/);
                    if (reactMatch) {
                        reaction = reactMatch[1];
                        content = content.replace(reactMatch[0], '').trim();
                    }

                    const imgMatch = content.match(/\[IMG:(.+?)\]/);
                    if (imgMatch) {
                        content = content.replace(imgMatch[0], '').trim();
                    }

                    // Check if we should show time separator
                    const prevMsg = index > 0 ? chat.messages[index - 1] : null;
                    const showTimeSeparator = shouldShowTimeSeparator(
                        prevMsg?.timestamp,
                        msg.timestamp,
                        5 // 5 minutes threshold
                    );

                    // Get quoted message if exists
                    const quotedData = getQuotedMessageData(msg.quotedMessageId);

                    return (
                        <React.Fragment key={msg.id}>
                            {/* Time Separator */}
                            {showTimeSeparator && (
                                <div className="flex justify-center my-4">
                                    <span className="px-3 py-1 bg-black/5 text-[var(--color-text-muted)] text-xs rounded-full">
                                        {formatTimeSeparator(msg.timestamp, language)}
                                    </span>
                                </div>
                            )}

                            {/* Message */}
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
                                        {/* Triangle pointer */}
                                        <div className={cn(
                                            "absolute top-3 w-0 h-0 border-[6px]",
                                            isMe
                                                ? "right-[-10px] border-transparent border-l-[var(--color-primary)]"
                                                : "left-[-10px] border-transparent border-r-white"
                                        )} />

                                        <div className={cn(
                                            "px-3 py-2 text-[15px] leading-relaxed relative",
                                            isMe
                                                ? "bg-[var(--color-primary)] text-white rounded-[4px]"
                                                : "bg-white text-[var(--color-text-main)] rounded-[4px] shadow-sm"
                                        )}>
                                            {/* Quoted message */}
                                            {quotedData && (
                                                <QuotedMessage
                                                    quotedMessage={quotedData}
                                                    senderName={quotedData.senderName}
                                                />
                                            )}

                                            {/* File message */}
                                            {isFileMessage ? (
                                                <div className={cn(
                                                    "text-sm",
                                                    isMe ? "text-white/90" : "text-gray-600"
                                                )}>
                                                    📎 {content}
                                                </div>
                                            ) : (
                                                <p className="whitespace-pre-wrap break-words">{content}</p>
                                            )}

                                            {reaction && (
                                                <span className="ml-1">{reaction}</span>
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
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Quoted message preview */}
            {quotedMessage && (
                <div className="px-3 py-2 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-1 h-8 bg-[var(--color-primary)] rounded-full flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--color-primary)]">
                                {t('reply_to')} {getSenderName(quotedMessage.senderId)}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                {quotedMessage.content.slice(0, 50)}
                                {quotedMessage.content.length > 50 && '...'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setQuotedMessage(null)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Input - WeChat style */}
            <div className="p-2 bg-[#F7F7F7] border-t border-[var(--color-border)] relative">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <button type="button" className="p-1.5 text-[#7F7F7F]">
                        <Mic size={24} />
                    </button>

                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={t('type_message')}
                        className="flex-1 bg-white rounded-[4px] border-none px-3 py-2 text-[15px] text-[var(--color-text-main)] placeholder:text-[#B2B2B2] focus:outline-none"
                    />

                    <button
                        type="button"
                        className="p-1.5 text-[#7F7F7F] relative"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                        <Smile size={24} />
                    </button>

                    {inputValue.trim() ? (
                        <button
                            type="submit"
                            className="bg-[var(--color-primary)] text-white px-4 py-1.5 rounded-[4px] text-[15px] font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
                        >
                            {t('send')}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="p-1.5 text-[#7F7F7F]"
                            onClick={() => setShowPlusMenu(!showPlusMenu)}
                        >
                            <Plus size={24} />
                        </button>
                    )}
                </form>

                {/* Emoji Picker */}
                {showEmojiPicker && (
                    <div className="absolute bottom-full left-12 mb-2">
                        <EmojiPicker
                            onSelect={handleEmojiSelect}
                            onClose={() => setShowEmojiPicker(false)}
                        />
                    </div>
                )}

                {/* Plus Menu */}
                {showPlusMenu && (
                    <div className="absolute bottom-full right-2 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[140px] z-50">
                        <button
                            onClick={() => {
                                setShowFileUploader(true);
                                setShowPlusMenu(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 text-gray-700"
                        >
                            <Paperclip size={18} />
                            {t('file')}
                        </button>
                    </div>
                )}

                {/* File Uploader */}
                {showFileUploader && (
                    <div className="absolute bottom-full left-2 mb-2">
                        <FileUploader
                            onFileSelect={handleFileSelect}
                            onClose={() => setShowFileUploader(false)}
                        />
                    </div>
                )}
            </div>

            {/* Message Context Menu */}
            {selectedMessage && (
                <MessageMenu
                    message={selectedMessage}
                    isOwnMessage={selectedMessage.senderId === 'user-me'}
                    position={menuPosition}
                    onClose={() => setSelectedMessage(null)}
                    onCopy={handleCopyMessage}
                    onQuote={handleQuoteMessage}
                    onDelete={handleDeleteMessage}
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
