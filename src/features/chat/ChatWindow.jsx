import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from './context/ChatContext';
import { useLanguage } from '../../context/LanguageContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatFileSize } from '../../utils/fileUtils';

// Sub-components (always loaded)
import ChatHeader from './components/window/ChatHeader';
import MessageTimeline from './components/window/MessageTimeline';
import ChatComposer from './components/window/ChatComposer';
import MessageMenu from './components/MessageMenu';
import { getCharacterThemeStyle } from './components/CharacterTheme';

// Lazy-loaded modals/panels (loaded on demand)
const ForwardModal = lazy(() => import('./components/ForwardModal'));
const GiftPanel = lazy(() => import('./components/GiftPanel'));
const RedPacketPanel = lazy(() => import('./components/RedPacketPanel'));
const RockPaperScissors = lazy(() => import('./components/RockPaperScissors'));
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
    const id = propChatId || paramChatId;
    const { chats, personas, currentUser, sendMessage, updateChat, typingIndicators, deleteMessage, pinMessage, votePoll } = useChat();
    const { t, language } = useLanguage();
    const { addDocument } = useDocuments();

    // Feature modals state
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showGiftPanel, setShowGiftPanel] = useState(false);
    const [showRedPacketPanel, setShowRedPacketPanel] = useState(false);
    const [showGame, setShowGame] = useState(false);
    const [showPoll, setShowPoll] = useState(false);
    const [messageToForward, setMessageToForward] = useState(null);
    const [showSearchPanel, setShowSearchPanel] = useState(false); // Lifted state
    const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);

    // Interaction states
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [quotedMessage, setQuotedMessage] = useState(null);
    const [toast, setToast] = useState(null);

    const chat = chats.find(c => c.id === id);

    // Auto-hide toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    if (!chat) return <div className="flex items-center justify-center h-full bg-[var(--color-bg-app)] text-[var(--color-text-muted)]">{t('select_chat')}</div>;

    // Determine character for theming (DM only)
    const isDM = chat.participants.length === 2;
    const otherParticipantId = isDM ? chat.participants.find(p => p !== 'user-me') : null;
    const characterStyle = otherParticipantId ? getCharacterThemeStyle(otherParticipantId) : {};

    // --- Handlers ---

    const showToast = (msg) => setToast(msg);

    const handleMessageContextMenu = (e, msg) => {
        e.preventDefault();
        setSelectedMessage(msg);
        setMenuPosition({ x: e.clientX, y: e.clientY });
    };

    const handleFileSelect = (fileData) => {
        addDocument(fileData);
        sendMessage(chat.id, `[FILE] ${fileData.name} (${formatFileSize(fileData.size)})`);
        showToast(t('file_uploaded'));
    };

    const handleGiftSent = (gift) => {
        // Core logic: sendMessage(chat.id, `[GIFT:${gift.emoji}:${gift.name}:${gift.name_en}]`);
        // But let's keep logic close to UI or in Service? 
        // For now, duplicate simple string construction or move to helper
        sendMessage(chat.id, `[GIFT:${gift.emoji}:${gift.name}:${gift.name_en}]`);
        setShowGiftPanel(false);
        showToast(t('gift_sent'));
    };

    const handleRedPacketSent = ({ amount, message }) => {
        sendMessage(chat.id, `[RED_PACKET:${amount}:${message}]`);
        setShowRedPacketPanel(false);
        showToast(t('red_packet_sent'));
    };

    const handleGameResult = ({ result, score }) => {
        const resultText = result === 'win' ? 'Win' : result === 'lose' ? 'Lose' : 'Draw';
        sendMessage(chat.id, `[GAME:RPS:${resultText}:${score.player}-${score.ai}]`);
        setShowGame(false);
    };

    const handleCreatePoll = (poll) => {
        const currentPolls = chat.polls || [];
        updateChat(chat.id, { polls: [poll, ...currentPolls] });
        sendMessage(chat.id, `[POLL:${poll.id}]`);
        setShowPoll(false);
    };

    const confirmForward = (message, targetChatIds) => {
        targetChatIds.forEach(targetId => sendMessage(targetId, message.content));
        showToast(t('message_forwarded') || 'Forwarded');
        setMessageToForward(null);
        setShowForwardModal(false);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-chat)] relative flex-1" style={characterStyle}>
            <Suspense fallback={null}>
                <BackgroundLayer chatId={chat.id} />
            </Suspense>
            <ChatHeader
                chat={chat}
                personas={personas}
                typingIndicators={typingIndicators}
                onOpenBackground={() => setShowBackgroundSettings(true)}
            // onOpenSearch={() => setShowSearchPanel(true)} // If we want to verify search works, we need to wire this or let it use URL
            />

            <MessageTimeline
                chat={chat}
                currentUser={currentUser}
                personas={personas}
                onContextMenu={handleMessageContextMenu}
                onVotePoll={(pollId, optId) => votePoll(chat.id, pollId, optId)}
            />

            <ChatComposer
                chatId={chat.id}
                chat={chat}
                personas={personas}
                headerInfo={{ id: chat.participants[1], name: chat.name }} // Approx for sticker picker
                quotedMessage={quotedMessage}
                onSendMessage={(content, qId) => sendMessage(chat.id, content, qId)}
                onCancelQuote={() => setQuotedMessage(null)}
                // Menu Actions
                onOpenGift={() => setShowGiftPanel(true)}
                onOpenRedPacket={() => setShowRedPacketPanel(true)}
                onOpenGame={() => setShowGame(true)}
                onOpenPoll={() => setShowPoll(true)}
                onFileSelect={handleFileSelect}
            />

            {/* Overlays */}
            {selectedMessage && (
                <MessageMenu
                    message={selectedMessage}
                    isOwnMessage={selectedMessage.senderId === 'user-me'}
                    isPinned={chat?.pinnedMessages?.includes(selectedMessage.id)}
                    position={menuPosition}
                    onClose={() => setSelectedMessage(null)}
                    onCopy={() => showToast(t('message_copied'))}
                    onQuote={setQuotedMessage}
                    onDelete={(id) => { deleteMessage(chat.id, id); showToast(t('message_deleted')); }}
                    onForward={(msg) => { setMessageToForward(msg); setShowForwardModal(true); }}
                    onPin={(msgId, pin) => {
                        pinMessage(chat.id, msgId, pin);
                        showToast(pin ? t('message_pinned') : t('message_unpinned'));
                    }}
                />
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

            {showGame && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <RockPaperScissors
                        aiName={chat.name}
                        onClose={() => setShowGame(false)}
                        onResult={handleGameResult}
                    />
                </Suspense>
            )}

            {showPoll && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-[var(--color-bg-white)] border border-[var(--color-border)] rounded-lg w-full max-w-md mx-4 overflow-hidden shadow-2xl animate-scale-in">
                            <GroupPoll onClose={() => setShowPoll(false)} onCreatePoll={handleCreatePoll} />
                        </div>
                    </div>
                </Suspense>
            )}

            {/* Search Panel */}
            {showSearchPanel && (
                <Suspense fallback={<ModalLoadingFallback />}>
                    <MessageSearchPanel
                        currentChatId={chat.id}
                        onClose={() => setShowSearchPanel(false)}
                        onSelectMessage={() => setShowSearchPanel(false)}
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

            {toast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 text-white text-sm rounded-lg z-50 animate-fade-in">
                    {toast}
                </div>
            )}
        </div>
    );
}
