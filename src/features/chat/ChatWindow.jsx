import React, { useState, useEffect, useRef, lazy, Suspense, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useChat } from './context/ChatContext';
import { useLanguage } from '../../context/LanguageContext';
import { useDocuments } from '../../context/DocumentContext';
import { useSocial } from '../../context/SocialContext';
import { formatFileSize } from '../../utils/fileUtils';
import { getBookmarks } from './services/BookmarkService';

// Sub-components (always loaded)
import ChatHeader from './components/window/ChatHeader';
import MessageTimeline from './components/window/MessageTimeline';
import ChatComposer from './components/window/ChatComposer';
import { getCharacterThemeStyle } from './components/CharacterTheme';
import { checkWindowOpenGreeting } from '../../core/presence/GreetingService';

// Lazy-loaded modals/panels (loaded on demand)
const ForwardModal = lazy(() => import('./components/ForwardModal'));
const GiftPanel = lazy(() => import('./components/GiftPanel'));
const RedPacketPanel = lazy(() => import('./components/RedPacketPanel'));
const RockPaperScissors = lazy(() => import('./components/RockPaperScissors'));
const NumberGuessGame = lazy(() => import('./components/NumberGuessGame'));
const GameSelectorPanel = lazy(() => import('./components/GameSelectorPanel'));
const TriviaQuiz = lazy(() => import('./components/TriviaQuiz'));
const IdiomChainGame = lazy(() => import('./components/IdiomChainGame'));
const ExportModal = lazy(() => import('./components/ExportModal'));
const MessageMenu = lazy(() => import('./components/MessageMenu'));
const BookmarkPanel = lazy(() => import('./components/BookmarkPanel'));
const GroupPoll = lazy(() => import('./components/GroupPoll'));
const MessageSearchPanel = lazy(() => import('./components/MessageSearchPanel'));

const BackgroundLayer = lazy(() => import('../background/BackgroundLayer'));
const BackgroundSettingsModal = lazy(() => import('../background/BackgroundSettingsModal'));

// Loading fallback
const ModalLoadingFallback = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
);

export default function ChatWindow({ chatId: propChatId }) {
    const { id: paramChatId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const id = propChatId || paramChatId;
    const { chats, personas, currentUser, sendMessage, updateChat, typingIndicators, editingIndicators, deleteMessage, pinMessage, votePoll, presenceMap, moodMap, triggerGreeting, bookmarkMessage, unbookmarkMessage, markMessagesAsRead } = useChat();
    const { t, language } = useLanguage();
    const { addDocument } = useDocuments();
    const { updateTaskProgress } = useSocial();

    // Feature modals state
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showGiftPanel, setShowGiftPanel] = useState(false);
    const [showRedPacketPanel, setShowRedPacketPanel] = useState(false);
    const [showGameSelector, setShowGameSelector] = useState(false);
    const [activeGame, setActiveGame] = useState(null); // 'rps' | 'number_guess'
    const [showPoll, setShowPoll] = useState(false);
    const [messageToForward, setMessageToForward] = useState(null);
    const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);

    // Interaction states
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [canRecallMessage, setCanRecallMessage] = useState(false);
    const [quotedMessage, setQuotedMessage] = useState(null);
    const [toast, setToast] = useState(null);
    const [focusedMessageId, setFocusedMessageId] = useState(null);

    // T07: Bookmark states
    const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);

    // T07: Export modal state
    const [showExportModal, setShowExportModal] = useState(false);
    const greetedChatIdRef = useRef(null);
    const toastTimerRef = useRef(null);

    const chat = useMemo(() => chats.find(c => c.id === id), [chats, id]);
    const isSearchRoute = location.pathname === `/chat/${id}/search`;
    const showSearchPanel = isSearchRoute;

    // --- Handlers (defined before early return to maintain hook order) ---

    const showToast = useCallback((msg) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        setToast(msg);
        toastTimerRef.current = setTimeout(() => {
            setToast(null);
            toastTimerRef.current = null;
        }, 2000);
    }, []);

    const handleMessageContextMenu = useCallback((e, msg) => {
        e.preventDefault();
        setSelectedMessage(msg);
        setMenuPosition({ x: e.clientX, y: e.clientY });
        const elapsed = msg?.timestamp ? Date.now() - new Date(msg.timestamp).getTime() : Infinity;
        setCanRecallMessage(elapsed < 2 * 60 * 1000);
    }, []);

    const handleFileSelect = useCallback((fileData) => {
        addDocument(fileData);
        if (chat?.id) {
            sendMessage(chat.id, `[FILE] ${fileData.name} (${formatFileSize(fileData.size)})`);
            showToast(t('file_uploaded'));
        }
    }, [chat, sendMessage, showToast, t, addDocument]);

    const handleGiftSent = useCallback((gift) => {
        if (!chat?.id) return;
        sendMessage(chat.id, `[GIFT:${gift.emoji}:${gift.name}:${gift.name_en}]`);
        updateTaskProgress('task_gift', 1);
        setShowGiftPanel(false);
        showToast(t('gift_sent'));
    }, [chat, sendMessage, showToast, t, updateTaskProgress]);

    const handleRedPacketSent = useCallback(({ amount, message }) => {
        if (!chat?.id) return;
        sendMessage(chat.id, `[RED_PACKET:${amount}:${message}]`);
        setShowRedPacketPanel(false);
        showToast(t('red_packet_sent'));
    }, [chat, sendMessage, showToast, t]);

    const handleGameResult = useCallback(({ result, score, attempts, rounds }) => {
        if (!chat?.id) return;
        if (activeGame === 'rps') {
            const resultText = result === 'win' ? 'Win' : result === 'lose' ? 'Lose' : 'Draw';
            sendMessage(chat.id, `[GAME:RPS:${resultText}:${score.player}-${score.ai}]`);
        } else if (activeGame === 'number_guess') {
            const resultText = result === 'win' ? `Win in ${attempts} tries` : 'Lose';
            sendMessage(chat.id, `[GAME:NUM:${resultText}]`);
        } else if (activeGame === 'idiom_chain') {
            const completedRounds = rounds || 0;
            sendMessage(chat.id, `[GAME:IDIOM:${result}:${completedRounds}]`);
        }
        setActiveGame(null);
    }, [activeGame, chat, sendMessage]);

    const handleCreatePoll = useCallback((poll) => {
        if (!chat?.id) return;
        const currentPolls = chat.polls || [];
        updateChat(chat.id, { polls: [poll, ...currentPolls] });
        sendMessage(chat.id, `[POLL:${poll.id}]`);
        setShowPoll(false);
    }, [chat, updateChat, sendMessage]);

    const confirmForward = useCallback((message, targetChatIds) => {
        targetChatIds.forEach(targetId => sendMessage(targetId, message.content));
        showToast(t('message_forwarded') || 'Forwarded');
        setMessageToForward(null);
        setShowForwardModal(false);
    }, [sendMessage, showToast, t]);

    const handleBookmark = useCallback((messageId, shouldBookmark) => {
        if (!chat?.id) return;
        if (shouldBookmark) {
            const result = bookmarkMessage(chat.id, messageId);
            if (result.success) {
                showToast(t('message_bookmarked') || 'Message bookmarked');
            } else {
                showToast(t('already_bookmarked') || 'Already bookmarked');
            }
        } else {
            const result = unbookmarkMessage(messageId);
            if (result.success) {
                showToast(t('bookmark_removed') || 'Bookmark removed');
            }
        }
    }, [chat, bookmarkMessage, unbookmarkMessage, showToast, t]);

    const navigateToMessage = useCallback((chatId, messageId) => {
        if (!chatId || !messageId) return;
        if (chatId !== chat?.id) {
            navigate(`/chat/${chatId}`, {
                state: { targetMessageId: messageId }
            });
            return;
        }
        setFocusedMessageId(messageId);
    }, [chat?.id, navigate]);

    const handleNavigateToBookmark = useCallback((chatId, messageId) => {
        navigateToMessage(chatId, messageId);
    }, [navigateToMessage]);

    const handleFocusHandled = useCallback(() => {
        setFocusedMessageId(null);
        if (!location.state?.targetMessageId) return;

        const nextState = location.state ? { ...location.state } : {};
        delete nextState.targetMessageId;
        const hasState = Object.keys(nextState).length > 0;
        navigate(location.pathname, { replace: true, state: hasState ? nextState : null });
    }, [location.state, location.pathname, navigate]);

    // T05: Window-open greeting check
    useEffect(() => {
        if (!chat?.id || chat.participants.length !== 2) return;
        if (greetedChatIdRef.current === chat.id) return;
        greetedChatIdRef.current = chat.id;

        const otherId = chat.participants.find(p => p !== 'user-me');
        const otherPersona = personas.find(p => p.id === otherId);
        if (!otherPersona) return;

        const greeting = checkWindowOpenGreeting(chat, otherPersona, language);
        if (!greeting) return;

        const timer = setTimeout(() => {
            triggerGreeting(chat.id, greeting.message, greeting.personaId);
        }, 1000);

        return () => clearTimeout(timer);
    }, [chat, chat?.id, personas, language, triggerGreeting]);

    useEffect(() => () => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
    }, []);

    // T07: Mark messages as read when chat is opened
    useEffect(() => {
        if (chat?.id) {
            markMessagesAsRead(chat.id, 'user-me');
        }
    }, [chat?.id, chat?.messages?.length, markMessagesAsRead]);

    // Keep bookmarked IDs in sync with bookmark storage for current chat.
    // Derived state: recompute when chat changes (avoids setState-in-effect pattern).
    const derivedBookmarkedIds = useMemo(() => {
        if (!chat?.id) return new Set();
        const ids = getBookmarks()
            .filter((bookmark) => bookmark.chatId === chat.id)
            .map((bookmark) => bookmark.messageId);
        return new Set(ids);
    }, [chat?.id, showBookmarkPanel]);

    // Receive target message from route state (global search / settings search / bookmark jumps).
    // Syncs from external navigation state - imperative but necessary for route-driven focus.
    useEffect(() => {
        const targetMessageId = location.state?.targetMessageId;
        if (targetMessageId) {
            setFocusedMessageId(targetMessageId);
        }
    }, [location.state?.targetMessageId]);

    // Determine character for theming (DM only) - derived from chat state
    const isDM = chat?.participants?.length === 2;
    const otherParticipantId = isDM ? chat.participants.find(p => p !== 'user-me') : null;
    const characterStyle = otherParticipantId ? getCharacterThemeStyle(otherParticipantId) : {};

    // No chat selected - render loading/error state instead of full chat UI
    if (!chat) {
        return (
            <div className="flex items-center justify-center h-full bg-[var(--color-bg-app)] text-[var(--color-text-muted)]">
                {t('select_chat')}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-chat)] relative flex-1" style={characterStyle}>
            <Suspense fallback={null}>
                <BackgroundLayer chatId={chat.id} />
            </Suspense>
            <ChatHeader
                chat={chat}
                personas={personas}
                typingIndicators={typingIndicators}
                presenceMap={presenceMap}
                moodMap={moodMap}
                onOpenBackground={() => setShowBackgroundSettings(true)}
                onOpenExport={() => setShowExportModal(true)}
                onOpenBookmarks={() => setShowBookmarkPanel(true)}
            />

            <MessageTimeline
                chat={chat}
                currentUser={currentUser}
                personas={personas}
                typingIndicators={typingIndicators}
                editingIndicators={editingIndicators}
                presenceMap={presenceMap} // For potentially showing status in bubble?
                onContextMenu={handleMessageContextMenu}
                onVotePoll={(pollId, optId, action) => votePoll(chat.id, pollId, optId, action)}
                focusMessageId={focusedMessageId}
                onFocusHandled={handleFocusHandled}
            />

            <ChatComposer
                chatId={chat.id}
                chat={chat}
                personas={personas}
                headerInfo={{ id: chat.participants[1], name: chat.name }} // Approx for sticker picker
                quotedMessage={quotedMessage}
                onSendMessage={(content, qId) => {
                    sendMessage(chat.id, content, qId);
                    if (content.startsWith('[STICKER:')) {
                        updateTaskProgress('task_sticker', 1);
                    } else if (!content.startsWith('[')) {
                        updateTaskProgress('task_messages', 1);
                    }
                }}
                onSendSticker={(stickerUrl) => {
                    sendMessage(chat.id, `[STICKER:${stickerUrl}]`);
                    updateTaskProgress('task_sticker', 1);
                }}
                onCancelQuote={() => setQuotedMessage(null)}
                // Menu Actions
                onOpenGift={() => setShowGiftPanel(true)}
                onOpenRedPacket={() => setShowRedPacketPanel(true)}
                onOpenGame={() => setShowGameSelector(true)}
                onOpenPoll={() => setShowPoll(true)}
                onSendFile={handleFileSelect}
                onError={showToast}
            />

            {/* Overlays */}
            {selectedMessage && (
                <Suspense fallback={null}>
                    <MessageMenu
                        message={selectedMessage}
                        isOwnMessage={selectedMessage.senderId === 'user-me'}
                        isPinned={chat?.pinnedMessages?.includes(selectedMessage.id)}
                        isBookmarked={derivedBookmarkedIds.has(selectedMessage.id)}
                        position={menuPosition}
                        canRecall={canRecallMessage}
                        onClose={() => setSelectedMessage(null)}
                        onCopy={() => showToast(t('message_copied'))}
                        onQuote={setQuotedMessage}
                        onDelete={(id) => { deleteMessage(chat.id, id); showToast(t('message_deleted')); }}
                        onForward={(msg) => { setMessageToForward(msg); setShowForwardModal(true); }}
                        onPin={(msgId, pin) => {
                            pinMessage(chat.id, msgId, pin);
                            showToast(pin ? t('message_pinned') : t('message_unpinned'));
                        }}
                        onBookmark={handleBookmark}
                    />
                </Suspense>
            )}

            {showForwardModal && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <ForwardModal
                        message={messageToForward}
                        onClose={() => setShowForwardModal(false)}
                        onForward={confirmForward}
                    />
                </Suspense>
            )}

            {showGiftPanel && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <GiftPanel
                        recipientId={chat.participants.find(p => p !== 'user-me')}
                        recipientName={chat.name}
                        onClose={() => setShowGiftPanel(false)}
                        onGiftSent={handleGiftSent}
                    />
                </Suspense>
            )}

            {showRedPacketPanel && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <RedPacketPanel
                        recipientName={chat.name}
                        onClose={() => setShowRedPacketPanel(false)}
                        onSend={handleRedPacketSent}
                    />
                </Suspense>
            )}

            {showGameSelector && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <GameSelectorPanel
                        aiName={chat.name}
                        onClose={() => setShowGameSelector(false)}
                        onSelectGame={(gameId) => {
                            setShowGameSelector(false);
                            setActiveGame(gameId);
                        }}
                    />
                </Suspense>
            )}

            {activeGame === 'rps' && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <RockPaperScissors
                        aiName={chat.name}
                        onClose={() => setActiveGame(null)}
                        onResult={handleGameResult}
                    />
                </Suspense>
            )}

            {activeGame === 'number_guess' && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <NumberGuessGame
                        aiName={chat.name}
                        onClose={() => setActiveGame(null)}
                        onResult={handleGameResult}
                    />
                </Suspense>
            )}

            {activeGame === 'trivia' && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <TriviaQuiz
                        aiName={chat.name}
                        chatId={chat.id}
                        personaId={chat.participants.find(p => p !== 'user-me')}
                        onClose={() => setActiveGame(null)}
                    />
                </Suspense>
            )}

            {activeGame === 'idiom_chain' && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <IdiomChainGame
                        aiName={chat.name}
                        onResult={handleGameResult}
                        onClose={() => setActiveGame(null)}
                    />
                </Suspense>
            )}

            {showPoll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-[var(--color-bg-white)] border border-[var(--color-border)] rounded-lg w-full max-w-md mx-4 overflow-hidden shadow-2xl animate-scale-in">
                        <Suspense fallback={<ModalLoadingFallback />}>
                            <GroupPoll onClose={() => setShowPoll(false)} onCreatePoll={handleCreatePoll} />
                        </Suspense>
                    </div>
                </div>
            )}

            {/* Search Panel */}
            {showSearchPanel && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <MessageSearchPanel
                        currentChatId={chat.id}
                        onClose={() => {
                            navigate(`/chat/${chat.id}`, { replace: true });
                        }}
                        onSelectMessage={(targetChatId, messageId) => {
                            if (isSearchRoute) {
                                navigate(`/chat/${targetChatId}`, {
                                    replace: true,
                                    state: { targetMessageId: messageId }
                                });
                                return;
                            }
                            navigateToMessage(targetChatId, messageId);
                        }}
                    />
                </Suspense>
            )}

            {showBackgroundSettings && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <BackgroundSettingsModal
                        isOpen={true}
                        chatId={chat.id}
                        onClose={() => setShowBackgroundSettings(false)}
                    />
                </Suspense>
            )}

            {/* T07: Bookmark Panel */}
            {showBookmarkPanel && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <BookmarkPanel
                        isOpen={showBookmarkPanel}
                        onClose={() => setShowBookmarkPanel(false)}
                        onNavigateToMessage={handleNavigateToBookmark}
                        personas={personas}
                    />
                </Suspense>
            )}

            {/* T07: Export Modal */}
            {showExportModal && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <ExportModal
                        chat={chat}
                        personas={personas}
                        onClose={() => setShowExportModal(false)}
                    />
                </Suspense>
            )}

            {toast && (
                <div className="toast">
                    {toast}
                </div>
            )}
        </div>
    );
}
