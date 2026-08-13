/**
 * Domain Layer: Memory Injector
 * Responsible for retrieving relevant long-term memories from MemoryStore
 * and group chat context, then assembling them as supplemental system-prompt
 * content for the AIPipeline.
 */

import { memoryStore } from './MemoryStore';

// Max facts to inject per turn to stay within token budget
const MAX_FACTS_TO_INJECT = 8;
const MAX_FACT_CHARS = 180;

function truncateFact(fact) {
    const chars = Array.from(String(fact || '').trim());
    if (chars.length <= MAX_FACT_CHARS) return chars.join('');
    return `${chars.slice(0, MAX_FACT_CHARS - 1).join('')}…`;
}

/**
 * Build the memory block to append to a character's system prompt.
 * Returns an empty string if there are no memories to inject.
 *
 * @param {string} characterId
 * @returns {Promise<string>} Formatted memory context block
 */
function normalizeForComparison(value) {
    return String(value || '')
        .toLocaleLowerCase()
        .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function alreadyPresentInRecentContext(fact, recentUserText) {
    const recent = normalizeForComparison(recentUserText);
    if (!recent) return false;

    const normalizedFact = normalizeForComparison(fact)
        .replace(/^用户曾说/u, '');
    if (!normalizedFact) return false;

    return normalizedFact.includes(recent) || recent.includes(normalizedFact);
}

export async function buildMemoryBlock(characterId, options = {}) {
    try {
        const facts = await memoryStore.getRelevantFacts(characterId, MAX_FACTS_TO_INJECT);
        if (!facts || facts.length === 0) return '';

        const lines = facts
            .filter((fact) => !alreadyPresentInRecentContext(fact.fact, options.recentUserText))
            .map((f) => `• ${truncateFact(f.fact)}`)
            .join('\n');
        if (!lines) return '';
        return `\nWHAT YOU REMEMBER ABOUT THE USER:\n${lines}\n`;
    } catch (err) {
        console.warn('[MemoryInjector] buildMemoryBlock failed silently:', err);
        return '';
    }
}

/**
 * Build a group-chat context block from a list of recent group-chat messages.
 * Call this with the last ~10 messages from any group chats the character participated in.
 *
 * @param {Array} groupMessages - Recent messages from group chats
 * @param {string} characterId - The character we are building the prompt for
 * @param {Array} personas - All persona definitions (for name resolution)
 * @returns {string} Formatted group context block
 */
export function buildGroupContextBlock(groupMessages, characterId, personas) {
    try {
        if (!groupMessages || groupMessages.length === 0) return '';

        // Only include messages from groups where this character participated
        const relevant = groupMessages.filter(
            (m) => m.participants && m.participants.includes(characterId)
        );
        if (relevant.length === 0) return '';

        const lines = relevant
            .slice(-8) // last 8 group messages max
            .map((m) => {
                const who =
                    m.senderId === 'user-me'
                        ? 'User'
                        : personas.find((p) => p.id === m.senderId)?.name || 'Someone';
                return `${who}: ${m.content}`;
            })
            .join('\n');

        return `\nRECENT GROUP CHAT YOU WERE PART OF:\n${lines}\n`;
    } catch (err) {
        console.warn('[MemoryInjector] buildGroupContextBlock failed silently:', err);
        return '';
    }
}
