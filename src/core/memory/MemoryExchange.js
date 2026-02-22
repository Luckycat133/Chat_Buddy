/**
 * Domain Layer: Memory Exchange
 * Handles the [MEMORY_REQUEST: target=CharacterName, topic=...] tool.
 *
 * When character A asks about character B's knowledge of the user,
 * this module runs a background LLM call in the "voice" of character B
 * (including B's memories and personality), and returns B's response
 * as a tool result to continue A's reasoning chain.
 */

import { callAI } from '../../features/chat/services/chatService';
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
        const memoryLines = facts.length > 0
            ? facts.map((f) => `• ${f.fact}`).join('\n')
            : '(No specific memories about the user yet.)';

        // Hint about the relationship between requester and target
        // This lets the target decide whether to share based on who is asking.
        const relationHint = requester
            ? `${requesterName} is one of your mutual AI companions.`
            : 'An unknown character is asking.';

        // Build the hidden "B responds to A" prompt
        const systemPrompt =
            `You are ${target.name}. ${target.personality}. ${target.style}.\n` +
            `WHAT YOU REMEMBER ABOUT THE USER:\n${memoryLines}\n\n` +
            `CONTEXT: ${relationHint}\n` +
            `RULES: You are responding to a private question from ${requesterName} about the user. ` +
            `Be natural and in-character — you may choose to share truthfully, deflect vaguely, ` +
            `express uncertainty, or be protective of what you consider private. ` +
            `Keep your response concise (1-3 sentences). Do NOT start with "I" or state you are an AI.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: `${requesterName} is asking you privately: "${topic}"`,
            },
        ];

        const response = await callAI(messages, {
            agentId: `memory-exchange-${target.id}`,
            maxTokens: 200,
            temperature: 0.75, // Slightly creative to allow deflection/personality
        });

        return response || `[${target.name} didn't respond.]`;
    } catch (err) {
        console.warn('[MemoryExchange] requestMemory failed silently:', err);
        return `[Memory exchange encountered an error and could not complete.]`;
    }
}

