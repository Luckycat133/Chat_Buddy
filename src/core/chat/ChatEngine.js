import { storage as defaultStorage } from '../../services/storage/StorageService';
import defaultChatStorage from '../../services/storage/ChatStorageService';
import { AIPipeline } from './AIPipeline';
import { cleanMessageContent as defaultCleanMessageContent, callAI as defaultCallAI } from '../../features/chat/services/chatService';
import { extractGroupMemoriesAsync as defaultExtractGroupMemoriesAsync } from '../memory/ContextCompressor';
import { getPresenceMap as defaultGetPresenceMap } from '../presence/PresenceService';
import { checkReEngagement as defaultCheckReEngagement } from '../presence/GreetingService';
import { getMoodMap as defaultGetMoodMap } from '../presence/MoodService';
import { addBookmark as defaultAddBookmark, removeBookmark as defaultRemoveBookmark, getBookmarks as defaultGetBookmarks, isBookmarked as defaultIsBookmarked } from '../../features/chat/services/BookmarkService';
import { normalizeChat, getDirectPeerId, getChatActivityTimestamp, isTaskParticipant } from './ChatNormalizer';
import { dedupeDirectSocialChats } from './ChatDeduplicator';
import { votePoll, buildToolInputSummary } from './ChatPollManager';

/** @typedef {typeof DEFAULT_DEPS} ChatEngineDeps */

const DEFAULT_DEPS = {
  storage: defaultStorage,
  chatStorage: defaultChatStorage,
  cleanMessageContent: defaultCleanMessageContent,
  callAI: defaultCallAI,
  extractGroupMemoriesAsync: defaultExtractGroupMemoriesAsync,
  getPresenceMap: defaultGetPresenceMap,
  checkReEngagement: defaultCheckReEngagement,
  getMoodMap: defaultGetMoodMap,
  addBookmark: defaultAddBookmark,
  removeBookmark: defaultRemoveBookmark,
  getBookmarks: defaultGetBookmarks,
  isBookmarked: defaultIsBookmarked,
};

/**
 * Validates that a dependency conforms to its expected interface.
 * @param {string} key - Dependency name
 * @param {*} dep - The dependency value
 * @throws {Error} if the dependency fails validation
 */
function validateDep(key, dep) {
  if (key === 'storage') {
    if (!dep || typeof dep.get !== 'function' || typeof dep.set !== 'function') {
      throw new Error(`[ChatEngine] Invalid dependency "${key}": expected object with get() and set() methods`);
    }
    return;
  }

  if (key === 'chatStorage') {
    if (!dep || typeof dep.loadChats !== 'function' || typeof dep.saveChats !== 'function' || typeof dep.migrateFromLocalStorage !== 'function') {
      throw new Error(`[ChatEngine] Invalid dependency "${key}": expected object with loadChats(), saveChats(), migrateFromLocalStorage() methods`);
    }
    return;
  }

  if (typeof dep !== 'function') {
    throw new Error(`[ChatEngine] Invalid dependency "${key}": expected function, got ${typeof dep}`);
  }
}

const REQUIRED_DEPS = Object.keys(DEFAULT_DEPS);

export class ChatEngine {
  /** @param {Partial<ChatEngineDeps>} [deps={}] */
  constructor(deps = {}) {
    this.storageKey = 'chat-buddy-chats';
    this.storageKeyCandidates = [
      'chat-buddy-chats',
      'chat-buddy:chat-buddy-chats'
    ];
    this.migrationMetaKey = 'migrations';
    this.chatMigrationFlag = 'chatStorageV2';
    this.chats = [];
    this.currentUserId = 'user-me';
    this.personas = [];
    this.listeners = new Set();

    this.typingIndicators = {};
    this.editingIndicators = {};
    this.presenceMap = {};
    this.moodMap = {};
    this._scheduledMessages = new Map();
    this._saveTimer = null;

    this._onUserMessageCallbacks = [];
    this._contextProvider = null;

    /** @type {ChatEngineDeps} */
    this.deps = { ...DEFAULT_DEPS, ...deps };

    for (const key of REQUIRED_DEPS) {
      validateDep(key, this.deps[key]);
    }

    this._pipelineOptions = {
      enableRecallSimulation: true,
      random: Math.random,
    };

    this.aiPipeline = new AIPipeline({
      onTyping: this._handleAITyping.bind(this),
      onMessage: this._handleAIMessage.bind(this),
      onSchedule: this._handleAISchedule.bind(this),
      onLog: (msg, data) => console.log(`[ChatEngine] ${msg}`, data),
      onToolStart: this._handleToolStart.bind(this),
      onToolEnd: this._handleToolEnd.bind(this),
      onEditing: this._handleAIEditing.bind(this),
      onRecall: this._handleAIRecall.bind(this),
      onProactiveImage: this._handleProactiveImage.bind(this),
    }, this._pipelineOptions);
  }

  init(personas) {
    this.destroy();
    this.personas = personas;
    this.chats = this._loadChatsWithMigration();
    const { chats: dedupedChats, changed } = dedupeDirectSocialChats(this.chats, this.personas, this.currentUserId);
    if (changed) {
      this.chats = dedupedChats;
      this.deps.storage.set(this.storageKey, this.chats);
    }
    console.log('[ChatEngine] Initialized with', this.chats.length, 'chats');

    this._startPresenceUpdates(personas);
    this._startGreetingChecker();

    this._notify();
    this._hydrateChatsFromIndexedDB();
  }

  async _hydrateChatsFromIndexedDB() {
    try {
      await this.deps.chatStorage.migrateFromLocalStorage(this.storageKeyCandidates);
      const indexedChats = await this.deps.chatStorage.loadChats();
      if (!Array.isArray(indexedChats)) return;

      const normalized = indexedChats
        .map(chat => normalizeChat(chat))
        .filter(Boolean);

      const currentSnapshot = JSON.stringify(this.chats);
      const nextSnapshot = JSON.stringify(normalized);
      if (currentSnapshot !== nextSnapshot) {
        this.chats = normalized;
        this.deps.storage.set(this.storageKey, normalized);
        this._notify();
      }
    } catch (error) {
      console.warn('[ChatEngine] IndexedDB hydration failed (non-fatal):', error?.message || error);
    }
  }

  _loadChatsWithMigration() {
    let selectedKey = null;
    let loadedChats = [];

    for (const key of this.storageKeyCandidates) {
      const value = this.deps.storage.get(key, null);
      if (Array.isArray(value)) {
        selectedKey = key;
        loadedChats = value;
        break;
      }
    }

    const normalized = loadedChats
      .map(chat => normalizeChat(chat))
      .filter(Boolean);

    this.deps.storage.set(this.storageKey, normalized);

    if (selectedKey && selectedKey !== this.storageKey) {
      const migrationMeta = this.deps.storage.get(this.migrationMetaKey, {});
      this.deps.storage.set(this.migrationMetaKey, {
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

  subscribe(callback, options = {}) {
    this.listeners.add(callback);
    if (options.emitCurrent) {
      callback(this.getState());
    }
    return () => this.listeners.delete(callback);
  }

  subscribeSelector(selector, callback) {
    let prev = selector(this.getState());
    const wrapped = (state) => {
      const next = selector(state);
      if (prev !== next) {
        prev = next;
        callback(next);
      }
    };
    this.listeners.add(wrapped);
    callback(prev);
    return () => this.listeners.delete(wrapped);
  }

  getState() {
    return {
      chats: this.chats,
      typingIndicators: { ...this.typingIndicators },
      editingIndicators: Object.fromEntries(
        Object.entries(this.editingIndicators).map(([k, v]) => [k, [...v]])
      ),
      presenceMap: { ...this.presenceMap },
      moodMap: { ...this.moodMap }
    };
  }

  addPersona(persona) {
    if (!persona?.id) return;
    const exists = this.personas.some(p => p.id === persona.id);
    if (!exists) {
      this.personas.push(persona);
    } else {
      const idx = this.personas.findIndex(p => p.id === persona.id);
      this.personas[idx] = persona;
    }
    this._notify();
  }

  removePersona(personaId) {
    this.personas = this.personas.filter(p => p.id !== personaId);
    this._notify();
  }

  registerOnUserMessage(callback) {
    this._onUserMessageCallbacks.push(callback);
    return () => {
      this._onUserMessageCallbacks = this._onUserMessageCallbacks.filter(cb => cb !== callback);
    };
  }

  setContextProvider(fn) {
    this._contextProvider = fn;
  }

  configurePipeline(options = {}) {
    Object.assign(this._pipelineOptions, options);
    this.aiPipeline._enableRecallSimulation = this._pipelineOptions.enableRecallSimulation ?? true;
    this.aiPipeline._random = this._pipelineOptions.random || Math.random;
  }

  _notify() {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }

  save() {
    this._notify();
    clearTimeout(this._saveTimer);
    const write = () => {
      this.deps.storage.set(this.storageKey, this.chats);
      this.deps.chatStorage.saveChats(this.chats);
    };
    if (typeof requestIdleCallback === 'function') {
      this._saveTimer = requestIdleCallback(write, { timeout: 1000 });
    } else {
      this._saveTimer = setTimeout(write, 0);
    }
  }

  saveDebounced(delay = 1000) {
    clearTimeout(this._saveTimer);
    const write = () => {
      this.deps.storage.set(this.storageKey, this.chats);
      this.deps.chatStorage.saveChats(this.chats);
      this._notify();
    };
    this._saveTimer = setTimeout(write, delay);
  }

  // =========================================================================
  // Business Logic: Message Actions
  // =========================================================================

  sendMessage(chatId, content, senderId = 'user-me', quotedMessageId = null) {
    if (!chatId) {
      console.warn('[ChatEngine] Invalid chatId in sendMessage');
      return;
    }
    
    const cleaned = this.deps.cleanMessageContent(content);
    if (!cleaned) return;

    const chatIndex = this.chats.findIndex(c => c.id === chatId);
    if (chatIndex === -1) {
      console.warn(`[ChatEngine] Chat not found: ${chatId}`);
      return;
    }

    const newMessage = {
      id: crypto.randomUUID(),
      senderId,
      content: cleaned,
      timestamp: new Date().toISOString(),
      status: 'sent',
      quotedMessageId,
      readBy: []
    };

    const updatedChat = { ...this.chats[chatIndex] };
    updatedChat.messages = [...(updatedChat.messages || []), newMessage];
    updatedChat.lastMessage = newMessage;
    updatedChat.updatedAt = newMessage.timestamp;

    this.chats[chatIndex] = updatedChat;
    this.save();

    if (senderId === 'user-me' && updatedChat.participants) {
      const aiIds = updatedChat.participants.filter(id => id !== 'user-me');
      this._onUserMessageCallbacks.forEach(cb => cb(chatId, aiIds));

      this._checkAutoNaming(updatedChat);
      this._triggerAIResponse(updatedChat);

      const isGroupChat = updatedChat.participants.length > 2;
      if (isGroupChat && updatedChat.messages && updatedChat.messages.length >= 20 && updatedChat.messages.length % 10 === 0) {
        const aiParticipants = updatedChat.participants
          .filter(id => id !== 'user-me')
          .map(id => this.personas.find(p => p.id === id))
          .filter(Boolean)
          .map(p => ({ id: p.id, name: p.name }));
        const promise = this.deps.extractGroupMemoriesAsync(updatedChat.messages, chatId, aiParticipants);
        if (promise?.catch) promise.catch(err => {
          console.warn('[ChatEngine] Group memory extraction failed:', err);
        });
      }
    }
  }

  deleteMessage(chatId, messageId) {
    const chatIndex = this.chats.findIndex(c => c.id === chatId);
    if (chatIndex === -1) return;

    const chat = this.chats[chatIndex];
    const updatedMessages = chat.messages.filter(m => m.id !== messageId);

    this.chats[chatIndex] = { ...chat, messages: updatedMessages };
    this.save();
  }

  createChat(name, participantIds, avatar = null) {
    const normalizedParticipantIds = [...new Set((participantIds || []).filter(id => id && id !== this.currentUserId))];
    const isDirect = normalizedParticipantIds.length === 1;
    const directPeerId = isDirect ? normalizedParticipantIds[0] : null;

    if (isDirect && !isTaskParticipant(directPeerId, this.personas, this.currentUserId)) {
      const existingDirectChat = this.chats
        .filter(chat => getDirectPeerId(chat, this.currentUserId) === directPeerId)
        .sort((a, b) => new Date(getChatActivityTimestamp(b)) - new Date(getChatActivityTimestamp(a)))[0];

      if (existingDirectChat) {
        const needsUpdate = (!existingDirectChat.avatar && avatar) ||
          (!existingDirectChat.name || existingDirectChat.name === 'New Chat');

        if (needsUpdate) {
          this.updateChat(existingDirectChat.id, {
            avatar: existingDirectChat.avatar || avatar,
            name: existingDirectChat.name && existingDirectChat.name !== 'New Chat'
              ? existingDirectChat.name
              : (name || existingDirectChat.name)
          });
        }
        return existingDirectChat.id;
      }
    }

    const newChat = {
      id: crypto.randomUUID(),
      name,
      avatar,
      participants: [this.currentUserId, ...normalizedParticipantIds],
      admins: ['user-me'],
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme: 'default',
      settings: { muteValues: {} },
      polls: []
    };

    this.chats = [newChat, ...this.chats];
    this.save();
    return newChat.id;
  }

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

    this._clearScheduledMessagesForChat(chatId);
    this.chats = nextChats;
    delete this.typingIndicators[chatId];
    this.save();
  }

  clearChatMessages(chatId) {
    const chatIndex = this.chats.findIndex(c => c.id === chatId);
    if (chatIndex === -1) return;

    this._clearScheduledMessagesForChat(chatId);
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
    if (chatIndex === -1) return { success: false, error: 'Chat not found' };

    const result = votePoll(this.chats[chatIndex], pollId, optionId, action, this.currentUserId);
    if (result.success) {
      this.chats[chatIndex] = result.chat;
      this.save();
    }
    return result;
  }

  // =========================================================================
  // Bookmarks
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

    const result = this.deps.addBookmark({
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
    const result = this.deps.removeBookmark(messageId);
    return { success: result, isBookmarked: false };
  }

  getBookmarkedMessages() {
    return this.deps.getBookmarks();
  }

  isMessageBookmarked(messageId) {
    return this.deps.isBookmarked(messageId);
  }

  // =========================================================================
  // Read Receipts
  // =========================================================================

  markMessagesAsRead(chatId, readerId = 'user-me') {
    const chatIndex = this.chats.findIndex(c => c.id === chatId);
    if (chatIndex === -1) return;

    const chat = this.chats[chatIndex];
    let hasChanges = false;

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
    this._notify();
  }

  _handleProactiveImage(chatId, result) {
    if (!result?.imageUrl) return;

    const senderId = result.personaId || 'ai-system';
    const imageContent = `[IMG:${result.imageUrl}]`;

    const chatIndex = this.chats.findIndex(c => c.id === chatId);
    if (chatIndex === -1) return;

    const newMessage = {
      id: crypto.randomUUID(),
      senderId,
      content: imageContent,
      timestamp: new Date().toISOString(),
      status: 'sent',
      quotedMessageId: null,
      readBy: []
    };

    const updatedChat = { ...this.chats[chatIndex] };
    updatedChat.messages = [...updatedChat.messages, newMessage];
    updatedChat.lastMessage = newMessage;
    updatedChat.updatedAt = newMessage.timestamp;

    this.chats[chatIndex] = updatedChat;
    this.save();
  }

  _handleAIEditing(chatId, aiId, isEditing) {
    if (!this.editingIndicators[chatId]) {
      this.editingIndicators[chatId] = new Set();
    }
    if (isEditing) {
      this.editingIndicators[chatId].add(aiId);
    } else {
      this.editingIndicators[chatId].delete(aiId);
      if (this.editingIndicators[chatId].size === 0) {
        delete this.editingIndicators[chatId];
      }
    }
    this._notify();
  }

  _handleAIRecall(chatId, aiId) {
    const chat = this.chats.find(c => c.id === chatId);
    if (!chat) return;

    const lastMsg = [...chat.messages].reverse().find(m => m.senderId === aiId);
    if (lastMsg && !lastMsg.recalled) {
      lastMsg.recalled = true;
      lastMsg.recalledAt = new Date().toISOString();
      this.save();
    }
  }

  _handleAIMessage(chatId, content, aiId) {
    this.sendMessage(chatId, content, aiId);
  }

  _handleToolStart(chatId, aiId, toolName, args) {
    const chatIndex = this.chats.findIndex(c => c.id === chatId);
    if (chatIndex === -1) return null;

    const msgId = 'tool-evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    const inputSummary = buildToolInputSummary(toolName, args);

    const toolMsg = {
      id: msgId,
      senderId: aiId,
      type: 'tool_event',
      toolName,
      status: 'loading',
      inputSummary,
      outputDetail: null,
      timestamp: new Date().toISOString(),
      content: '',
      readBy: [],
    };

    const updatedChat = { ...this.chats[chatIndex] };
    updatedChat.messages = [...updatedChat.messages, toolMsg];
    this.chats[chatIndex] = updatedChat;
    this._notify();
    return msgId;
  }

  _handleToolEnd(chatId, msgId, result, error) {
    if (!msgId) return;
    const chatIndex = this.chats.findIndex(c => c.id === chatId);
    if (chatIndex === -1) return;

    const chat = this.chats[chatIndex];
    const msgIndex = chat.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const raw = error || (result || '');
    const outputDetail = raw.length > 500 ? raw.slice(0, 497) + '…' : raw;

    const updatedMsg = {
      ...chat.messages[msgIndex],
      status: error ? 'error' : 'success',
      outputDetail,
    };

    const updatedMessages = [...chat.messages];
    updatedMessages[msgIndex] = updatedMsg;
    this.chats[chatIndex] = { ...chat, messages: updatedMessages };
    this.save();
  }

  _handleAISchedule(chatId, ai, minutes) {
        if (!ai?.id) {
            console.warn('[ChatEngine] Invalid AI object in _handleAISchedule');
            return;
        }
        const parsedMinutes = Math.max(1, Math.min(Number(minutes) || 1, 24 * 60));
        const scheduleKey = `${chatId}:${ai.id}`;
        const existing = this._scheduledMessages.get(scheduleKey);
        if (existing) {
            clearTimeout(existing);
        }

        const timeoutId = setTimeout(() => {
            this._scheduledMessages.delete(scheduleKey);
            const chat = this.chats.find(c => c.id === chatId);
            if (chat && chat.messages && chat.messages.length > 0) {
                const lastMsg = chat.messages[chat.messages.length - 1];
                if (!lastMsg?.timestamp) return;
                const timeDiff = Date.now() - new Date(lastMsg.timestamp).getTime();
                if (timeDiff > parsedMinutes * 60 * 1000 * 0.8) {
                    this.aiPipeline.processTurn(chat, this.personas, ai);
                }
            }
        }, parsedMinutes * 60 * 1000);

        this._scheduledMessages.set(scheduleKey, timeoutId);
    }

  _clearScheduledMessagesForChat(chatId) {
    const prefix = `${chatId}:`;
    for (const [key, timeoutId] of this._scheduledMessages.entries()) {
      if (!key.startsWith(prefix)) continue;
      clearTimeout(timeoutId);
      this._scheduledMessages.delete(key);
    }
  }

  _triggerAIResponse(chat) {
    if (!chat?.participants) {
      console.warn('[ChatEngine] Invalid chat object in _triggerAIResponse');
      return;
    }
    
    const candidates = chat.participants
      .filter(id => id !== 'user-me')
      .map(id => this.personas.find(p => p.id === id))
      .filter(Boolean);

    const recentGroupMessages = (this.chats || [])
      .filter(c => c?.id !== chat.id && c?.participants?.length > 2)
      .flatMap(c => (c.messages || []).slice(-5).map(m => ({
        ...m,
        participants: c.participants
      })))
      .sort((a, b) => {
        const aTime = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
        return aTime - bTime;
      })
      .slice(-10);

    candidates.forEach((ai) => {
      if (!ai?.id || !ai?.name) return;
      const isMentioned = chat?.lastMessage?.content?.includes(`@${ai.name}`) || false;
      const isDirect = chat.participants.length === 2;

      if (isDirect || isMentioned || Math.random() > 0.3) {
        const baseContext = this._contextProvider?.(ai.id) || {};
        const context = { ...baseContext, recentGroupMessages };
        this.aiPipeline.processTurn(chat, this.personas, ai, context);
      }
    });
  }

  _checkAutoNaming(chat) {
    if (!chat?.messages || chat.messages.length !== 1) return;
    if (!chat?.participants || chat.participants.length !== 2) return;

    const aiId = chat.participants.find(p => p !== 'user-me');
    if (!aiId) return;
    
    const ai = this.personas.find(p => p.id === aiId);

    if (!ai || ai.agentType !== 'task-specialist') return;

    const firstMessage = chat.messages[0]?.content;
    if (!firstMessage) return;
    
    const namingPrompt = `
Generate a clear chat title (max 6 words) from this first message.
No quotes, no punctuation, title text only.

Message: "${firstMessage}"
Title:`;

    this.deps.callAI([
      { role: 'system', content: 'You generate concise topic titles.' },
      { role: 'user', content: namingPrompt }
    ], {
      maxTokens: 20,
      temperature: 0.3
    }).then(title => {
      if (title) {
        const cleanTitle = title.replace(/["']/g, '').trim();
        this.updateChat(chat.id, { name: cleanTitle });
      }
    }).catch(err => {
      console.error('[ChatEngine] Auto-naming failed:', err);
    });
  }

  // =========================================================================
  // Presence & Greeting
  // =========================================================================

  _startPresenceUpdates(personas) {
    this._updatePresence(personas);
    this._presenceInterval = setInterval(() => {
      this._updatePresence(personas);
    }, 60_000);
  }

  _updatePresence(personas) {
    this.presenceMap = this.deps.getPresenceMap(personas);
    this.moodMap = this.deps.getMoodMap(personas, this.presenceMap);
    this._notify();
  }

  _startGreetingChecker() {
    this._greetingInterval = setInterval(() => {
      this._checkReEngagement();
    }, 30 * 60 * 1000);
  }

  _checkReEngagement() {
    const result = this.deps.checkReEngagement(this.chats, this.personas);
    if (result) {
      this.sendMessage(result.chatId, result.message, result.personaId);
    }
  }

  triggerGreeting(chatId, message, personaId) {
    this.sendMessage(chatId, message, personaId);
  }

  destroy() {
    if (this._presenceInterval) clearInterval(this._presenceInterval);
    if (this._greetingInterval) clearInterval(this._greetingInterval);
    if (this._saveTimer) {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this._saveTimer);
      else clearTimeout(this._saveTimer);
      this._saveTimer = null;
      this.deps.storage.set(this.storageKey, this.chats);
      this.deps.chatStorage.saveChats(this.chats);
    }
    for (const timeoutId of this._scheduledMessages.values()) {
      clearTimeout(timeoutId);
    }
    this._scheduledMessages.clear();
  }
}

export const chatEngine = new ChatEngine();
