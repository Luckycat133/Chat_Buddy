import { storage } from '../../services/storage/StorageService';
import { AIPipeline } from './AIPipeline';
import { cleanMessageContent, callAI } from '../../features/chat/services/chatService';
import { getPresenceMap } from '../presence/PresenceService';
import { checkReEngagement } from '../presence/GreetingService';
import { getMoodMap } from '../presence/MoodService';
import { addBookmark, removeBookmark, getBookmarks, isBookmarked } from '../../features/chat/services/BookmarkService';

/**
 * Domain Layer: Chat Engine
 * The central nervous system for Chat Buddy.
 * Manages:
 * - Persistence (via StorageService)
 * - State mutations (Business Logic)
 * - AI Orchestration (via AIPipeline)
 */
export class ChatEngine {
    constructor() {
        this.storageKey = 'chat-buddy-chats';
        this.storageKeyCandidates = [
            'chat-buddy-chats',
            'chat-buddy:chat-buddy-chats'
        ];
        this.migrationMetaKey = 'migrations';
        this.chatMigrationFlag = 'chatStorageV2';
        this.chats = [];
        this.currentUserId = 'user-me';
        this.personas = []; // Need to be injected or loaded
        this.listeners = new Set();

        // Ephemeral state
        this.typingIndicators = {}; // { chatId: [aiId, ...] }
        this.presenceMap = {};      // { personaId: 'online'|'offline'|'busy' }
        this.moodMap = {};          // { personaId: moodObject }

        // T06: Callback hooks & context provider
        this._onUserMessageCallbacks = [];
        this._contextProvider = null;

        // Sub-systems
        this.aiPipeline = new AIPipeline({
            onTyping: this._handleAITyping.bind(this),
            onMessage: this._handleAIMessage.bind(this),
            onSchedule: this._handleAISchedule.bind(this),
            onLog: (msg, data) => console.log(`[ChatEngine] ${msg}`, data)
        });
    }

    /**
     * Initialize engine with data
     */
    init(personas) {
        this.destroy();
        this.personas = personas;
        this.chats = this._loadChatsWithMigration();
        console.log('[ChatEngine] Initialized with', this.chats.length, 'chats');

        // T05: Start presence tracking & greeting checker
        this._startPresenceUpdates(personas);
        this._startGreetingChecker();

        this._notify();
    }

    _loadChatsWithMigration() {
        let selectedKey = null;
        let loadedChats = [];

        for (const key of this.storageKeyCandidates) {
            const value = storage.get(key, null);
            if (Array.isArray(value)) {
                selectedKey = key;
                loadedChats = value;
                break;
            }
        }

        const normalized = loadedChats
            .map(chat => this._normalizeChat(chat))
            .filter(Boolean);

        // Canonical write-back to keep storage source consistent.
        storage.set(this.storageKey, normalized);

        // Mark migration metadata when data came from non-canonical key.
        if (selectedKey && selectedKey !== this.storageKey) {
            const migrationMeta = storage.get(this.migrationMetaKey, {});
            storage.set(this.migrationMetaKey, {
                ...migrationMeta,
                [this.chatMigrationFlag]: {
                    from: selectedKey,
                    to: this.storageKey,
                    migratedAt: new Date().toISOString()
                }
            });
        }

        return normalized;
    }

    _normalizeChat(chat) {
        if (!chat || typeof chat !== 'object' || !chat.id) return null;

        const messages = Array.isArray(chat.messages)
            ? chat.messages.map(msg => this._normalizeMessage(msg)).filter(Boolean)
            : [];

        const lastMessage = chat.lastMessage && typeof chat.lastMessage === 'object'
            ? this._normalizeMessage(chat.lastMessage)
            : messages[messages.length - 1] || null;

        const createdAt = chat.createdAt || chat.updatedAt || new Date().toISOString();
        const updatedAt = chat.updatedAt || lastMessage?.timestamp || createdAt;
        const participants = Array.isArray(chat.participants)
            ? chat.participants
            : ['user-me'];

        return {
            ...chat,
            name: chat.name || 'New Chat',
            participants,
            messages,
            lastMessage,
            createdAt,
            updatedAt,
            polls: Array.isArray(chat.polls) ? chat.polls : [],
            pinnedMessages: Array.isArray(chat.pinnedMessages) ? chat.pinnedMessages : [],
            settings: chat.settings || { muteValues: {} }
        };
    }

    _normalizeMessage(message) {
        if (!message || typeof message !== 'object') return null;
        if (!message.id || !message.senderId || typeof message.content !== 'string') return null;

        return {
            ...message,
            timestamp: message.timestamp || new Date().toISOString(),
            status: message.status || 'sent',
            readBy: Array.isArray(message.readBy) ? message.readBy : []
        };
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * T06: Register a callback for when the user sends a message.
     * Callback signature: (chatId, aiParticipantIds) => void
     */
    registerOnUserMessage(callback) {
        this._onUserMessageCallbacks.push(callback);
        return () => {
            this._onUserMessageCallbacks = this._onUserMessageCallbacks.filter(cb => cb !== callback);
        };
    }

    /**
     * T06: Set a context provider function for affinity/mood-aware AI prompts.
     * Provider signature: (personaId) => { intimacyLevel, intimacyScore, mood }
     */
    setContextProvider(fn) {
        this._contextProvider = fn;
    }

    _notify() {
        // Emit a snapshot of the current state
        const state = {
            chats: this.chats,
            typingIndicators: { ...this.typingIndicators },
            presenceMap: { ...this.presenceMap },
            moodMap: { ...this.moodMap }
        };
        this.listeners.forEach(cb => cb(state));
    }

    save() {
        storage.set(this.storageKey, this.chats);
        this._notify();
    }

    // =========================================================================
    // Business Logic: Message Actions
    // =========================================================================

    sendMessage(chatId, content, senderId = 'user-me', quotedMessageId = null) {
        const cleaned = cleanMessageContent(content);
        if (!cleaned) return;

        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;

        const newMessage = {
            id: crypto.randomUUID(),
            senderId,
            content: cleaned,
            timestamp: new Date().toISOString(),
            status: 'sent',
            quotedMessageId,
            readBy: []
        };

        // Mutation
        const updatedChat = { ...this.chats[chatIndex] };
        updatedChat.messages = [...updatedChat.messages, newMessage];
        updatedChat.lastMessage = newMessage;
        updatedChat.updatedAt = newMessage.timestamp;

        this.chats[chatIndex] = updatedChat;
        this.save();

        // Trigger AI if user sent message
        if (senderId === 'user-me') {
            // T06: Notify user-message callbacks (for chat-based affinity gain)
            const aiIds = updatedChat.participants.filter(id => id !== 'user-me');
            this._onUserMessageCallbacks.forEach(cb => cb(chatId, aiIds));

            this._checkAutoNaming(updatedChat);
            this._triggerAIResponse(updatedChat);
        }
    }

    deleteMessage(chatId, messageId) {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;

        const chat = this.chats[chatIndex];
        const updatedMessages = chat.messages.filter(m => m.id !== messageId);

        this.chats[chatIndex] = {
            ...chat,
            messages: updatedMessages
        };
        this.save();
    }

    createChat(name, participantIds, avatar = null) {
        const newChat = {
            id: crypto.randomUUID(),
            name,
            avatar,
            participants: ['user-me', ...participantIds],
            admins: ['user-me'],
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            theme: 'default',
            settings: {
                muteValues: {}
            },
            polls: []
        };

        this.chats = [newChat, ...this.chats];
        this.save();
        return newChat.id;
    }

    // =========================================================================
    // Extended Actions (Legacy Parity)
    // =========================================================================

    updateChat(chatId, updates) {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;

        this.chats[chatIndex] = { ...this.chats[chatIndex], ...updates };
        this.save();
    }

    pinChat(chatId, isPinned = true) {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;

        this.chats[chatIndex] = { ...this.chats[chatIndex], isPinned };
        this.save();
    }

    markChatUnread(chatId, isUnread = true) {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;

        this.chats[chatIndex] = { ...this.chats[chatIndex], isUnread };
        this.save();
    }

    deleteChat(chatId) {
        const nextChats = this.chats.filter(c => c.id !== chatId);
        if (nextChats.length === this.chats.length) return;

        this.chats = nextChats;
        delete this.typingIndicators[chatId];
        this.save();
    }

    clearChatMessages(chatId) {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;

        const chat = this.chats[chatIndex];
        this.chats[chatIndex] = {
            ...chat,
            messages: [],
            lastMessage: null,
            pinnedMessages: []
        };
        this.save();
    }

    pinMessage(chatId, messageId, isPinned) {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;

        const chat = this.chats[chatIndex];
        const pinnedMessages = chat.pinnedMessages || [];

        let newPinned;
        if (isPinned) {
            if (!pinnedMessages.includes(messageId)) {
                newPinned = [...pinnedMessages, messageId];
            } else {
                return;
            }
        } else {
            newPinned = pinnedMessages.filter(id => id !== messageId);
        }

        this.chats[chatIndex] = { ...chat, pinnedMessages: newPinned };
        this.save();
    }

    votePoll(chatId, pollId, optionId, action = 'switch') {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;
        const chat = this.chats[chatIndex];

        const polls = chat.polls || [];
        const pollIndex = polls.findIndex(p => p.id === pollId);
        if (pollIndex === -1) return;

        const poll = { ...polls[pollIndex] };
        const userId = 'user-me';

        // Check if poll has expired
        if (poll.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now()) {
            return { success: false, error: 'Poll has expired' };
        }

        let updatedOptions;

        if (action === 'add') {
            // Multi-choice: add vote to this option
            updatedOptions = poll.options.map(opt => {
                if (opt.id === optionId && !opt.votes?.includes(userId)) {
                    return { ...opt, votes: [...(opt.votes || []), userId] };
                }
                return opt;
            });
        } else if (action === 'remove') {
            // Multi-choice: remove vote from this option
            updatedOptions = poll.options.map(opt => {
                if (opt.id === optionId) {
                    return { ...opt, votes: opt.votes?.filter(v => v !== userId) || [] };
                }
                return opt;
            });
        } else {
            // Single choice (switch): remove from all other options, toggle this one
            const currentlyVoted = poll.options.find(opt => opt.id === optionId && opt.votes?.includes(userId));

            updatedOptions = poll.options.map(opt => {
                if (opt.id === optionId) {
                    // Toggle this option
                    if (currentlyVoted) {
                        return { ...opt, votes: opt.votes?.filter(v => v !== userId) || [] };
                    } else {
                        return { ...opt, votes: [...(opt.votes || []), userId] };
                    }
                } else {
                    // Remove vote from other options (single choice behavior)
                    return { ...opt, votes: opt.votes?.filter(v => v !== userId) || [] };
                }
            });
        }

        poll.options = updatedOptions;

        const newPolls = [...polls];
        newPolls[pollIndex] = poll;

        this.chats[chatIndex] = { ...chat, polls: newPolls };
        this.save();
        return { success: true };
    }

    // =========================================================================
    // T07: Message Bookmarks
    // =========================================================================

    bookmarkMessage(chatId, messageId) {
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return { success: false, error: 'Chat not found' };

        const message = chat.messages.find(m => m.id === messageId);
        if (!message) return { success: false, error: 'Message not found' };

        const sender = this.personas.find(p => p.id === message.senderId);
        const senderName = message.senderId === 'user-me'
            ? 'You'
            : (sender?.name || 'Unknown');

        const result = addBookmark({
            messageId,
            chatId,
            content: message.content,
            senderId: message.senderId,
            senderName,
            chatName: chat.name
        });

        return { success: result, isBookmarked: true };
    }

    unbookmarkMessage(messageId) {
        const result = removeBookmark(messageId);
        return { success: result, isBookmarked: false };
    }

    getBookmarkedMessages() {
        return getBookmarks();
    }

    isMessageBookmarked(messageId) {
        return isBookmarked(messageId);
    }

    // =========================================================================
    // T07: Read Receipts
    // =========================================================================

    /**
     * Mark messages in a chat as read by a specific reader
     * @param {string} chatId - Chat ID
     * @param {string} readerId - ID of the reader (usually 'user-me')
     */
    markMessagesAsRead(chatId, readerId = 'user-me') {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;

        const chat = this.chats[chatIndex];
        let hasChanges = false;

        // Mark all messages not from the reader as read by the reader
        const updatedMessages = chat.messages.map(msg => {
            if (msg.senderId !== readerId) {
                const readBy = msg.readBy || [];
                if (!readBy.includes(readerId)) {
                    hasChanges = true;
                    return { ...msg, readBy: [...readBy, readerId] };
                }
            }
            return msg;
        });

        if (hasChanges) {
            this.chats[chatIndex] = { ...chat, messages: updatedMessages };
            this.save();
        }
    }

    /**
     * Get read status for a message
     * @param {string} messageId - Message ID
     * @param {string} chatId - Chat ID
     * @returns {Object} Read status info
     */
    getMessageReadStatus(messageId, chatId) {
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return { readBy: [], isRead: false };

        const message = chat.messages.find(m => m.id === messageId);
        if (!message) return { readBy: [], isRead: false };

        const readBy = message.readBy || [];
        return {
            readBy,
            isRead: readBy.length > 0,
            readCount: readBy.length
        };
    }

    // =========================================================================
    // AI Orchestration
    // =========================================================================

    _handleAITyping(chatId, aiId, isTyping) {
        const current = this.typingIndicators[chatId] || [];

        if (isTyping) {
            if (!current.includes(aiId)) {
                this.typingIndicators[chatId] = [...current, aiId];
            }
        } else {
            this.typingIndicators[chatId] = current.filter(id => id !== aiId);
            if (this.typingIndicators[chatId].length === 0) {
                delete this.typingIndicators[chatId];
            }
        }
        this._notify(); // Ephemeral update, no save
    }

    _handleAIMessage(chatId, content, aiId) {
        // AI sends message -> Reuse internal logic
        this.sendMessage(chatId, content, aiId);
    }

    _handleAISchedule(chatId, ai, minutes) {
        console.log(`[ChatEngine] Scheduling proactive msg for ${ai.name} in ${minutes}m`);
        // TODO: Implement robust scheduling via setTimeout or a Scheduler Service
        // For standard "Refactor Phase 2", we can keep it simple:
        setTimeout(() => {
            const chat = this.chats.find(c => c.id === chatId);
            if (chat) {
                // Determine if we should still send (check last msg time)
                const lastMsg = chat.messages[chat.messages.length - 1];
                const timeDiff = Date.now() - new Date(lastMsg.timestamp).getTime();
                if (timeDiff > minutes * 60 * 1000 * 0.8) {
                    this.aiPipeline.processTurn(chat, this.personas, ai);
                }
            }
        }, minutes * 60 * 1000);
    }

    _triggerAIResponse(chat) {
        // Logic to determine WHICH AI should respond
        const candidates = chat.participants
            .filter(id => id !== 'user-me')
            .map(id => this.personas.find(p => p.id === id))
            .filter(Boolean);

        // Simple loop similar to original Context
        // To prevent double-responses, we can use a queue or just stagger them
        candidates.forEach((ai) => {
            // Check if AI was mentioned or if it's 1-on-1
            const isMentioned = chat.lastMessage.content.includes(`@${ai.name}`);
            const isDirect = chat.participants.length === 2;

            // Should respond?
            if (isDirect || isMentioned || Math.random() > 0.3) {
                // T06: Get affinity/mood context for this AI
                const context = this._contextProvider?.(ai.id) || null;
                this.aiPipeline.processTurn(chat, this.personas, ai, context);
            }
        });
    }

    _checkAutoNaming(chat) {
        // Only run for 1-on-1 chats with Task Agents, when it's the first message
        if (chat.messages.length !== 1) return;
        if (chat.participants.length !== 2) return;

        const aiId = chat.participants.find(p => p !== 'user-me');
        const ai = this.personas.find(p => p.id === aiId);

        // Only for Task Agents
        if (!ai || ai.agentType !== 'task-specialist') return;

        // Construct a prompt specifically for naming
        const firstMessage = chat.messages[0].content;
        const namingPrompt = `
Generate a short, descriptive title (maximum 6 words) for a conversation that starts with the following message. 
The title should allow a user to instantly understand the topic of the chat for future lookup.
Do not use quotes or punctuation. Just the title text.

Message: "${firstMessage}"
Title:`;

        // Call AI Service directly for the name
        // We use a light model if possible, but standard callAI logic handles it
        callAI([
            { role: 'system', content: 'You are a helpful assistant that summarizes conversation topics.' },
            { role: 'user', content: namingPrompt }
        ], {
            maxTokens: 20,
            temperature: 0.3
        }).then(title => {
            if (title) {
                // Clean up quotes just in case
                const cleanTitle = title.replace(/["']/g, '').trim();
                console.log(`[ChatEngine] Auto-naming chat ${chat.id} -> ${cleanTitle}`);

                // Update chat name
                this.updateChat(chat.id, { name: cleanTitle });
            }
        }).catch(err => console.error('[ChatEngine] Auto-naming failed:', err));
    }
    // =========================================================================
    // T05: Presence & Greeting
    // =========================================================================

    _startPresenceUpdates(personas) {
        this._updatePresence(personas);
        this._presenceInterval = setInterval(() => {
            this._updatePresence(personas);
        }, 60_000); // Refresh every 60s
    }

    _updatePresence(personas) {
        this.presenceMap = getPresenceMap(personas);
        this.moodMap = getMoodMap(personas, this.presenceMap);
        this._notify();
    }

    _startGreetingChecker() {
        // Check for re-engagement every 30 minutes
        this._greetingInterval = setInterval(() => {
            this._checkReEngagement();
        }, 30 * 60 * 1000);
    }

    _checkReEngagement() {
        const result = checkReEngagement(this.chats, this.personas);
        if (result) {
            console.log(`[ChatEngine] Re-engagement greeting: ${result.personaId} → chat ${result.chatId}`);
            this.sendMessage(result.chatId, result.message, result.personaId);
        }
    }

    /**
     * Trigger a window-open greeting (called from UI layer)
     */
    triggerGreeting(chatId, message, personaId) {
        this.sendMessage(chatId, message, personaId);
    }

    /**
     * Cleanup intervals (for unmount)
     */
    destroy() {
        if (this._presenceInterval) clearInterval(this._presenceInterval);
        if (this._greetingInterval) clearInterval(this._greetingInterval);
    }
}

// Singleton instance
export const chatEngine = new ChatEngine();
