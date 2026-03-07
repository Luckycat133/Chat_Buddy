import { calculateTypingDelay, getRandomDelay } from '../../features/chat/services/chatService';
import { callAI } from '../../features/chat/services/chatService';
import { executeTool } from '../../features/chat/services/toolService';
import { compressContext, extractMemoriesAsync } from '../memory/ContextCompressor';
import { buildMemoryBlock, buildGroupContextBlock } from '../memory/MemoryInjector';

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

        // Cache personas reference for MEMORY_REQUEST tool access
        this._personas = personas;

        const chatId = chat.id;

        // 1. Calculate Delays
        const readDelay = getRandomDelay(ai.readDelay || { min: 500, max: 2000 });
        const thinkingDelay = getRandomDelay(ai.responseDelay || { min: 1000, max: 2000 });

        await this._wait(readDelay);

        // Phase 3: Check if this will be a long response (editing state)
        const totalContextLength = chat.messages?.reduce((sum, m) => sum + (m.content?.length || 0), 0) || 0;
        const willBeLong = totalContextLength > 500;

        // 2. Start "Typing" or "Editing"
        if (willBeLong) {
            this.callbacks.onEditing?.(chatId, ai.id, true);
            await this._wait(1500); // Show editing state briefly
            this.callbacks.onEditing?.(chatId, ai.id, false);
        }
        this.callbacks.onTyping?.(chatId, ai.id, true);

        await this._wait(thinkingDelay);

        try {
            // 3. Prepare Context (T12: uses extracted ContextCompressor)
            const { compressed, summary, recentMessages } = compressContext(chat.messages, personas);
            const messagesToProcess = compressed ? recentMessages : chat.messages;
            const history = this._prepareHistory(messagesToProcess, personas, compressed, summary, chat.polls);
            const latestUserLanguage = this._detectLatestUserLanguage(chat.messages);

            // T12: Fire-and-forget memory extraction when context is compressed
            if (compressed) {
                const oldMessages = chat.messages.slice(0, -8);
                extractMemoriesAsync(oldMessages, ai.id, ai.name).catch(() => { });
            }

            // 4. Generate System Prompt (T06: affinity/mood, T12: long-term memory injection)
            const memoryBlock = await buildMemoryBlock(ai.id);

            // T12: Group chat context injection
            const groupMessages = context?.recentGroupMessages || [];
            const groupBlock = buildGroupContextBlock(groupMessages, ai.id, personas);

            const systemPrompt = this._generateSystemPrompt(
                ai,
                { ...(context || {}), latestUserLanguage },
                memoryBlock,
                groupBlock
            );

            // 5. Run ReAct Loop
            await this._runReActLoop(chatId, ai, systemPrompt, history, 0, this._personas || []);

        } catch (error) {
            console.error('[AIPipeline] Error:', error);
            this.callbacks.onTyping?.(chatId, ai.id, false);
        }
    }

    async _runReActLoop(chatId, ai, systemPrompt, initialHistory, depth = 0, personas = []) {
        if (depth > 3) {
            this.log('[AIPipeline] Max depth reached');
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Call LLM
        const requestMessages = [{ role: 'system', content: systemPrompt }, ...initialHistory];
        const response = await callAI(requestMessages, {
            agentId: ai.id,
            maxTokens: depth > 0 ? 500 : undefined
        });

        if (!response) {
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Check for Tool Calls — standard [TOOL_CALL: name {...}] or T12 [MEMORY_REQUEST: target=X, topic=Y]
        const toolMatch = response.match(/\[TOOL_CALL:\s*(\w+)\s*(\{.*?\})\s*\]/);
        const memReqMatch = !toolMatch && response.match(/\[MEMORY_REQUEST:\s*target=([^,\]]+),\s*topic=([^\]]+)\]/);

        if (toolMatch) {
            // --- Standard Tool Execution Path ---
            const [, toolName, argsStr] = toolMatch;
            this.log(`[Tool Call] ${toolName}`, argsStr);

            // T13: Emit tool start event so UI can show loading card
            let toolMsgId = null;
            try {
                const args = JSON.parse(argsStr);

                toolMsgId = this.callbacks.onToolStart?.(chatId, ai.id, toolName, args) ?? null;

                const toolOutput = await executeTool(toolName, args, { personas, requesterId: ai.id, delegationDepth: depth });

                // T13: Emit tool end (success)
                this.callbacks.onToolEnd?.(chatId, toolMsgId, toolOutput, null);

                // Recursive Call
                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_RESULT for ${toolName}]\n${toolOutput}\n\n[Please continue based on this result]` }
                ];

                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1, personas);

            } catch (e) {
                this.log('[Tool Error]', e);
                // T13: Emit tool end (error)
                this.callbacks.onToolEnd?.(chatId, toolMsgId, null, e.message);

                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_ERROR]: ${e.message}` }
                ];
                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1, personas);
            }

        } else if (memReqMatch) {
            // --- T12: MEMORY_REQUEST Tool Path ---
            const targetName = memReqMatch[1].trim();
            const topic = memReqMatch[2].trim();
            this.log(`[Memory Request] ${ai.name} → ${targetName} about "${topic}"`);

            try {
                const toolOutput = await executeTool('MEMORY_REQUEST', { target: targetName, topic }, { personas, requesterId: ai.id });
                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_RESULT for MEMORY_REQUEST from ${targetName}]\n${toolOutput}\n\n[Please continue based on this result]` }
                ];
                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1, personas);
            } catch (e) {
                this.log('[Memory Request Error]', e);
                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_ERROR]: Memory exchange failed — ${e.message}` }
                ];
                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1, personas);
            }

        } else {
            // --- Final Response Path ---
            await this._handleFinalResponse(chatId, ai, response, initialHistory);
        }
    }

    async _handleFinalResponse(chatId, ai, response, _history = []) {
        if (!response) {
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        if (response.includes('[SILENCE]')) {
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Phase 3: Simulate message recall (5% probability)
        const shouldSimulateRecall = Math.random() < 0.05;

        if (shouldSimulateRecall && !response.includes('[SILENCE]')) {
            // Send initial message
            await this._simulateTypingAndSend(chatId, ai, response);

            // Wait 2-5 seconds
            await this._wait(2000 + Math.random() * 3000);

            // Recall the last message
            this.callbacks.onRecall?.(chatId, ai.id);

            // Wait then send revised version
            await this._wait(1500);
            const revisedPrompt = `You just sent this message but decided to revise it:
${response}

Please send a revised/improved version. Be natural and conversational.`;

            const revisedResponse = await callAI([
                { role: 'system', content: `You are ${ai.name}. ${ai.personality}` },
                { role: 'user', content: revisedPrompt }
            ], {
                agentId: ai.id,
                maxTokens: 500,
                temperature: 0.7
            });

            if (revisedResponse && !revisedResponse.includes('[SILENCE]')) {
                await this._simulateTypingAndSend(chatId, ai, revisedResponse);
            }

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
        const personaNameMap = new Map(personas.map(p => [p.id, p.name]));
        const rawHistory = messages.slice(-12).map(m => {
            const isUser = m.senderId === 'user-me';
            const sender = isUser ? 'User' : (personaNameMap.get(m.senderId) || 'Unknown');

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

    _generateSystemPrompt(ai, context = null, memoryBlock = '', groupBlock = '') {
        const base = `You are ${ai.name}.\nPersonality: ${ai.personality}\nStyle: ${ai.style}`;
        const personaRules = ai.systemPrompt ? `\nCORE INSTRUCTIONS:\n${ai.systemPrompt}\n` : '';
        const preferredLanguage = context?.preferredLanguage === 'en' ? 'English' : 'Simplified Chinese';
        const latestUserLanguage = context?.latestUserLanguage;
        const strictTurnLanguage = latestUserLanguage === 'en'
            ? 'English'
            : latestUserLanguage === 'zh'
                ? 'Simplified Chinese'
                : null;
        const strictTurnRule = strictTurnLanguage
            ? `- Current turn language detected: ${strictTurnLanguage}. Your next reply MUST be in ${strictTurnLanguage}.`
            : '';
        const languageHint = `
LANGUAGE RULES (HIGH PRIORITY):
- Preferred output language: ${preferredLanguage}.
${strictTurnRule || `- Current turn language: follow ${preferredLanguage} unless user explicitly asks otherwise.`}
- Always follow the user's latest message language when clear.
- If the user writes in Chinese, reply in Simplified Chinese.
- Do not switch to English unless the user asks in English.
`;
        const controlTags = `
CONTROL TAGS:
- [TOOL_CALL: tool_name {"arg":"value"}]
- [MEMORY_REQUEST: target=CharacterName, topic=Question]
- [SILENCE] | [MULTI:msg1|msg2] | [SCHEDULE:mins]
${ai.agentType === 'task-specialist' ? this._getSpecialistTools(ai) : ''}
- Normal chat = plain text. Never wrap control tags in code fences.
`;
        // T06: Affinity-aware tone instructions
        let affinityHint = '';
        if (context?.intimacyLevel) {
            const level = context.intimacyLevel;
            if (level >= 5) {
                affinityHint = '\nRELATIONSHIP: soulmate. Be intimate, affectionate, and detailed.';
            } else if (level >= 4) {
                affinityHint = '\nRELATIONSHIP: close friend. Warm, personal, occasional nicknames.';
            } else if (level >= 3) {
                affinityHint = '\nRELATIONSHIP: good friend. Warm and casual.';
            } else if (level >= 2) {
                affinityHint = '\nRELATIONSHIP: friend. Friendly and conversational.';
            } else {
                affinityHint = '\nRELATIONSHIP: acquaintance. Brief, polite, slightly formal.';
            }
        }

        // T06: Mood-aware behavior hint
        let moodHint = '';
        if (context?.mood?.promptHint) {
            moodHint = `\nCURRENT MOOD: ${context.mood.promptHint}`;
        }

        // T12: Long-term memory + group chat context
        return `${base}${personaRules}\n${languageHint}${controlTags}${affinityHint}${moodHint}${memoryBlock}${groupBlock}\nRULES: concise, reply when relevant, use memories naturally.`;
    }

    _getSpecialistTools(ai) {
        return (ai.tools || []).map(t => `- [TOOL_CALL: ${t.name} ...arguments]`).join('\n');
    }

    _detectLatestUserLanguage(messages = []) {
        if (!Array.isArray(messages) || messages.length === 0) return null;

        const latestUserMessage = [...messages].reverse().find(
            (msg) => msg?.senderId === 'user-me' && typeof msg?.content === 'string' && msg.content.trim()
        );
        if (!latestUserMessage) return null;

        const text = latestUserMessage.content;
        const zhCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const enCount = (text.match(/[A-Za-z]/g) || []).length;

        if (zhCount === 0 && enCount === 0) return null;
        if (zhCount > 0 && enCount === 0) return 'zh';
        if (enCount > 0 && zhCount === 0) return 'en';
        return zhCount >= enCount ? 'zh' : 'en';
    }
}
