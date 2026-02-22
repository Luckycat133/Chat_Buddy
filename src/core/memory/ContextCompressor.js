/**
 * Domain Layer: Context Compressor
 * Extracted from chatService.js and extended with async memory extraction.
 *
 * Responsibilities:
 * 1. Compress long conversation history into a summary (unchanged behaviour).
 * 2. When compression is triggered, fire an async LLM call to extract key facts
 *    about the user from the compressed messages → save to MemoryStore.
 */

import { callAI } from '../../features/chat/services/chatService';
import { memoryStore } from './MemoryStore';

// Trigger compression when message count exceeds this threshold
const COMPRESSION_THRESHOLD = 15;
// Keep this many recent messages uncompressed for immediate context
const RECENT_WINDOW = 8;

// Rate-limit: at most one extraction call per character per hour
const EXTRACTION_RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const _lastExtractionTime = new Map(); // characterId → timestamp

/**
 * Compress context for token optimization.
 * Mirrors the original compressContext() function from chatService.js.
 *
 * @param {Array} messages - Full chat message array
 * @param {Array} personas - All persona definitions
 * @returns {{ compressed: boolean, summary?: string, recentMessages?: Array }}
 */
export function compressContext(messages, personas) {
    if (messages.length <= COMPRESSION_THRESHOLD) {
        return { compressed: false, messages };
    }

    const oldMessages = messages.slice(0, -RECENT_WINDOW);
    const recentMessages = messages.slice(-RECENT_WINDOW);

    const participants = new Set();
    const topics = [];

    oldMessages.forEach((msg) => {
        if (msg.senderId !== 'user-me') {
            const persona = personas.find((p) => p.id === msg.senderId);
            if (persona) participants.add(persona.name);
        }
        const words = msg.content.toLowerCase().split(/\s+/);
        words.forEach((word) => {
            if (
                word.length > 5 &&
                !['about', 'would', 'could', 'should', 'their', 'there', 'these', 'those'].includes(word)
            ) {
                if (!topics.includes(word) && topics.length < 5) {
                    topics.push(word);
                }
            }
        });
    });

    const summary = `[Earlier conversation summary: ${oldMessages.length} messages between ${Array.from(participants).join(', ') || 'participants'
        }. Topics discussed: ${topics.join(', ') || 'general chat'}]`;

    return { compressed: true, summary, recentMessages };
}

/**
 * Async memory extraction — called as a fire-and-forget side-effect when
 * context is compressed. Sends old messages to LLM and asks it to extract
 * key facts/preferences about the user. Saves results to MemoryStore.
 *
 * This function never throws or blocks the main chat pipeline.
 *
 * @param {Array} oldMessages - The messages being compressed away
 * @param {string} characterId - The character whose perspective we extract from
 * @param {string} characterName - Character display name (for the prompt)
 */
export async function extractMemoriesAsync(oldMessages, characterId, characterName) {
    try {
        if (!oldMessages || oldMessages.length < 3) return;

        // Rate-limit: skip if we extracted for this character recently
        const now = Date.now();
        const lastExtraction = _lastExtractionTime.get(characterId) || 0;
        if (now - lastExtraction < EXTRACTION_RATE_LIMIT_MS) {
            console.log(`[ContextCompressor] Skipping extraction for ${characterName} — rate limit (${Math.round((EXTRACTION_RATE_LIMIT_MS - (now - lastExtraction)) / 60000)}min remaining)`);
            return;
        }
        // Mark extraction time immediately to prevent parallel calls
        _lastExtractionTime.set(characterId, now);

        // Build a minimal text transcript for the LLM to analyse
        const transcript = oldMessages
            .map((m) => {
                const who = m.senderId === 'user-me' ? 'User' : characterName;
                return `${who}: ${m.content}`;
            })
            .join('\n');

        const prompt = [
            {
                role: 'system',
                content:
                    'You are a memory extraction assistant. Given a chat transcript, extract key facts about the "User" — preferences, life events, opinions, and personal details. Return ONLY a valid JSON array (no markdown, no explanation). Each item: { "fact": string, "importance": number (1-10), "category": "preference"|"fact"|"event" }. Limit to at most 8 items. If nothing notable, return [].',
            },
            {
                role: 'user',
                content: `Here is the transcript:\n\n${transcript}\n\nExtract key facts about the User.`,
            },
        ];

        const raw = await callAI(prompt, {
            agentId: `memory-extractor-${characterId}`,
            maxTokens: 500,
            temperature: 0.2, // Low temperature for factual extraction
        });

        if (!raw) return;

        // Safely parse JSON — LLMs sometimes wrap in markdown fences
        let items = [];
        try {
            const cleaned = raw.replace(/```json|```/gi, '').trim();
            items = JSON.parse(cleaned);
        } catch {
            // Try extracting JSON array if embedded in explanation text
            const match = raw.match(/\[[\s\S]*\]/);
            if (match) items = JSON.parse(match[0]);
        }

        if (!Array.isArray(items)) return;

        // Save each valid fact to the memory store
        for (const item of items) {
            if (typeof item.fact === 'string' && item.fact.trim()) {
                await memoryStore.saveFact(
                    characterId,
                    item.fact,
                    item.importance ?? 5,
                    item.category ?? 'fact'
                );
            }
        }

        console.log(`[ContextCompressor] Extracted ${items.length} memories for ${characterName}`);
    } catch (err) {
        // Silent failure — memory extraction must never break chat
        console.warn('[ContextCompressor] extractMemoriesAsync failed silently:', err);
    }
}

/**
 * Extract memories from group chat messages for all AI participants.
 * Fires once per group chat per AI character per hour.
 * Only processes group chats (more than 2 participants).
 *
 * @param {Array} messages - Group chat message array
 * @param {string} chatId - Group chat ID (for rate-limit keying)
 * @param {Array} aiParticipants - Array of { id, name } for each AI in the group
 */
export async function extractGroupMemoriesAsync(messages, chatId, aiParticipants) {
    if (!messages || messages.length < 5 || !aiParticipants || aiParticipants.length === 0) return;

    // Only process a window of recent-enough messages to avoid noise
    const relevantMessages = messages.slice(-30);

    for (const ai of aiParticipants) {
        const rateKey = `${ai.id}:group:${chatId}`;
        const now = Date.now();
        const lastExtraction = _lastExtractionTime.get(rateKey) || 0;

        if (now - lastExtraction < EXTRACTION_RATE_LIMIT_MS) continue; // rate-limited
        _lastExtractionTime.set(rateKey, now);

        // Build transcript from the AI's perspective (it only sees what happened in the group)
        const transcript = relevantMessages
            .map((m) => {
                const who = m.senderId === 'user-me' ? 'User' : (aiParticipants.find(p => p.id === m.senderId)?.name || 'Someone');
                return `${who}: ${m.content}`;
            })
            .join('\n');

        const prompt = [
            {
                role: 'system',
                content:
                    `You are a memory extraction assistant reviewing a GROUP CHAT transcript. ` +
                    `Extract key facts about the "User" that ${ai.name} would have observed — preferences, life events, opinions, interests. ` +
                    `Return ONLY a valid JSON array. Each item: { "fact": string, "importance": number (1-10), "category": "preference"|"fact"|"event" }. ` +
                    `Limit to at most 5 items. If nothing notable about the User, return [].`,
            },
            {
                role: 'user',
                content: `Group chat transcript:\n\n${transcript}\n\nExtract facts about the User that ${ai.name} learned.`,
            },
        ];

        // Fire-and-forget for each participant
        callAI(prompt, {
            agentId: `group-memory-extractor-${ai.id}`,
            maxTokens: 400,
            temperature: 0.2,
        }).then(async (raw) => {
            if (!raw) return;
            let items = [];
            try {
                const cleaned = raw.replace(/```json|```/gi, '').trim();
                items = JSON.parse(cleaned);
            } catch {
                const match = raw.match(/\[[\s\S]*\]/);
                if (match) items = JSON.parse(match[0]);
            }
            if (!Array.isArray(items)) return;
            for (const item of items) {
                if (typeof item.fact === 'string' && item.fact.trim()) {
                    await memoryStore.saveFact(ai.id, item.fact, item.importance ?? 5, item.category ?? 'fact');
                }
            }
            if (items.length > 0) {
                console.log(`[ContextCompressor] Group memories: ${items.length} facts for ${ai.name} from group chat ${chatId}`);
            }
        }).catch(() => { }); // Silent failure
    }
}

