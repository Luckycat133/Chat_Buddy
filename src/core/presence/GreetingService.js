/**
 * GreetingService — T05 AI Humanization
 *
 * Manages proactive greeting logic with frequency control.
 *
 * Trigger scenarios:
 *   1. Window-open greeting  — user opens a chat whose last message is > 6h old
 *   2. Re-engagement         — no messages globally for > 12h, system picks ONE persona
 *
 * Greeting content is template-based (no LLM call) for zero performance overhead.
 * Cooldown state is persisted to localStorage.
 */

import { getStatus } from './PresenceService';
import { storage } from '../../services/storage/StorageService';

// ─── Constants ──────────────────────────────────────────────────────
const COOLDOWN_KEY = 'chat-buddy-greeting-cooldowns';
const PER_PERSONA_COOLDOWN_MS = 12 * 60 * 60 * 1000;  // 12 hours
const GLOBAL_COOLDOWN_MS = 4 * 60 * 60 * 1000;         // 4 hours
const WINDOW_OPEN_THRESHOLD_MS = 6 * 60 * 60 * 1000;   // 6 hours since last msg
const RE_ENGAGEMENT_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours global silence

// ─── Greeting Templates ─────────────────────────────────────────────
// Keyed by time-of-day slot, with per-language arrays.
// Each character can overlay their own "voice" via the persona style later.
const GREETING_TEMPLATES = {
    morning: {
        zh: [
            '早安！新的一天开始啦 ☀️',
            '早上好呀～今天有什么计划吗？',
            '起得真早！元气满满的一天 🌅',
        ],
        en: [
            'Good morning! ☀️',
            'Morning~ Any plans for today?',
            'Rise and shine! 🌅',
        ],
    },
    afternoon: {
        zh: [
            '下午好～有没有好好休息一下？',
            '午后时光～来聊聊天吧 ☕',
        ],
        en: [
            'Good afternoon~ Taking a break?',
            'Afternoon vibes ☕ Wanna chat?',
        ],
    },
    evening: {
        zh: [
            '晚上好！今天过得怎么样？',
            '忙了一天辛苦啦～',
        ],
        en: [
            'Good evening! How was your day?',
            'Long day? Let\'s unwind~',
        ],
    },
    lateNight: {
        zh: [
            '这么晚了还没睡呀？注意休息哦 🌙',
            '夜深了～有什么心事吗？',
        ],
        en: [
            'Still up? Take care of yourself 🌙',
            'Late night thoughts? I\'m here~',
        ],
    },
    reEngagement: {
        zh: [
            '好久不见！最近怎么样？',
            '想你啦～回来聊聊天吧 💬',
            '嘿！好久没聊了，一切都好吗？',
        ],
        en: [
            'Long time no see! How\'ve you been?',
            'Missed you~ Come chat! \uD83D\uDCAC',
            'Hey! It\'s been a while, everything ok?',
        ],
    },
};

// ─── Helpers ────────────────────────────────────────────────────────

function getTimeSlot() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 18) return 'afternoon';
    if (h >= 18 && h < 22) return 'evening';
    return 'lateNight';
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function loadCooldowns() {
    return storage.get(COOLDOWN_KEY, { perPersona: {}, globalLast: 0 });
}

function saveCooldowns(cd) {
    storage.set(COOLDOWN_KEY, cd);
}

function isOnCooldown(cooldowns, personaId, now) {
    // Global cooldown
    if (now - cooldowns.globalLast < GLOBAL_COOLDOWN_MS) return true;
    // Per-persona cooldown
    const last = cooldowns.perPersona[personaId] || 0;
    return now - last < PER_PERSONA_COOLDOWN_MS;
}

function markGreetingSent(cooldowns, personaId, now) {
    cooldowns.globalLast = now;
    cooldowns.perPersona[personaId] = now;
    saveCooldowns(cooldowns);
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Check if a window-open greeting should fire for a specific chat.
 * Call this when the user navigates into a chat window.
 *
 * @param {Object} chat - The chat object
 * @param {Object} persona - The other participant's persona
 * @param {string} language - 'zh' or 'en'
 * @returns {{ personaId: string, message: string } | null}
 */
export function checkWindowOpenGreeting(chat, persona, language = 'zh') {
    if (!chat || !persona) return null;

    // Only for DM chats
    if (chat.participants?.length !== 2) return null;

    // Check time since last message
    const lastMsg = chat.messages?.[chat.messages.length - 1];
    if (!lastMsg) return null;

    const timeSince = Date.now() - new Date(lastMsg.timestamp).getTime();
    if (timeSince < WINDOW_OPEN_THRESHOLD_MS) return null;

    // Check persona is online
    if (getStatus(persona) === 'offline') return null;

    // Check cooldown
    const cooldowns = loadCooldowns();
    if (isOnCooldown(cooldowns, persona.id, Date.now())) return null;

    // Generate greeting
    const slot = getTimeSlot();
    const lang = language === 'zh' ? 'zh' : 'en';
    const templates = GREETING_TEMPLATES[slot]?.[lang] || GREETING_TEMPLATES.morning[lang];
    const message = pickRandom(templates);

    console.log(`[GreetingService] Window-open greeting triggered for ${persona.id}: "${message}"`);

    // Record cooldown
    markGreetingSent(cooldowns, persona.id, Date.now());

    return { personaId: persona.id, message };
}

/**
 * Check if a re-engagement greeting should fire.
 * Call this periodically (e.g., every 30 minutes).
 *
 * Algorithm:
 *   1. Find all chats with lastMessage > RE_ENGAGEMENT_THRESHOLD
 *   2. Filter candidates: social-companion, online, not on cooldown
 *   3. Sort by "least recently interacted" (psychology: 想念效应)
 *   4. Pick the top candidate
 *
 * @param {Array} chats
 * @param {Array} personas
 * @param {string} language
 * @returns {{ chatId: string, personaId: string, message: string } | null}
 */
export function checkReEngagement(chats, personas, language = 'zh') {
    const now = Date.now();
    const cooldowns = loadCooldowns();

    // Global cooldown check first
    if (now - cooldowns.globalLast < GLOBAL_COOLDOWN_MS) return null;

    // Build candidate list from DM chats
    const candidates = [];

    for (const chat of chats) {
        if (chat.participants?.length !== 2) continue;

        const aiId = chat.participants.find(p => p !== 'user-me');
        if (!aiId) continue;

        const persona = personas.find(p => p.id === aiId);
        if (!persona || persona.agentType !== 'social-companion') continue;

        // Must be online right now
        if (getStatus(persona) !== 'online') continue;

        // Must not be on cooldown
        if (isOnCooldown(cooldowns, persona.id, now)) continue;

        // Check last message time
        const lastMsg = chat.messages?.[chat.messages.length - 1];
        if (!lastMsg) continue;

        const timeSince = now - new Date(lastMsg.timestamp).getTime();
        if (timeSince < RE_ENGAGEMENT_THRESHOLD_MS) continue;

        candidates.push({
            chatId: chat.id,
            personaId: persona.id,
            timeSince,
        });
    }

    if (candidates.length === 0) return null;

    // Sort by longest silence first (想念效应)
    candidates.sort((a, b) => b.timeSince - a.timeSince);

    const winner = candidates[0];
    const lang = language === 'zh' ? 'zh' : 'en';
    const templates = GREETING_TEMPLATES.reEngagement[lang];
    const message = pickRandom(templates);

    // Record cooldown
    markGreetingSent(cooldowns, winner.personaId, now);

    return {
        chatId: winner.chatId,
        personaId: winner.personaId,
        message,
    };
}
