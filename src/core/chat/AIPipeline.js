import {
    calculateTypingDelay,
    getRandomDelay,
    callAI,
    TRUNCATED_RESPONSE_MARKER,
} from '../../features/chat/services/chatService';
import { executeTool } from '../../features/chat/services/toolService';
import { compressContext, extractMemoriesAsync } from '../memory/ContextCompressor';
import { buildMemoryBlock, buildGroupContextBlock } from '../memory/MemoryInjector';
import { createLogger } from '../../utils/logger';
import { assertToolAuthorized } from '../../features/chat/services/toolAuthorization';

const log = createLogger('AIPipeline');
const MAX_READ_DELAY_MS = 250;
const MAX_THINKING_DELAY_MS = 500;
const MAX_POST_RESPONSE_TYPING_MS = 1200;
// Ordinary turns still use one request. A second request is reserved for the
// real function-calling path: choose a tool, execute it, then explain its
// result. This preserves model capability without reintroducing hidden fan-out.
const MAX_LLM_CALLS_PER_TURN = 2;
const MAX_HISTORY_MESSAGES = 48;
const MAX_HISTORY_CHARS = 100000;
const SOCIAL_OUTPUT_TOKENS = 1600;
const DEFAULT_SPECIALIST_OUTPUT_TOKENS = 3000;
const TASK_OUTPUT_TOKEN_LIMITS = {
    'agent-coder': 6144,
    'agent-muse': 4096,
    'agent-scholar': 4096,
    'agent-sensei': 3000,
    'agent-aurora': 2400,
    'agent-pixel': 3000,
};
const LONG_FORM_SOCIAL_OUTPUT_TOKENS = 3000;
const LONG_FORM_SPECIALIST_OUTPUT_TOKENS = 6144;
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

const TOOL_PARAMETER_SCHEMAS = {
    execute_math: {
        type: 'object',
        properties: {
            expression: {
                type: 'string',
                minLength: 1,
                description: 'A math.js-compatible expression derived from the user request',
            },
        },
        required: ['expression'],
        additionalProperties: false,
    },
    detect_content_domain: {
        type: 'object',
        properties: {
            text: { type: 'string', minLength: 1, description: 'Text whose domain should be classified' },
        },
        required: ['text'],
        additionalProperties: false,
    },
};

const LONG_FORM_PATTERN = /(?:详细|完整|深入|展开|逐步|长文|全面|教程|方案|报告|分析|解释清楚|in detail|comprehensive|step.by.step|full|long.form|tutorial|report)/i;
const BRIEF_PATTERN = /(?:简短|简洁|一句话|只要答案|直接回答|brief|concise|one sentence|just the answer)/i;
const NEGATED_BRIEF_PATTERN = /(?:(?:不|别|勿|避免|拒绝|无需|无须)[^。！？.!?]{0,16}(?:简短|简洁|一句话|只要答案|直接回答|省略)|(?:do not|don't|without|not)[^.!?]{0,20}(?:brief|concise|omit))/i;
const CURRENT_INFORMATION_PATTERN = /(?:最新|当前(?:的|版本|数据|规则)|近期(?:的|数据|新闻)|实时|政策|法规|价格|时刻表|新闻|天气|latest|current (?:version|data|rule)|recent (?:data|news)|policy|law|price|schedule|news|weather)/i;
const LEAKED_REASONING_PREFIX = /^\s*(?:here(?:'|’)s a thinking process|thinking process:|analysis of (?:the )?(?:user )?(?:input|prompt)|<think>|we need to (?:answer|respond)|let(?:'|’)s analyze)/i;

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
            if (MODEL_BACKED_TOOL_NAMES.has(tool.name)) return false;
            const intentPattern = TOOL_INTENT_PATTERNS[tool.name];
            return intentPattern ? intentPattern.test(latestUserText) : false;
        });
        if (relevantTools.length === 0) return null;

        return relevantTools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description || `Tool: ${tool.name}`,
                parameters: tool.parameters || TOOL_PARAMETER_SCHEMAS[tool.name] || {
                    type: 'object',
                    properties: {},
                    additionalProperties: true
                }
            }
        }));
    }

    _wantsLongForm(latestUserText = '') {
        return LONG_FORM_PATTERN.test(latestUserText);
    }

    _wantsBriefResponse(latestUserText = '') {
        return !this._wantsLongForm(latestUserText)
            && BRIEF_PATTERN.test(latestUserText)
            && !NEGATED_BRIEF_PATTERN.test(latestUserText);
    }

    _resolveOutputTokenLimit(ai, latestUserText = '') {
        const isSpecialist = ai?.agentType === 'task-specialist';
        const baseLimit = isSpecialist
            ? (TASK_OUTPUT_TOKEN_LIMITS[ai.id] || DEFAULT_SPECIALIST_OUTPUT_TOKENS)
            : SOCIAL_OUTPUT_TOKENS;
        if (this._wantsBriefResponse(latestUserText)) return Math.min(baseLimit, 1000);
        if (!this._wantsLongForm(latestUserText) && latestUserText.length < 800) return baseLimit;
        return Math.max(
            baseLimit,
            isSpecialist ? LONG_FORM_SPECIALIST_OUTPUT_TOKENS : LONG_FORM_SOCIAL_OUTPUT_TOKENS
        );
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
            turnContext.lastToolName = plan.name;
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
            const error = new Error(
                `Tool "${toolName}" would launch an additional hidden model workflow. `
                + 'Complete the task in the current response instead.'
            );
            error.code = 'model_backed_tool_budget';
            throw error;
        }
    }

    _formatDirectToolResponse(toolName, output, language = 'zh') {
        const text = String(output || '').trim();
        if (toolName !== 'execute_math') return text;

        const result = text.match(/^Result:\s*(.+)$/m)?.[1]?.trim();
        const expression = text.match(/^Expression:\s*(.+)$/m)?.[1]?.trim();
        const simplified = text.match(/^Simplified:\s*(.+)$/m)?.[1]?.trim();
        if (!result) return text;
        const readableExpression = String(expression || '')
            .replace(/\*/g, '×')
            .replace(/\//g, '÷');
        return language === 'en'
            ? `Tool result: \`${result}\`${simplified ? `; exact form: \`${simplified}\`` : ''}${readableExpression ? ` (${readableExpression})` : ''}.`
            : `工具计算结果：\`${result}\`${simplified ? `；精确形式：\`${simplified}\`` : ''}${readableExpression ? `（${readableExpression}）` : ''}。`;
    }

    _containsExactToolFact(text, fact) {
        const source = String(text || '');
        const target = String(fact || '');
        if (!target) return false;
        if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(target)) {
            return source.includes(target);
        }

        let index = source.indexOf(target);
        while (index !== -1) {
            const before = source[index - 1] || '';
            const after = source[index + target.length] || '';
            if (!/[\d.eE+-]/.test(before) && !/[\d.eE+-]/.test(after)) return true;
            index = source.indexOf(target, index + target.length);
        }
        return false;
    }

    _ensureAuthoritativeToolFacts(response, turnContext = {}) {
        const text = String(response || '').trim();
        if (turnContext.lastToolName !== 'execute_math') return text;

        const toolOutput = String(turnContext.lastToolOutput || '');
        const result = toolOutput.match(/^Result:\s*(.+)$/m)?.[1]?.trim();
        const simplified = toolOutput.match(/^Simplified:\s*(.+)$/m)?.[1]?.trim();
        const expression = toolOutput.match(/^Expression:\s*(.+)$/m)?.[1]?.trim();
        if (!result) return text;

        const hasResult = this._containsExactToolFact(text, result);
        const hasSimplified = !simplified || text.includes(simplified);
        if (hasResult && hasSimplified) return text;

        const authoritativeLine = turnContext.language === 'en'
            ? `Verified tool result: \`${result}\`${simplified ? `; exact form: \`${simplified}\`` : ''}.`
            : `已验证工具结果：\`${result}\`${simplified ? `；精确形式：\`${simplified}\`` : ''}。`;
        const circleRadius = expression?.match(/^pi\s*\*\s*(-?\d+(?:\.\d+)?)\s*\^\s*2$/i)?.[1]
            || expression?.match(/^(-?\d+(?:\.\d+)?)\s*\^\s*2\s*\*\s*pi$/i)?.[1];
        const asksForCircleArea = /(?:圆[^\n。！？.!?]{0,24}面积|面积[^\n。！？.!?]{0,24}圆|circle[^\n.!?]{0,24}area|area[^\n.!?]{0,24}circle)/i
            .test(String(turnContext.latestUserText || ''));
        const contextualLine = circleRadius && asksForCircleArea
            ? turnContext.language === 'en'
                ? `This is the area of a circle with radius \`${circleRadius}\`, expressed in square units.`
                : `这表示半径为 \`${circleRadius}\` 的圆的面积，单位为相应的平方单位。`
            : '';
        const fallback = contextualLine
            ? `${authoritativeLine}\n\n${contextualLine}`
            : authoritativeLine;
        return text.length >= 8 ? `${fallback}\n\n${text}` : fallback;
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
            message => !message?.recalled
                && message?.type !== 'ai_error'
                && message?.type !== 'tool_event'
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

            const turnContext = {
                userMessageId: latestUserMessage?.id || null,
                language: latestUserLanguage,
                latestUserText: latestUserMessage?.content || '',
                llmCalls: 0,
                lastToolOutput: null,
                lastToolName: null,
                preplannedTool: null,
            };
            const toolPlan = this._planExplicitTool(ai, turnContext.latestUserText);
            const systemPrompt = this._generateSystemPrompt(
                ai,
                {
                    ...(context || {}),
                    latestUserLanguage,
                    latestUserText: turnContext.latestUserText,
                    plannedToolName: toolPlan?.name || null,
                },
                memoryBlock,
                groupBlock
            );
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

            // 5. Explicit tools are executed locally first and their bounded
            // result is included in one synthesis request. Only an ambiguous
            // model-selected tool may use a second request for interpretation.
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

        // Call LLM. Tool schemas are sent only on the first request, only when
        // local intent routing found a relevant tool but could not safely build
        // its arguments. This keeps ordinary prompts clean while retaining real
        // model-directed function calling for ambiguous requests.
        const requestMessages = [{ role: 'system', content: systemPrompt }, ...initialHistory];
        const nativeTools = depth === 0
            && !turnContext.preplannedTool
            && !turnContext.lastToolOutput
            ? this._buildNativeToolsForAI(ai, turnContext.latestUserText)
            : null;
        const maxTokens = this._resolveOutputTokenLimit(ai, turnContext.latestUserText);
        // Stream every answer-only request so free-provider latency yields
        // visible progress for personas as well as task agents. Tool-selection
        // requests stay buffered because fragmented function arguments must be
        // reassembled before any local execution begins.
        const shouldStream = !nativeTools;
        let callFailure = null;
        turnContext.llmCalls = (turnContext.llmCalls || 0) + 1;
        this.log('[AIPipeline] Provider request plan', {
            agentId: ai.id,
            requestNumber: turnContext.llmCalls,
            systemChars: systemPrompt.length,
            historyMessages: initialHistory.length,
            historyChars: initialHistory.reduce((sum, message) => sum + String(message?.content || '').length, 0),
            maxOutputTokens: maxTokens,
            tools: nativeTools?.map(tool => tool.function.name) || [],
        });
        const response = await callAI(requestMessages, {
            agentId: ai.id,
            maxTokens,
            temperature: ai?.agentType === 'task-specialist' ? 0.4 : 0.8,
            tools: nativeTools || undefined,
            toolChoice: nativeTools ? 'auto' : undefined,
            // Nemotron's optional extended-reasoning mode can duplicate its
            // scratchpad into visible content and consume the completion
            // budget. Normal inference remains enabled; only that extra mode
            // is disabled so every request yields a final answer/tool call.
            disableReasoning: true,
            stream: shouldStream,
            onStreamChunk: shouldStream
                ? (_delta, fullText) => {
                    if (LEAKED_REASONING_PREFIX.test(fullText)) return;
                    const now = Date.now();
                    const lastUpdateAt = turnContext.lastStreamUpdateAt || 0;
                    if (now - lastUpdateAt < 100 && fullText.length - (turnContext.lastStreamChars || 0) < 160) {
                        return;
                    }
                    turnContext.lastStreamUpdateAt = now;
                    turnContext.lastStreamChars = fullText.length;
                    turnContext.streamed = true;
                    this.callbacks.onStream?.(chatId, ai.id, fullText);
                }
                : undefined,
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
            let nativeToolError = null;

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
                    turnContext.lastToolName = toolCall.name;
                    toolHistory.push({
                        role: 'user',
                        content: `[TOOL_RESULT for ${toolCall.name}]\n${String(toolOutput || '').slice(0, MAX_TOOL_RESULT_CHARS)}\n\n`
                            + 'Treat the expression and result as authoritative. Quote the full value after `Result:` at least once, without rounding or changing digits; if `Simplified:` is present, preserve that exact symbolic form too. '
                            + 'A rounded approximation may appear only after the exact value. Preserve the exact operation and any units; do not relabel it as a different formula. '
                            + 'For geometry, explicitly distinguish area, circumference, and volume. If the real-world meaning is ambiguous, state only the verified arithmetic result. '
                            + 'Answer the user using this result. Do not call another tool.',
                    });
                } catch (error) {
                    const errorMessage = error?.message || String(error);
                    this.log('[Native Tool Error]', error);
                    this.callbacks.onToolEnd?.(chatId, toolMsgId, null, errorMessage);
                    turnContext.lastToolOutput = `工具执行失败：${errorMessage}`;
                    nativeToolError = turnContext.lastToolOutput;
                    toolHistory.push({ role: 'user', content: `[TOOL_ERROR]: ${errorMessage}` });
                }
            }

            if (nativeToolError) {
                await this._handleFinalResponse(
                    chatId,
                    ai,
                    nativeToolError,
                    initialHistory,
                    turnContext
                );
                return;
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
                turnContext.lastToolName = toolName;

                // Text markers are a legacy compatibility path. Native tool
                // calls above own the two-request choose/execute/explain flow.
                await this._handleFinalResponse(chatId, ai, toolOutput, initialHistory, turnContext);

            } catch (error) {
                this.log('[Tool Error]', error);
                // T13: Emit tool end (error)
                this.callbacks.onToolEnd?.(chatId, toolMsgId, null, error.message);
                turnContext.lastToolOutput = `工具执行失败：${error.message}`;

                await this._handleFinalResponse(
                    chatId,
                    ai,
                    turnContext.lastToolOutput,
                    initialHistory,
                    turnContext
                );
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
                await this._handleFinalResponse(chatId, ai, toolOutput, initialHistory, turnContext);
            } catch (error) {
                this.log('[Memory Request Error]', error);
                turnContext.lastToolOutput = `记忆请求失败：${error.message}`;
                await this._handleFinalResponse(
                    chatId,
                    ai,
                    turnContext.lastToolOutput,
                    initialHistory,
                    turnContext
                );
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

        let displayResponse = String(response);
        const wasTruncated = displayResponse.startsWith(`${TRUNCATED_RESPONSE_MARKER}\n`);
        const rawToolResult = String(_turnContext.lastToolOutput || '').match(/^Result:\s*(.+)$/m)?.[1]?.trim();
        const incompleteToolSynthesis = !wasTruncated
            && _turnContext.lastToolName === 'execute_math'
            && rawToolResult
            && !this._containsExactToolFact(displayResponse, rawToolResult)
            && displayResponse.trim().length < 8;
        if (wasTruncated) {
            const partial = displayResponse.slice(TRUNCATED_RESPONSE_MARKER.length).trim();
            const hasVerifiedToolResult = _turnContext.lastToolName === 'execute_math'
                && /^Result:\s*.+$/m.test(String(_turnContext.lastToolOutput || ''));
            // A one- or two-character fragment such as "计" is not useful prose.
            // Keep the verified local result and be explicit that synthesis failed,
            // without spending a third provider request on a hidden retry.
            const usablePartial = hasVerifiedToolResult && partial.length < 8 ? '' : partial;
            displayResponse = this._ensureAuthoritativeToolFacts(usablePartial, _turnContext);
            const notice = _turnContext.language === 'en'
                ? hasVerifiedToolResult && !usablePartial
                    ? '> The verified local tool result is preserved above. The provider did not complete its explanation; no hidden retry was made.'
                    : '> The provider reached its response limit. The completed portion above is preserved; no hidden retry was made.'
                : hasVerifiedToolResult && !usablePartial
                    ? '> 上方已保留本地工具验证结果。上游模型未完成说明；系统没有隐藏重试。'
                    : '> 上游模型达到回复长度上限。上方已生成内容予以保留；系统没有隐藏重试。';
            displayResponse = `${displayResponse}\n\n${notice}`;
        } else {
            displayResponse = this._ensureAuthoritativeToolFacts(displayResponse, _turnContext);
            if (incompleteToolSynthesis) {
                const notice = _turnContext.language === 'en'
                    ? '> The provider did not complete its explanation. The verified local result is shown instead; no hidden retry was made.'
                    : '> 上游模型未完成说明。系统已改用上方本地验证结果，且没有隐藏重试。';
                displayResponse = `${displayResponse}\n\n${notice}`;
            }
        }

        if (displayResponse.includes('[SILENCE]')) {
            this.callbacks.onTyping?.(chatId, ai.id, false);
            return;
        }

        // Parse SCHEDULE first so control tags always take effect even when
        // optional conversational polish features (like recall simulation) run.
        const scheduleMatch = displayResponse.match(/\[SCHEDULE:(\d+)\]/);
        let cleanResponse = displayResponse;
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
            if (_turnContext.streamed) {
                this.callbacks.onMessage?.(chatId, cleanResponse, ai.id);
            } else {
                await this._simulateTypingAndSend(chatId, ai, cleanResponse);
            }
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

    _compactHistoryContent(content) {
        const text = String(content || '');
        if (text.startsWith('[IMG:')) return '[Image shared in chat]';
        if (text.startsWith('[STICKER:')) return '[Sticker shared in chat]';
        if (text.startsWith('[GIFT:')) return '[Gift shared in chat]';
        if (text.startsWith('[RED_PACKET:')) return '[Red packet shared in chat]';
        return text;
    }

    _prepareHistory(messages, personas, compressed, summary, polls, includeSpeakerNames = false) {
        const personaNameMap = new Map(personas.map(p => [p.id, p.name]));
        const selectedMessages = [];
        const prefixReserve = compressed && summary
            ? String(summary).length + 2
            : '[Previous chat context]'.length;
        let remainingChars = Math.max(1, MAX_HISTORY_CHARS - prefixReserve);
        for (const message of messages.slice(-MAX_HISTORY_MESSAGES).reverse()) {
            if (remainingChars <= 0) break;
            const original = this._compactHistoryContent(message?.content);
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

        if (compressed && summary) {
            if (history.length === 0) {
                history.push({ role: 'user', content: summary });
            } else if (history[0].role === 'user') {
                history[0] = {
                    ...history[0],
                    content: `${summary}\n\n${history[0].content}`,
                };
            } else {
                history.unshift({ role: 'user', content: summary });
            }
        } else if (history.length > 0 && history[0].role === 'assistant') {
            history.unshift({ role: 'user', content: '[Previous chat context]' });
        }

        return history;
    }

    _generateSystemPrompt(ai, context = null, memoryBlock = '', groupBlock = '') {
        const identity = ai.systemPrompt?.trim()
            || `You are ${ai.name}. Personality: ${ai.personality || 'helpful'}. Style: ${ai.style || 'natural'}.`;
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
        const latestUserText = context?.latestUserText || '';
        const outputLanguage = latestUserLanguage === 'en'
            ? 'English'
            : latestUserLanguage === 'zh'
                ? 'Simplified Chinese'
                : context?.preferredLanguage === 'en' ? 'English' : 'Simplified Chinese';
        const responseRules = [
            `Reply in ${outputLanguage} and stay in character.`,
            'For a concrete question, lead with the answer or action; then provide the reasoning, examples, code, or steps needed to complete the task.',
            this._wantsLongForm(latestUserText)
                ? 'The user requested depth; cover every requested deliverable completely, but do not restate the prompt or pad the answer after the requirements are satisfied.'
                : this._wantsBriefResponse(latestUserText)
                    ? 'The user requested brevity; answer directly without optional expansion.'
                    : 'Match the depth and format to the task; keep casual chat natural, but do not omit useful substance.',
            'Do not repeat the question or prefix the answer with your name.',
            'Return only the final user-facing response; never expose a scratchpad, chain-of-thought, or an analysis of the prompt.',
        ];
        if (CURRENT_INFORMATION_PATTERN.test(latestUserText) && !context?.plannedToolName) {
            responseRules.push('For time-sensitive facts without retrieved evidence, state what cannot be verified and point to the relevant official source; do not invent current details.');
        }
        if (groupBlock) {
            responseRules.push('In a group, reply only when relevant; output [SILENCE] when you should not answer.');
        }

        return [
            identity,
            relationshipHint.trim(),
            moodHint.trim(),
            memoryBlock.trim(),
            groupBlock.trim(),
            `TURN RULES:\n- ${responseRules.join('\n- ')}`,
        ].filter(Boolean).join('\n\n');
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
