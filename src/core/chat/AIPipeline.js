import { calculateTypingDelay, getRandomDelay, compressContext } from '../../features/chat/services/chatService';
import { executeTool } from '../../features/chat/services/toolService';
import { callAI } from '../../features/chat/services/chatService';

/**
 * Domain Layer: AI Pipeline
 * Manages the "Mental Model" of the AI:
 * 1. Context Preparation (Compression, Summary)
 * 2. ReAct Loop (Thinking -> Tool -> Result -> Thinking)
 * 3. Response Generation (Typing delays, Multi-message parsing)
 */
export class AIPipeline {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        // callbacks: { onTyping, onMessage, onLog }
    }

    log(msg, data) {
        if (this.callbacks.onLog) this.callbacks.onLog(msg, data);
        else console.log(msg, data || '');
    }

    /**
     * Main entry point to trigger AI response
     */
    async processTurn(chat, personas, triggerAI, context = null) {
        const ai = personas.find(p => p.id === triggerAI.id);
        if (!ai) return;

        const chatId = chat.id;

        // 1. Calculate Delays
        const readDelay = getRandomDelay(ai.readDelay || { min: 500, max: 2000 });
        const thinkingDelay = getRandomDelay(ai.responseDelay || { min: 1000, max: 2000 });

        await this._wait(readDelay);

        // 2. Start "Typing"
        this.callbacks.onTyping?.(chatId, ai.id, true);

        await this._wait(thinkingDelay);

        try {
            // 3. Prepare Context
            const { compressed, summary, recentMessages } = compressContext(chat.messages, personas);
            const messagesToProcess = compressed ? recentMessages : chat.messages;
            const history = this._prepareHistory(messagesToProcess, personas, compressed, summary, chat.polls);

            // 4. Generate System Prompt (T06: with affinity/mood context)
            const systemPrompt = this._generateSystemPrompt(ai, context);

            // 5. Run ReAct Loop
            await this._runReActLoop(chatId, ai, systemPrompt, history);

        } catch (error) {
            console.error('[AIPipeline] Error:', error);
            this.callbacks.onTyping?.(chatId, ai.id, false);
        }
    }

    async _runReActLoop(chatId, ai, systemPrompt, initialHistory, depth = 0) {
        if (depth > 3) {
            this.log('[AIPipeline] Max depth reached');
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Call LLM
        const requestMessages = [{ role: 'system', content: systemPrompt }, ...initialHistory];
        const response = await callAI(requestMessages, {
            systemPrompt: ai.systemPrompt,
            agentId: ai.id,
            maxTokens: depth > 0 ? 500 : undefined
        });

        if (!response) {
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Check for Tool Calls
        const toolMatch = response.match(/\[TOOL_CALL:\s*(\w+)\s*(\{.*?\})\s*\]/);

        if (toolMatch) {
            // --- Tool Execution Path ---
            const [, toolName, argsStr] = toolMatch;
            this.log(`[Tool Call] ${toolName}`, argsStr);

            try {
                const args = JSON.parse(argsStr);
                const toolOutput = await executeTool(toolName, args);

                // Recursive Call
                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_RESULT for ${toolName}]\n${toolOutput}\n\n[Please continue based on this result]` }
                ];

                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1);

            } catch (e) {
                this.log('[Tool Error]', e);
                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_ERROR]: ${e.message}` }
                ];
                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1);
            }

        } else {
            // --- Final Response Path ---
            await this._handleFinalResponse(chatId, ai, response);
        }
    }

    async _handleFinalResponse(chatId, ai, response) {
        if (!response) {
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        if (response.includes('[SILENCE]')) {
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Parse SCHEDULE
        const scheduleMatch = response.match(/\[SCHEDULE:(\d+)\]/);
        let cleanResponse = response;
        if (scheduleMatch) {
            const minutes = parseInt(scheduleMatch[1]);
            cleanResponse = response.replace(scheduleMatch[0], '').trim();
            this.callbacks.onSchedule?.(chatId, ai, minutes);
        }

        // Parse MULTI
        const multiMatch = cleanResponse.match(/\[(?:MULTI|Multi|multi):(.+?)\]/i);

        if (multiMatch) {
            const parts = multiMatch[1].split('|').map(m => m.trim()).filter(Boolean);
            cleanResponse = cleanResponse.replace(multiMatch[0], '').trim();

            // Send parts sequentially
            for (let i = 0; i < parts.length; i++) {
                if (i > 0) {
                    this.callbacks.onTyping?.(chatId, ai.id, true);
                    await this._wait(800 + Math.random() * 1000);
                }
                await this._simulateTypingAndSend(chatId, ai, parts[i]);
            }

            // Send remainder if any
            if (cleanResponse) {
                this.callbacks.onTyping?.(chatId, ai.id, true);
                await this._wait(1000);
                await this._simulateTypingAndSend(chatId, ai, cleanResponse);
            }
        } else {
            // Standard single message
            await this._simulateTypingAndSend(chatId, ai, cleanResponse);
        }

        // Done
        this.callbacks.onTyping?.(chatId, ai.id, false);
    }

    async _simulateTypingAndSend(chatId, ai, content) {
        const delay = calculateTypingDelay(content.length, ai.typingSpeed || 'normal');
        await this._wait(delay);
        this.callbacks.onMessage?.(chatId, content, ai.id);
    }

    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- Helpers Copied/Refactored from Context ---
    // In a future step, these could be extracted to a pure utility class

    _prepareHistory(messages, personas, compressed, summary, polls) {
        const rawHistory = messages.slice(-12).map(m => {
            const isUser = m.senderId === 'user-me';
            const sender = isUser ? 'User' : personas.find(p => p.id === m.senderId)?.name || 'Unknown';

            let content = m.content;
            if (content.startsWith('[POLL:') && polls) {
                const pollMatch = content.match(/\[POLL:(.+?)\]/);
                if (pollMatch) {
                    const poll = polls.find(p => p.id === pollMatch[1]);
                    if (poll) {
                        content = `[System: Poll created: "${poll.question}". Options: ${poll.options.map((o, i) => `${i + 1}. ${o.text}`).join(', ')}. Please vote.]`;
                    }
                }
            }

            return {
                role: isUser ? 'user' : 'assistant',
                content: `${sender}: ${content}`
            };
        });

        // Merge consecutive roles
        const history = [];
        for (const msg of rawHistory) {
            if (history.length > 0 && history[history.length - 1].role === msg.role) {
                history[history.length - 1].content += '\n' + msg.content;
            } else {
                history.push({ ...msg });
            }
        }

        if (history.length > 0 && history[0].role === 'assistant') {
            history.unshift({ role: 'user', content: compressed ? summary : '[Previous chat context]' });
        }

        return history;
    }

    _generateSystemPrompt(ai, context = null) {
        // Reuse existing prompt generation logic
        // For brevity in this refactor, condensing it.
        // Ideally imported from a PromptBuilder domain service.
        const base = `You are ${ai.name}.\nPersonality: ${ai.personality}\nStyle: ${ai.style}`;
        const tools = `
AVAILABLE TOOLS:
1. SEND MESSAGE - Normal response
2. STAY SILENT - [SILENCE]
3. MULTI MESSAGE - [MULTI:msg1|msg2]
4. SCHEDULE - [SCHEDULE:mins]
${ai.agentType === 'task-specialist' ? this._getSpecialistTools(ai) : ''}
`;
        // T06: Affinity-aware tone instructions
        let affinityHint = '';
        if (context?.intimacyLevel) {
            const level = context.intimacyLevel;
            if (level >= 5) {
                affinityHint = '\nRELATIONSHIP: You are soulmates with the user. Be very intimate, use affectionate language, share deep thoughts, give long detailed responses.';
            } else if (level >= 4) {
                affinityHint = '\nRELATIONSHIP: You are close friends with the user. Be intimate, use nicknames occasionally, share deeper thoughts.';
            } else if (level >= 3) {
                affinityHint = '\nRELATIONSHIP: You are good friends with the user. Be warm, share personal anecdotes, use casual language.';
            } else if (level >= 2) {
                affinityHint = '\nRELATIONSHIP: You are friends with the user. Be friendly and conversational.';
            } else {
                affinityHint = '\nRELATIONSHIP: You are acquaintances with the user. Keep responses brief and polite. Use a somewhat formal tone.';
            }
        }

        // T06: Mood-aware behavior hint
        let moodHint = '';
        if (context?.mood?.promptHint) {
            moodHint = `\nCURRENT MOOD: ${context.mood.promptHint}`;
        }

        return `${base}\n${tools}${affinityHint}${moodHint}\nRULES: Keep it short. Respond to mentions.`;
    }

    _getSpecialistTools(ai) {
        return (ai.tools || []).map(t => `- [TOOL_CALL: ${t.name} ...arguments]`).join('\n');
    }
}
