import React, { useRef, useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { cn } from '../../../../utils/cn';
import { formatTimeSeparator, shouldShowTimeSeparator } from '../../../../utils/formatTime';
import { downloadFile } from '../../../../utils/fileUtils';
import { Paperclip, MoreHorizontal, Coins, Gamepad2 } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';
import QuotedMessage from '../QuotedMessage';
import PollMessage from '../PollMessage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { GeneratedFileMessage } from '../FileMessage';
import VoicePlayer from '../VoicePlayer';
import { getCharacterGlowClass, getCharacterThemeStyle } from '../CharacterTheme';
import { useTheme } from '../../../../context/ThemeContext';
import TypingBubble from './TypingBubble';
import ImageMessage, { ImageLightbox } from '../ImageMessage';
import LinkPreview from '../LinkPreview';

const LazyMarkdownCodeBlock = lazy(() => import('../MarkdownCodeBlock'));
const LazyMermaidRenderer = lazy(() => import('../MermaidRenderer'));
import ToolResultCard from '../ToolResultCard';

/**
 * T07: Highlight @mentions in message content
 * @param {string} content - Message content
 * @param {Array} participants - Chat participants (personas)
 * @param {string} currentUserId - Current user ID
 * @param {Function} onMentionClick - Callback when mention is clicked
 * @returns {React.ReactNode} Content with highlighted mentions
 */
function HighlightedMentions({ content, participants, currentUserId, onMentionClick }) {
    const { t } = useLanguage();

    // Build mention pattern from participant names
    const mentionPattern = React.useMemo(() => {
        if (!participants?.length) return null;
        const names = participants.map(p => p.name).filter(Boolean);
        if (!names.length) return null;
        // Escape special regex characters in names
        const escapedNames = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return new RegExp(`@(${escapedNames.join('|')})`, 'g');
    }, [participants]);

    const handleMentionClick = useCallback((e, mentionName) => {
        e.stopPropagation();
        const mentionedParticipant = participants?.find(p => p.name === mentionName);
        if (mentionedParticipant && onMentionClick) {
            onMentionClick(mentionedParticipant);
        }
    }, [participants, onMentionClick]);

    if (!mentionPattern) return content;

    // Split content by mentions and render with highlighting
    const parts = content.split(mentionPattern);

    return parts.map((part, index) => {
        // Check if this part is a mention (odd indices in the split result)
        if (index % 2 === 1) {
            const isCurrentUser = participants?.find(p => p.name === part)?.id === currentUserId;
            return (
                <span
                    key={index}
                    onClick={(e) => handleMentionClick(e, part)}
                    className={cn(
                        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium cursor-pointer',
                        'transition-all duration-200 hover:scale-105',
                        isCurrentUser
                            ? 'bg-[var(--color-primary)] text-white shadow-sm'
                            : 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                    )}
                    title={isCurrentUser ? t('mention_you') : `@${part}`}
                >
                    @{part}
                </span>
            );
        }
        return part;
    });
}

function CodeBlock({ language, children }) {
    const code = String(children).replace(/\n$/, '');
    return (
        <Suspense fallback={<pre className="my-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-active)] p-3 overflow-x-auto"><code>{code}</code></pre>}>
            <LazyMarkdownCodeBlock language={language}>{code}</LazyMarkdownCodeBlock>
        </Suspense>
    );
}

/**
 * T08: Link component with preview
 */
function LinkWithPreview({ href, children, ...props }) {
    const [showPreview, setShowPreview] = useState(false);
    const isExternal = href?.startsWith('http');

    // Don't show preview for non-HTTP links or internal links
    if (!isExternal) {
        return (
            <a
                href={href}
                className="text-blue-500 hover:underline"
                {...props}
            >
                {children}
            </a>
        );
    }

    return (
        <span className="relative inline-block">
            <a
                href={href}
                className="text-blue-500 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={() => setShowPreview(true)}
                onMouseLeave={() => setShowPreview(false)}
                {...props}
            >
                {children}
            </a>
            {showPreview && <LinkPreview url={href} />}
        </span>
    );
}

export default function MessageTimeline({
    chat,
    currentUser,
    personas,
    typingIndicators, // T05: New prop
    onContextMenu,
    onVotePoll,
    onMentionClick // T07: Mention click handler
}) {
    const { t, language } = useLanguage();
    const { bubbleStyle } = useTheme();
    const messagesEndRef = useRef(null);

    // T07: Lightbox state for images
    const [lightboxImage, setLightboxImage] = useState(null);
    const mentionParticipants = chat?.participants?.map((pid) => (
        pid === 'user-me' ? currentUser : personas?.find((p) => p.id === pid)
    )).filter(Boolean) || [];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, [chat?.messages]);


    const getSenderName = (senderId) => {
        if (senderId === 'user-me') return t('you');
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
                // T13: tool_event messages are rendered as inline tool cards, not bubbles
                if (msg.type === 'tool_event') {
                    return (
                        <ToolResultCard
                            key={msg.id}
                            msg={msg}
                            language={language}
                        />
                    );
                }

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
                } else if (content.startsWith('[IMG:')) {
                    // T07: Image message detection
                    type = 'image';
                    const match = content.match(/\[IMG:(.+?)\]/);
                    if (match) {
                        meta = { url: match[1] };
                        content = ''; // Content is the image
                    }
                } else if (content.startsWith('[VOICE:')) {
                    // T07: Voice message detection
                    type = 'voice';
                    const match = content.match(/\[VOICE:(.+?)\]/);
                    if (match) {
                        const duration = match[1];
                        meta = { duration };
                        content = ''; // Content is the voice player
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
                                    )}
                                        style={isMe && (type === 'text' || type === 'file')
                                            ? {
                                                background: 'var(--gradient-user-bubble, linear-gradient(135deg, #f9735d 0%, #ef5b7f 100%))',
                                                backgroundSize: '180% 180%',
                                                color: '#ffffff',
                                                textShadow: '0 1px 1px rgba(0, 0, 0, 0.18)'
                                            }
                                            : undefined
                                        }>
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
                                                    onVote={(pollId, optionId, action) => onVotePoll(pollId, optionId, action)}
                                                />
                                            </div>
                                        ) : type === 'image' && meta?.url ? (
                                            // T07: Image message rendering
                                            <ImageMessage
                                                url={meta.url}
                                                isMe={isMe}
                                                onClick={() => setLightboxImage(meta.url)}
                                            />
                                        ) : type === 'voice' ? (
                                            // T07: Voice message rendering
                                            <VoicePlayer
                                                duration={meta?.duration || '0s'}
                                                url="#"
                                                isMe={isMe}
                                            />
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
                                                    rehypePlugins={[rehypeKatex]}
                                                    components={{
                                                        // T07: Highlight mentions in text content
                                                        p: ({ children }) => {
                                                            // Process children to highlight mentions
                                                            const processChildren = (childList) => {
                                                                return React.Children.map(childList, (child, idx) => {
                                                                    if (typeof child === 'string') {
                                                                        return (
                                                                            <HighlightedMentions
                                                                                key={idx}
                                                                                content={child}
                                                                                participants={mentionParticipants}
                                                                                currentUserId={currentUser?.id}
                                                                                onMentionClick={onMentionClick}
                                                                            />
                                                                        );
                                                                    }
                                                                    return child;
                                                                });
                                                            };
                                                            return <div className="whitespace-pre-wrap mb-2 last:mb-0">{processChildren(children)}</div>;
                                                        },
                                                        // T08 Phase 5: Link with preview
                                                        a: LinkWithPreview,
                                                        // T08 Phases 1,2,4: Code block with copy button, theme switching, Mermaid support
                                                        code: ({ inline, className, children, ...props }) => {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            const language = match?.[1];

                                                            // T08 Phase 4: Mermaid diagram rendering
                                                            if (language === 'mermaid') {
                                                                const diagramSource = String(children);
                                                                return (
                                                                    <Suspense fallback={<pre className="my-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-active)] p-3 overflow-x-auto"><code>{diagramSource}</code></pre>}>
                                                                        <LazyMermaidRenderer content={diagramSource} />
                                                                    </Suspense>
                                                                );
                                                            }

                                                            return !inline && match ? (
                                                                <CodeBlock language={language}>
                                                                    {String(children).replace(/\n$/, '')}
                                                                </CodeBlock>
                                                            ) : (
                                                                <code className="bg-black/5 dark:bg-white/10 rounded px-1 py-0.5 text-[0.9em] font-mono" {...props}>
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
                                                        td: ({ ...props }) => <td className="px-3 py-2 text-sm text-[var(--color-text-main)] border-t border-[var(--color-border-light)] break-words" {...props} />
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

                                        {/* T07: Read Receipt Indicator */}
                                        {isMe && msg.readBy?.length > 0 && (
                                            <span
                                                className="absolute -bottom-2 -right-2 bg-[var(--color-bg-white)] rounded-full p-0.5 shadow-sm text-[var(--color-primary)] z-10"
                                                title={msg.readBy.length === 1 ? t('read_by_one') : t('read_by_multiple', { count: msg.readBy.length })}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                    <polyline points="20 12 9 23 4 18" opacity="0.5"></polyline>
                                                </svg>
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

            {/* T05: Typing Indicator Bubbles */}
            {(typingIndicators?.[chat.id] || []).map(aiId => {
                const ai = personas.find(p => p.id === aiId);
                return ai ? <TypingBubble key={aiId} persona={ai} /> : null;
            })}

            <div ref={messagesEndRef} />

            {/* T07: Image Lightbox */}
            <ImageLightbox
                url={lightboxImage}
                isOpen={!!lightboxImage}
                onClose={() => setLightboxImage(null)}
            />
        </div>
    );
}
