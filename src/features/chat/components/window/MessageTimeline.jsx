import React, { useRef, useEffect } from 'react';
import { cn } from '../../../../utils/cn';
import { formatTimeSeparator, shouldShowTimeSeparator } from '../../../../utils/formatTime';
import { downloadFile } from '../../../../utils/fileUtils';
import { Paperclip, MoreHorizontal, Coins, Gamepad2 } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';
import QuotedMessage from '../QuotedMessage';
import PollMessage from '../PollMessage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GeneratedFileMessage } from '../FileMessage';
import { getCharacterGlowClass, getCharacterThemeStyle } from '../CharacterTheme';
import { useTheme } from '../../../../context/ThemeContext';

export default function MessageTimeline({
    chat,
    currentUser,
    personas,
    onContextMenu,
    onVotePoll
}) {
    const { language } = useLanguage();
    const { bubbleStyle } = useTheme();
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, [chat?.messages]);

    const getSenderName = (senderId) => {
        if (senderId === 'user-me') return 'You'; // Simplified, trans handled in parent usually or hook
        const sender = personas.find(p => p.id === senderId);
        return language === 'zh' ? (sender?.name_zh || sender?.name) : sender?.name;
    };

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
        <div className="flex-1 overflow-y-auto p-3 pb-20 md:pb-4" data-bubble-style={bubbleStyle}>
            {chat.messages.map((msg, index) => {
                const isMe = msg.senderId === 'user-me';
                const sender = isMe ? currentUser : personas.find(p => p.id === msg.senderId);
                const senderName = getSenderName(msg.senderId);

                let content = msg.content;
                let reaction = null;
                let type = 'text';
                let meta = null;

                // Parse custom message types (Legacy logic preserved)
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
                            type = 'text';
                            content = '[Poll not found]';
                        }
                    }
                }

                const reactMatch = content.match(/\[REACT:(.+?)\]/);
                if (reactMatch) {
                    reaction = reactMatch[1];
                    content = content.replace(reactMatch[0], '').trim();
                }

                const prevMsg = index > 0 ? chat.messages[index - 1] : null;
                const showTimeSeparator = shouldShowTimeSeparator(prevMsg?.timestamp, msg.timestamp, 5);
                const quotedData = getQuotedMessageData(msg.quotedMessageId);

                return (
                    <React.Fragment key={msg.id}>
                        {showTimeSeparator && (
                            <div className="flex justify-center my-6">
                                <span className="px-3 py-1 bg-[var(--color-bg-active)] text-[var(--color-text-muted)] text-[11px] font-medium rounded-full shadow-sm">
                                    {formatTimeSeparator(msg.timestamp, language)}
                                </span>
                            </div>
                        )}

                        <div
                            className={cn(
                                "flex mb-4 group/msg",
                                isMe ? "justify-end" : "justify-start",
                                "bubble-enter"
                            )}
                            style={{ animationDelay: `${(index % 5) * 50}ms` }}
                            onContextMenu={(e) => onContextMenu(e, msg)}
                        >
                            <div
                                className={cn("flex max-w-[75%] gap-2.5 min-w-0", isMe ? "flex-row-reverse" : "flex-row")}
                                style={!isMe ? getCharacterThemeStyle(msg.senderId) : {}}
                            >
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
                                <div className="relative min-w-0 overflow-visible">
                                    <div className={cn(
                                        "relative transition-all duration-200 message-bubble-hover",
                                        (type === 'text' || type === 'file')
                                            ? (isMe
                                                ? "bubble-msg-me px-4.5 py-3 bg-[var(--gradient-aurora)] text-white rounded-[20px] rounded-tr-sm shadow-md"
                                                : cn(
                                                    "bubble-msg px-4.5 py-3 bg-[var(--color-bg-white)] text-[var(--color-text-main)] rounded-[20px] rounded-tl-sm border border-[var(--color-border-light)] shadow-sm",
                                                    "message-bubble-ai",
                                                    getCharacterGlowClass(msg.senderId)
                                                ))
                                            : "bg-transparent"
                                    )}>
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
                                            <div className="bg-[var(--color-bg-white)] p-4 rounded-2xl shadow-sm border border-[var(--color-border-light)] flex flex-col items-center gap-2">
                                                <Gamepad2 size={24} className="text-[var(--color-primary)]" />
                                                <p className="font-medium text-center text-sm">{content}</p>
                                            </div>
                                        ) : type === 'poll' && meta?.poll ? (
                                            <div className="bg-[var(--color-bg-white)] rounded-2xl overflow-hidden shadow-sm border border-[var(--color-border-light)] p-1">
                                                <PollMessage
                                                    poll={meta.poll}
                                                    onVote={(pollId, optionId) => onVotePoll(pollId, optionId)}
                                                />
                                            </div>
                                        ) : type === 'file' ? (
                                            <div className="flex items-center gap-3">
                                                <div className={cn("p-2.5 rounded-xl", isMe ? "bg-white/20" : "bg-[var(--color-bg-active)]")}>
                                                    <Paperclip size={20} className={isMe ? "text-white" : "text-[var(--color-text-muted)]"} />
                                                </div>
                                                <div className="text-sm underline underline-offset-2 opacity-90 hover:opacity-100 cursor-pointer">
                                                    {content}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="markdown-body prose prose-sm max-w-full break-words leading-relaxed text-inherit overflow-x-auto">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        // Custom components can be added here
                                                        a: ({ ...props }) => <a {...props} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" />,
                                                        code: ({ inline, className, children, ...props }) => {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            return !inline && match ? (
                                                                <SyntaxHighlighter
                                                                    style={vscDarkPlus}
                                                                    language={match[1]}
                                                                    PreTag="div"
                                                                    className="rounded-md !bg-black/80 !p-3 !my-2 shadow-sm border border-white/10"
                                                                    {...props}
                                                                >
                                                                    {String(children).replace(/\n$/, '')}
                                                                </SyntaxHighlighter>
                                                            ) : (
                                                                <code className="bg-black/5 rounded px-1 py-0.5 text-[0.9em] font-mono" {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        },
                                                        table: ({ ...props }) => (
                                                            <div className="overflow-x-auto my-4 border border-[var(--color-border)] rounded-lg shadow-sm">
                                                                <table className="min-w-full divide-y divide-[var(--color-border)]" {...props} />
                                                            </div>
                                                        ),
                                                        th: ({ ...props }) => <th className="px-3 py-2 bg-[var(--color-bg-active)] text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" {...props} />,
                                                        td: ({ ...props }) => <td className="px-3 py-2 whitespace-nowrap text-sm text-[var(--color-text-main)] border-t border-[var(--color-border-light)]" {...props} />
                                                    }}
                                                >
                                                    {content}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        {reaction && (
                                            <span className="absolute -bottom-2 -right-2 bg-[var(--color-bg-white)] rounded-full p-0.5 shadow-sm text-xs border border-[var(--color-border-light)] z-10 scale-110">
                                                {reaction}
                                            </span>
                                        )}
                                    </div>

                                    {/* Generated Files */}
                                    {msg.generatedFiles?.map((file, idx) => (
                                        <div key={idx} className="mt-2">
                                            <GeneratedFileMessage
                                                fileData={file}
                                                onDownload={() => downloadFile(file.filename, file.content)}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={(e) => onContextMenu(e, msg)}
                                    className={cn(
                                        "opacity-0 group-hover/msg:opacity-100 transition-opacity p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] self-center active:scale-95",
                                        isMe ? "mr-2" : "ml-2"
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
    );
}
