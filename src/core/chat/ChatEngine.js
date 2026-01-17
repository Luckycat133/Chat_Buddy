import { storage } from '../../services/storage/StorageService';
import { AIPipeline } from './AIPipeline';
import { cleanMessageContent } from '../../features/chat/services/chatService';

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
        this.chats = [];
        this.currentUserId = 'user-me';
        this.personas = []; // Need to be injected or loaded
        this.listeners = new Set();

        // Ephemeral state
        this.typingIndicators = {}; // { chatId: [aiId, ...] }

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
        this.personas = personas;
        this.chats = storage.get(this.storageKey, []);
        console.log('[ChatEngine] Initialized with', this.chats.length, 'chats');
        this._notify();
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    _notify() {
        // Emit a snapshot of the current state
        const state = {
            chats: this.chats,
            typingIndicators: { ...this.typingIndicators }
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

    votePoll(chatId, pollId, optionId) {
        // Implement poll voting logic if needed widely
        // For now, simple mutation
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return;
        const chat = this.chats[chatIndex];

        const polls = chat.polls || [];
        const pollIndex = polls.findIndex(p => p.id === pollId);
        if (pollIndex === -1) return;

        const poll = { ...polls[pollIndex] };
        // Assuming poll structure: { options: [{id, votes:[]}] }
        // This logic is simplified; real logic might be complex. 
        // Adapting from typical poll logic:
        const updatedOptions = poll.options.map(opt => {
            if (opt.id === optionId) {
                // Toggle vote or add? Assuming add for now.
                // Simple version: increment count or add userId
                return { ...opt, votes: [...(opt.votes || []), 'user-me'] };
            }
            return opt;
        });

        poll.options = updatedOptions;

        const newPolls = [...polls];
        newPolls[pollIndex] = poll;

        this.chats[chatIndex] = { ...chat, polls: newPolls };
        this.save();
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
                this.aiPipeline.processTurn(chat, this.personas, ai);
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
        import('../../features/chat/services/chatService').then(({ callAI }) => {
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
        });
    }
}

// Singleton instance
export const chatEngine = new ChatEngine();
