import { calculateTypingDelay, getRandomDelay } from '../../features/chat/services/chatService';
import { callAI } from '../../features/chat/services/chatService';
import { executeTool } from '../../features/chat/services/toolService';
import { compressContext, extractMemoriesAsync } from '../memory/ContextCompressor';
import { buildMemoryBlock, buildGroupContextBlock } from '../memory/MemoryInjector';
import { createLogger } from '../../utils/logger';
import { assertToolAuthorized } from '../../features/chat/services/toolAuthorization';

const log = createLogger('AIPipeline');
const MAX_READ_DELAY_MS = 250;
const MAX_THINKING_DELAY_MS = 500;
const MAX_POST_RESPONSE_TYPING_MS = 1200;
const MAX_LLM_CALLS_PER_TURN = 1;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_CHARS = 5000;
const SOCIAL_OUTPUT_TOKENS = 300;
const DEFAULT_SPECIALIST_OUTPUT_TOKENS = 600;
const TASK_OUTPUT_TOKEN_LIMITS = {
    'agent-coder': 700,
    'agent-muse': 600,
    'agent-scholar': 320,
    'agent-sensei': 400,
    'agent-aurora': 350,
    'agent-pixel': 500,
};
const MAX_TOOL_RESULT_CHARS = 6000;
const MODEL_BACKED_TOOL_NAMES = new Set([
    'check_grammar',
    'translate',
    'immersive_translate',
    'analyze_data',
    'delegate_task',
]);
const PREFLIGHT_TOOL_NAMES = new Set([
    'sonar_search',
    'deep_research',
    'fact_check',
    'execute_math',
    'generate_quiz',
    'track_progress',
    'check_prerequisites',
    'generate_image',
    'color_palette',
]);
const DIRECT_RESULT_TOOL_NAMES = new Set([
    'execute_math',
    'color_palette',
    'generate_quiz',
    'track_progress',
    'check_prerequisites',
]);

const TOOL_INTENT_PATTERNS = {
    check_grammar: /(?:语法|拼写|校对|检查这段|grammar|proofread|spelling)/i,
    immersive_translate: /(?:翻译|译成|译为|translate|translation)/i,
    detect_content_domain: /(?:内容领域|文本类型|content domain)/i,
    sonar_search: /(?:搜索|查一下|最新|近期|当前|今天|新闻|资料|search|latest|current|news)/i,
    deep_research: /(?:深度研究|系统调研|综合研究|deep research)/i,
    fact_check: /(?:事实核查|核实|真的吗|是否属实|fact.?check|verify)/i,
    cite_sources: /(?:引用|参考文献|APA|MLA|citation)/i,
    execute_math: /(?:计算|算一下|怎么算|多少钱|最后多少|还剩多少|剩多少|总共|一共|合计|预算|等于多少|解方程|求导|化简|calculate|how much|how many (?:are )?left|total|budget|solve|derivative|simplify|\d\s*[-+*/^]\s*\d)/i,
    generate_quiz: /(?:出题|测验|小测|练习题|quiz)/i,
    track_progress: /(?:学习进度|掌握了|没掌握|卡在|track progress)/i,
    check_prerequisites: /(?:先修|先学|学之前|prerequisite)/i,
    generate_image: /(?:生成|画|创作|做|给我|帮我).{0,16}(?:图|图片|照片|插画|海报|头像)|(?:generate|draw|create|make).{0,20}(?:image|picture|illustration|poster)/i,
    color_palette: /(?:配色|色板|颜色方案|color palette|colour palette)/i,
};

/**
 * Convert common calculator phrasing into a small math.js expression without
 * asking a language model to rewrite it. Returns null when the wording is not
 * safely understood so the assistant can answer normally instead of executing
 * guessed arithmetic.
 */
export function extractArithmeticExpression(text = '') {
    const source = String(text || '').trim();
    if (!source) return null;

    const symbolic = source.match(/-?\d+(?:\.\d+)?(?:\s*[-+*/^()]\s*-?\d+(?:\.\d+)?)+/);
    if (symbolic) return symbolic[0];

    const chineseEach = source.match(
        /(-?\d+(?:\.\d+)?)\s*[\p{Script=Han}\s,，、]{0,8}?每[\p{Script=Han}\s]{0,6}?(-?\d+(?:\.\d+)?)/u
    );
    const englishEach = source.match(
        /(-?\d+(?:\.\d+)?)\s*(?:boxes?|items?|pieces?|sets?|units?)?[\s,]{0,3}(?:at|for)\s*(?:[$¥￥])?(-?\d+(?:\.\d+)?)\s*(?:each|apiece)/i
    );
    const quantityPrice = chineseEach || englishEach;
    if (!quantityPrice) return null;

    const operations = [];
    const tail = source.slice((quantityPrice.index || 0) + quantityPrice[0].length);
    const modifierPattern = /(?:再\s*)?(加上?|增加|另加|减去?|扣掉?|减|plus|minus)\s*(?:[$¥￥])?\s*(-?\d+(?:\.\d+)?)/gi;
    let match = modifierPattern.exec(tail);
    while (match) {
        const isSubtract = /减|扣|minus/i.test(match[1]);
        operations.push(`${isSubtract ? '-' : '+'} ${match[2]}`);
        match = modifierPattern.exec(tail);
    }

    if (operations.length === 0) {
        const discount = tail.match(/(?:优惠|折扣|减免)[^\d-]{0,4}(-?\d+(?:\.\d+)?)|(-?\d+(?:\.\d+)?)[^\d]{0,4}(?:优惠|折扣|减免)/i);
        const discountValue = discount?.[1] || discount?.[2];
        if (discountValue) operations.push(`- ${discountValue}`);
    }

    if (operations.length === 0) {
        const transfer = tail.match(
            /(?:送(?:给|出)?|赠送|卖出|用掉|吃掉|拿走|消耗|损耗|丢(?:掉|了)?)[^\d-]{0,10}(-?\d+(?:\.\d+)?)/u
        );
        if (transfer?.[1]) operations.push(`- ${transfer[1]}`);
    }

    if (operations.length === 0) {
        const replenishment = tail.match(
            /(?:又买(?:了)?|再买(?:了)?|补充(?:了)?|收到(?:了)?|增加(?:了)?|添(?:了)?)[^\d-]{0,10}(-?\d+(?:\.\d+)?)/u
        );
        if (replenishment?.[1]) operations.push(`+ ${replenishment[1]}`);
    }

    return `${quantityPrice[1]} * ${quantityPrice[2]}${operations.length ? ` ${operations.join(' ')}` : ''}`;
}

export function buildScholarSearchQuery(text = '') {
    const source = String(text || '').trim();
    if (
        /openrouter/i.test(source)
        && /(?:free\s*router|free models router|openrouter\s*\/\s*free)/i.test(source)
        && /:free/i.test(source)
    ) {
        return 'OpenRouter Free Models Router openrouter/free versus :free model variant official documentation';
    }
    return source;
}

/**
 * Domain Layer: AI Pipeline
 * Manages the "Mental Model" of the AI:
 * 1. Context Preparation (Compression, Summary)
 * 2. ReAct Loop (Thinking -> Tool -> Result -> Thinking)
 * 3. Response Generation (Typing delays, Multi-message parsing)
 */
export class AIPipeline {
    constructor(callbacks, options = {}) {
        this.callbacks = callbacks || {};
        this.options = options;
        this._random = options.random || Math.random;
        // callbacks: { onTyping, onMessage, onLog }
    }

    log(msg, data) {
        if (this.callbacks.onLog) this.callbacks.onLog(msg, data);
        else console.log(msg, data || '');
    }

    _buildNativeToolsForAI(ai, latestUserText = '') {
        if (!ai?.toolsEnabled || !Array.isArray(ai.tools) || ai.tools.length === 0) {
            return null;
        }

        const relevantTools = ai.tools.filter((tool) => {
            const intentPattern = TOOL_INTENT_PATTERNS[tool.name];
            return intentPattern ? intentPattern.test(latestUserText) : false;
        });
        if (relevantTools.length === 0) return null;

        return relevantTools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description || `Tool: ${tool.name}`,
                // Keep permissive schema so OpenAI-compatible providers can still plan calls.
                parameters: tool.parameters || {
                    type: 'object',
                    properties: {},
                    additionalProperties: true
                }
            }
        }));
    }

    _requiresReasoning(ai, latestUserText = '', hasTools = false) {
        if (hasTools) return true;
        if (ai?.agentType !== 'task-specialist') return false;
        return latestUserText.length > 400
            || /(?:分析|调试|根因|架构|审查|证明|推理|为什么|debug|architecture|review|prove|reason)/i.test(latestUserText);
    }

    _planExplicitTool(ai, latestUserText = '') {
        if (!ai?.toolsEnabled || !Array.isArray(ai.tools)) return null;
        const tool = ai.tools.find((candidate) =>
            PREFLIGHT_TOOL_NAMES.has(candidate.name)
            && TOOL_INTENT_PATTERNS[candidate.name]?.test(latestUserText)
        );
        if (!tool) return null;

        const compactTopic = latestUserText
            .replace(/^.{0,16}?(?:：|:)/, '')
            .trim() || latestUserText;
        switch (tool.name) {
            case 'sonar_search':
                return {
                    name: tool.name,
                    args: {
                        query: buildScholarSearchQuery(latestUserText),
                        domains: /(?:官方|官网|official)/i.test(latestUserText) ? 'official' : 'general',
                        recency: /(?:今天|今日|today)/i.test(latestUserText)
                            ? 'day'
                            : /(?:本周|最近一周|this week)/i.test(latestUserText) ? 'week' : null,
                    },
                };
            case 'deep_research':
                return { name: tool.name, args: { query: latestUserText, depth: 1 } };
            case 'fact_check':
                return { name: tool.name, args: { claim: latestUserText } };
            case 'execute_math': {
                const expression = extractArithmeticExpression(latestUserText);
                if (!expression) return null;
                return { name: tool.name, args: { expression } };
            }
            case 'generate_quiz':
                return { name: tool.name, args: { topic: compactTopic } };
            case 'track_progress':
                return {
                    name: tool.name,
                    args: {
                        topic: compactTopic,
                        status: /(?:掌握|学会|mastered)/i.test(latestUserText)
                            ? 'mastered'
                            : /(?:卡在|不会|struggl)/i.test(latestUserText)
                                ? 'struggling'
                                : 'in_progress',
                    },
                };
            case 'check_prerequisites':
                return { name: tool.name, args: { topic: compactTopic } };
            case 'generate_image':
                return { name: tool.name, args: { prompt: compactTopic, size: '1024x1024' } };
            case 'color_palette': {
                const mood = ['warm', 'cool', 'dark', 'pastel', 'vibrant', 'nature', 'ocean', 'sunset']
                    .find((candidate) => latestUserText.toLowerCase().includes(candidate)) || 'warm';
                return { name: tool.name, args: { mood, count: 5 } };
            }
            default:
                return null;
        }
    }

    async _runPreflightTool(chatId, ai, plan, personas, turnContext) {
        let toolMsgId = null;
        try {
            assertToolAuthorized(ai, plan.name);
            toolMsgId = this.callbacks.onToolStart?.(chatId, ai.id, plan.name, plan.args) ?? null;
            const output = await executeTool(plan.name, plan.args, {
                personas,
                requesterId: ai.id,
                delegationDepth: 0,
            });
            this.callbacks.onToolEnd?.(chatId, toolMsgId, output, null);
            turnContext.lastToolOutput = String(output || '');
            turnContext.preplannedTool = plan.name;
            return {
                role: 'user',
                content: `[PRECOMPUTED TOOL RESULT: ${plan.name}]\n${turnContext.lastToolOutput.slice(0, MAX_TOOL_RESULT_CHARS)}\n\nUse this result directly. Do not call another tool.`,
            };
        } catch (error) {
            const message = error?.message || String(error);
            this.callbacks.onToolEnd?.(chatId, toolMsgId, null, message);
            turnContext.preplannedTool = plan.name;
            return {
                role: 'user',
                content: `[PRECOMPUTED TOOL ERROR: ${plan.name}] ${message}. Explain the limitation without retrying.`,
            };
        }
    }

    _assertPostModelToolBudget(toolName, turnContext = {}) {
        if ((turnContext.llmCalls || 0) > 0 && MODEL_BACKED_TOOL_NAMES.has(toolName)) {
            throw new Error(
                `Tool "${toolName}" would exceed the one-model-request budget. `
                + 'Complete the task in the current response instead.'
            );
        }
    }

    _formatDirectToolResponse(toolName, output, language = 'zh') {
        const text = String(output || '').trim();
        if (toolName !== 'execute_math') return text;

        const result = text.match(/^Result:\s*(.+)$/m)?.[1]?.trim();
        const expression = text.match(/^Expression:\s*(.+)$/m)?.[1]?.trim();
        if (!result) return text;
        const readableExpression = String(expression || '')
            .replace(/\*/g, '×')
            .replace(/\//g, '÷');
        return language === 'en'
            ? `The result is ${result}${readableExpression ? ` (${readableExpression})` : ''}.`
            : `结果是 ${result}${readableExpression ? `（${readableExpression}）` : ''}。`;
    }

    _parseNativeToolMarker(response) {
        if (typeof response !== 'string' || !response.startsWith('[TOOL_CALL_NATIVE:')) {
            return null;
        }

        const match = response.match(/^\[TOOL_CALL_NATIVE:([\s\S]+)\]$/);
        if (!match) return null;

        try {
            const payload = JSON.parse(match[1]);
            const calls = Array.isArray(payload) ? payload : [payload];
            return calls
                .map(call => {
                    const fn = call?.function || {};
                    const name = fn.name;
                    if (!name) return null;
                    let args = {};
                    if (typeof fn.arguments === 'string' && fn.arguments.trim()) {
                        try {
                            args = JSON.parse(fn.arguments);
                        } catch (parseError) {
                            log.warn('Tool call arguments JSON parse failed', { name, raw: fn.arguments?.slice(0, 100), error: parseError.message });
                            args = { error: 'JSON_PARSE_FAILED', details: parseError.message };
                        }
                    } else if (fn.arguments && typeof fn.arguments === 'object') {
                        args = fn.arguments;
                    }
                    return { name, args };
                })
                .filter(Boolean);
        } catch (parseError) {
            log.warn('Failed to parse tool calls from AI response', { error: parseError.message });
            return null;
        }
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
        const visibleMessages = (chat.messages || []).filter(
            message => !message?.recalled && message?.type !== 'ai_error'
        );

        // 1. Calculate Delays
        const readDelay = Math.min(
            getRandomDelay(ai.readDelay || { min: 500, max: 2000 }),
            MAX_READ_DELAY_MS
        );
        const thinkingDelay = Math.min(
            getRandomDelay(ai.responseDelay || { min: 1000, max: 2000 }),
            MAX_THINKING_DELAY_MS
        );

        await this._wait(readDelay);

        // Phase 3: Check if this will be a long response (editing state)
        const totalContextLength = visibleMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
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
            const { compressed, summary, recentMessages } = compressContext(visibleMessages, personas);
            const messagesToProcess = compressed ? recentMessages : visibleMessages;
            const history = this._prepareHistory(
                messagesToProcess,
                personas,
                compressed,
                summary,
                chat.polls,
                Boolean(context?.isGroupChat)
            );
            const latestUserLanguage = this._detectLatestUserLanguage(visibleMessages);
            const latestUserMessage = [...visibleMessages].reverse().find(
                message => message?.senderId === 'user-me'
            );

            // Read existing memories before capturing this turn so the latest
            // message is not duplicated in the same provider request.
            const memoryBlock = await buildMemoryBlock(ai.id, {
                recentUserText: [...visibleMessages]
                    .reverse()
                    .find(message => message?.senderId === 'user-me')?.content || '',
            });
            if (latestUserMessage) {
                try {
                    await extractMemoriesAsync([latestUserMessage], ai.id, ai.name);
                } catch (error) {
                    console.warn('[AIPipeline] Local memory capture failed (non-blocking):', error);
                }
            }

            // 4. Generate a compact system prompt and bounded context.
            const groupMessages = context?.recentGroupMessages || [];
            const groupBlock = buildGroupContextBlock(groupMessages, ai.id, personas);

            const systemPrompt = this._generateSystemPrompt(
                ai,
                { ...(context || {}), latestUserLanguage },
                memoryBlock,
                groupBlock
            );

            const turnContext = {
                userMessageId: latestUserMessage?.id || null,
                language: latestUserLanguage,
                latestUserText: latestUserMessage?.content || '',
                llmCalls: 0,
                lastToolOutput: null,
                preplannedTool: null,
            };
            const toolPlan = this._planExplicitTool(ai, turnContext.latestUserText);
            const preflightToolMessage = toolPlan
                ? await this._runPreflightTool(chatId, ai, toolPlan, this._personas || [], turnContext)
                : null;

            if (toolPlan?.name === 'generate_image' && turnContext.lastToolOutput?.startsWith('[IMG:')) {
                await this._handleFinalResponse(
                    chatId,
                    ai,
                    turnContext.lastToolOutput,
                    history,
                    turnContext
                );
                return;
            }

            if (
                toolPlan
                && DIRECT_RESULT_TOOL_NAMES.has(toolPlan.name)
                && turnContext.lastToolOutput
            ) {
                await this._handleFinalResponse(
                    chatId,
                    ai,
                    this._formatDirectToolResponse(
                        toolPlan.name,
                        turnContext.lastToolOutput,
                        turnContext.language
                    ),
                    history,
                    turnContext
                );
                return;
            }

            // 5. Exactly one text-model request. Explicit tools are executed
            // locally first and their bounded result is included in this call.
            await this._runReActLoop(
                chatId,
                ai,
                systemPrompt,
                preflightToolMessage ? [...history, preflightToolMessage] : history,
                0,
                this._personas || [],
                turnContext
            );

        } catch (error) {
            console.error('[AIPipeline] Error:', error);
            this.callbacks.onError?.(chatId, ai.id, {
                code: 'pipeline_error',
                userMessageId: [...visibleMessages].reverse().find(message => message?.senderId === 'user-me')?.id || null,
                language: this._detectLatestUserLanguage(visibleMessages),
            });
            this.callbacks.onTyping?.(chatId, ai.id, false);
        }
    }

    async _runReActLoop(chatId, ai, systemPrompt, initialHistory, depth = 0, personas = [], turnContext = {}) {
        if (depth >= MAX_LLM_CALLS_PER_TURN || (turnContext.llmCalls || 0) >= MAX_LLM_CALLS_PER_TURN) {
            this.log('[AIPipeline] Per-turn LLM request budget reached');
            if (turnContext.lastToolOutput) {
                await this._handleFinalResponse(chatId, ai, turnContext.lastToolOutput, initialHistory, turnContext);
            }
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Call LLM
        const requestMessages = [{ role: 'system', content: systemPrompt }, ...initialHistory];
        // Tool selection is deterministic and happens before this request.
        // Omitting schemas saves prompt tokens and prevents a second LLM turn.
        const nativeTools = null;
        let callFailure = null;
        turnContext.llmCalls = (turnContext.llmCalls || 0) + 1;
        const response = await callAI(requestMessages, {
            agentId: ai.id,
            maxTokens: ai.agentType === 'task-specialist'
                ? (TASK_OUTPUT_TOKEN_LIMITS[ai.id] || DEFAULT_SPECIALIST_OUTPUT_TOKENS)
                : SOCIAL_OUTPUT_TOKENS,
            tools: nativeTools || undefined,
            toolChoice: nativeTools ? 'auto' : undefined,
            disableReasoning: !this._requiresReasoning(
                ai,
                turnContext.latestUserText,
                Boolean(nativeTools)
            ),
            onError: details => { callFailure = details; },
        });

        if (!response) {
            this.callbacks.onError?.(chatId, ai.id, {
                ...(callFailure || { code: 'empty_response' }),
                userMessageId: turnContext.userMessageId || null,
                language: turnContext.language || null,
            });
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Check for Tool Calls — native OpenAI, standard [TOOL_CALL: name {...}] or T12 [MEMORY_REQUEST: target=X, topic=Y]
        const nativeToolCalls = this._parseNativeToolMarker(response);
        const toolMatch = response.match(/\[TOOL_CALL:\s*(\w+)\s*(\{.*?\})\s*\]/);
        const memReqMatch = !toolMatch && response.match(/\[MEMORY_REQUEST:\s*target=([^,\]]+),\s*topic=([^\]]+)\]/);

        if (depth > 0 && ((nativeToolCalls && nativeToolCalls.length > 0) || toolMatch || memReqMatch)) {
            await this._handleFinalResponse(
                chatId,
                ai,
                turnContext.lastToolOutput || '工具已执行完成。',
                initialHistory,
                turnContext
            );
        } else if (nativeToolCalls && nativeToolCalls.length > 0) {
            const toolHistory = [];

            for (const toolCall of nativeToolCalls) {
                this.log(`[Native Tool Call] ${toolCall.name}`, toolCall.args);

                let toolMsgId = null;
                toolHistory.push({ role: 'assistant', content: `[TOOL_CALL: ${toolCall.name} ${JSON.stringify(toolCall.args)}]` });
                try {
                    this._assertPostModelToolBudget(toolCall.name, turnContext);
                    assertToolAuthorized(ai, toolCall.name);
                    toolMsgId = this.callbacks.onToolStart?.(chatId, ai.id, toolCall.name, toolCall.args) ?? null;
                    const toolOutput = await executeTool(toolCall.name, toolCall.args, {
                        personas,
                        requesterId: ai.id,
                        delegationDepth: depth
                    });
                    this.callbacks.onToolEnd?.(chatId, toolMsgId, toolOutput, null);
                    turnContext.lastToolOutput = toolOutput;
                    toolHistory.push({ role: 'user', content: `[TOOL_RESULT for ${toolCall.name}]\n${toolOutput}\n\n[Please continue based on this result]` });
                } catch (error) {
                    const errorMessage = error?.message || String(error);
                    this.log('[Native Tool Error]', error);
                    this.callbacks.onToolEnd?.(chatId, toolMsgId, null, errorMessage);
                    turnContext.lastToolOutput = `工具执行失败：${errorMessage}`;
                    toolHistory.push({ role: 'user', content: `[TOOL_ERROR]: ${errorMessage}` });
                }
            }

            const newHistory = [...initialHistory, ...toolHistory];
            await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1, personas, turnContext);
        } else if (toolMatch) {
            // --- Standard Tool Execution Path ---
            const [, toolName, argsStr] = toolMatch;
            this.log(`[Tool Call] ${toolName}`, argsStr);

            // T13: Emit tool start event so UI can show loading card
            let toolMsgId = null;
            try {
                const args = JSON.parse(argsStr);
                this._assertPostModelToolBudget(toolName, turnContext);
                assertToolAuthorized(ai, toolName);

                toolMsgId = this.callbacks.onToolStart?.(chatId, ai.id, toolName, args) ?? null;

                const toolOutput = await executeTool(toolName, args, { personas, requesterId: ai.id, delegationDepth: depth });

                // T13: Emit tool end (success)
                this.callbacks.onToolEnd?.(chatId, toolMsgId, toolOutput, null);
                turnContext.lastToolOutput = toolOutput;

                // Recursive Call
                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_RESULT for ${toolName}]\n${toolOutput}\n\n[Please continue based on this result]` }
                ];

                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1, personas, turnContext);

            } catch (error) {
                this.log('[Tool Error]', error);
                // T13: Emit tool end (error)
                this.callbacks.onToolEnd?.(chatId, toolMsgId, null, error.message);
                turnContext.lastToolOutput = `工具执行失败：${error.message}`;

                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_ERROR]: ${error.message}` }
                ];
                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1, personas, turnContext);
            }

        } else if (memReqMatch) {
            // --- T12: MEMORY_REQUEST Tool Path ---
            const targetName = memReqMatch[1].trim();
            const topic = memReqMatch[2].trim();
            this.log(`[Memory Request] ${ai.name} → ${targetName} about "${topic}"`);

            try {
                assertToolAuthorized(ai, 'MEMORY_REQUEST');
                const toolOutput = await executeTool('MEMORY_REQUEST', { target: targetName, topic }, { personas, requesterId: ai.id });
                turnContext.lastToolOutput = toolOutput;
                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_RESULT for MEMORY_REQUEST from ${targetName}]\n${toolOutput}\n\n[Please continue based on this result]` }
                ];
                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1, personas, turnContext);
            } catch (error) {
                this.log('[Memory Request Error]', error);
                turnContext.lastToolOutput = `记忆请求失败：${error.message}`;
                const newHistory = [
                    ...initialHistory,
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[TOOL_ERROR]: Memory exchange failed — ${error.message}` }
                ];
                await this._runReActLoop(chatId, ai, systemPrompt, newHistory, depth + 1, personas, turnContext);
            }

        } else {
            // --- Final Response Path ---
            await this._handleFinalResponse(chatId, ai, response, initialHistory, turnContext);
        }
    }

    async _handleFinalResponse(chatId, ai, response, _history = [], _turnContext = {}) {
        if (!response) {
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        if (response.includes('[SILENCE]')) {
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Parse SCHEDULE first so control tags always take effect even when
        // optional conversational polish features (like recall simulation) run.
        const scheduleMatch = response.match(/\[SCHEDULE:(\d+)\]/);
        let cleanResponse = response;
        if (scheduleMatch) {
            const minutes = parseInt(scheduleMatch[1], 10);
            cleanResponse = cleanResponse.replace(scheduleMatch[0], '').trim();
            this.callbacks.onSchedule?.(chatId, ai, minutes);
        }

        const multiMatch = cleanResponse.match(/\[(?:MULTI|Multi|multi):(.+?)\]/i);

        if (multiMatch) {
            const parts = multiMatch[1].split('|').map(m => m.trim()).filter(Boolean);
            cleanResponse = cleanResponse.replace(multiMatch[0], '').trim();

            // Send parts sequentially
            for (let i = 0; i < parts.length; i++) {
                if (i > 0) {
                    this.callbacks.onTyping?.(chatId, ai.id, true);
                    await this._wait(800 + this._random() * 1000);
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

        // Done. Media APIs are only reached by an explicit user action/tool.
        this.callbacks.onTyping?.(chatId, ai.id, false);
    }

    async _simulateTypingAndSend(chatId, ai, content) {
        const delay = Math.min(
            calculateTypingDelay(content.length, ai.typingSpeed || 'normal'),
            MAX_POST_RESPONSE_TYPING_MS
        );
        await this._wait(delay);
        this.callbacks.onMessage?.(chatId, content, ai.id);
    }

    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _shouldSimulateRecall(_response) {
        return false;
    }

    // --- Helpers Copied/Refactored from Context ---
    // In a future step, these could be extracted to a pure utility class

    _prepareHistory(messages, personas, compressed, summary, polls, includeSpeakerNames = false) {
        const personaNameMap = new Map(personas.map(p => [p.id, p.name]));
        const selectedMessages = [];
        let remainingChars = MAX_HISTORY_CHARS;
        for (const message of messages.slice(-MAX_HISTORY_MESSAGES).reverse()) {
            if (remainingChars <= 0) break;
            const original = String(message?.content || '');
            let content = original;
            if (content.length > remainingChars) {
                const headLength = Math.max(1, Math.floor((remainingChars - 1) * 0.65));
                const tailLength = Math.max(0, remainingChars - headLength - 1);
                content = `${content.slice(0, headLength)}…${tailLength ? content.slice(-tailLength) : ''}`;
            }
            selectedMessages.unshift({ ...message, content });
            remainingChars -= content.length;
        }

        const rawHistory = selectedMessages.map(m => {
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
                content: includeSpeakerNames ? `${sender}: ${content}` : content
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
        const base = ai.systemPrompt
            ? `You are ${ai.name}.`
            : `You are ${ai.name}.\nPersonality: ${ai.personality}\nStyle: ${ai.style}`;
        const personaRules = ai.systemPrompt ? `\nCORE INSTRUCTIONS:\n${ai.systemPrompt}\n` : '';
        const relationshipByLevel = {
            1: 'acquaintance',
            2: 'friend',
            3: 'good friend',
            4: 'close friend',
            5: 'soulmate'
        };
        const relationship = relationshipByLevel[context?.intimacyLevel];
        const isTaskSpecialist = ai.agentType === 'task-specialist';
        const relationshipHint = relationship && !isTaskSpecialist ? `\nRELATIONSHIP: ${relationship}` : '';
        const mood = context?.mood?.promptHint;
        const moodHint = mood && !isTaskSpecialist ? `\nCURRENT MOOD: ${mood}` : '';
        const latestUserLanguage = context?.latestUserLanguage;
        const outputLanguage = latestUserLanguage === 'en'
            ? 'English'
            : latestUserLanguage === 'zh'
                ? 'Simplified Chinese'
                : context?.preferredLanguage === 'en' ? 'English' : 'Simplified Chinese';
        const groupRule = groupBlock
            ? '\nIn a group, reply only when relevant; output [SILENCE] when you should not answer.'
            : '';
        const behaviorRules = `
Reply in ${outputLanguage}. Stay in character. Be concise in casual chat.
HIGHEST PRIORITY: for a concrete question, the first sentence must give a specific answer or action. Never answer with metaphors alone; character flavor may follow.
Default to the shortest complete answer. Do not repeat the question or add optional alternatives unless the user asks for detail.
Never invent current travel rules, laws, medical guidance, prices, schedules, or product policies. Without precomputed search evidence, keep advice general and tell the user which official source to verify.
Never prefix the answer with your name or a speaker label.${groupRule}`;
        return `${base}${personaRules}${relationshipHint}${moodHint}${memoryBlock}${groupBlock}${behaviorRules}`;
    }

    _detectLatestUserLanguage(messages = []) {
        if (!Array.isArray(messages) || messages.length === 0) return null;

        const latestUserMessage = [...messages].reverse().find(
            (msg) => msg?.senderId === 'user-me' && typeof msg?.content === 'string' && msg.content.trim()
        );
        if (!latestUserMessage) return null;

        const text = latestUserMessage.content;
        const zhCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        // Count English words instead of letters so code identifiers do not
        // overwhelm an otherwise Chinese request (for example, a JS snippet).
        const enWordCount = (text.match(/[A-Za-z]+/g) || []).length;

        if (zhCount === 0 && enWordCount === 0) return null;
        if (zhCount > 0 && enWordCount === 0) return 'zh';
        if (enWordCount > 0 && zhCount === 0) return 'en';
        return zhCount >= enWordCount ? 'zh' : 'en';
    }
}
