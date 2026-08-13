/**
 * Domain Layer: Memory Exchange
 * Handles the [MEMORY_REQUEST: target=CharacterName, topic=...] tool.
 *
 * When character A asks about character B's knowledge of the user, this module
 * reads the local memory store directly. It does not spend a hidden LLM call.
 */

import { memoryStore } from './MemoryStore';

/**
 * Process a MEMORY_REQUEST tool call.
 * @param {string} requesterId - Persona ID of the asking character (real AI id now)
 * @param {string} targetName - Name of the character being asked (display name)
 * @param {string} topic - What the requester wants to know
 * @param {Array} personas - All loaded persona definitions
 * @returns {Promise<string>} A plain-text response from the target character
 */
export async function requestMemory(requesterId, targetName, topic, personas) {
    try {
        // Resolve both requester and target persona
        const requester = personas.find((p) => p.id === requesterId);
        const target = personas.find(
            (p) => p.name.toLowerCase() === targetName.toLowerCase()
        );
        const requesterName = requester?.name || 'Another character';

        if (!target) {
            return `[Memory exchange failed: Character "${targetName}" was not found or is unavailable.]`;
        }

        if (target.id === requesterId) {
            return `[Memory exchange ignored: Cannot request memory from yourself.]`;
        }

        // Load target character's long-term memories about the user
        const facts = await memoryStore.getRelevantFacts(target.id, 8);
        if (facts.length === 0) {
            return `[${target.name} has no saved user memories relevant to "${topic}" yet.]`;
        }

        const memoryLines = facts
            .slice(0, 6)
            .map((fact) => `• ${String(fact.fact).slice(0, 160)}`)
            .join('\n');
        return `[Local memories shared by ${target.name} with ${requesterName}]\n${memoryLines}`;
    } catch (err) {
        console.warn('[MemoryExchange] requestMemory failed silently:', err);
        return `[Memory exchange encountered an error and could not complete.]`;
    }
}
