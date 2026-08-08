/**
 * Service for handling AI interactions and API calls for the Chat feature.
 * Uses centralized APIClient for HTTP requests.
 */

import { getAIClient, getAIConfiguration } from '../../../services/api/aiClient';

function toTextContent(value) {
    if (typeof value === 'string') return value;
    if (!value) return '';

    if (Array.isArray(value)) {
        return value
            .map(item => toTextContent(item))
            .filter(Boolean)
            .join('');
    }

    if (typeof value === 'object') {
        if (typeof value.text === 'string') return value.text;
        if (typeof value.content === 'string') return value.content;
        if (typeof value.output_text === 'string') return value.output_text;
    }

    return '';
}

function extractAssistantContent(data) {
    const choice = data?.choices?.[0];
    const msg = choice?.message;

    const candidates = [
        msg?.content,
        choice?.text,
        choice?.delta?.content,
        data?.output_text,
        msg?.reasoning_content,
    ];

    for (const candidate of candidates) {
        const text = toTextContent(candidate).trim();
        if (text) return text;
    }

    // OpenAI Responses-style fallback for compatible gateways.
    if (Array.isArray(data?.output)) {
        const outputText = data.output
            .map((item) => {
                const direct = toTextContent(item?.content);
                if (direct) return direct;
                if (Array.isArray(item?.content)) {
                    return item.content.map(part => toTextContent(part)).join('');
                }
                return '';
            })
            .join('')
            .trim();
        if (outputText) return outputText;
    }

    return '';
}

function extractToolCallMarker(data) {
    const choice = data?.choices?.[0];
    const msg = choice?.message;
    const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : null;
    const functionCall = msg?.function_call || null;

    if (toolCalls && toolCalls.length > 0) {
        return `[TOOL_CALL_NATIVE:${JSON.stringify(toolCalls)}]`;
    }

    if (functionCall) {
        return `[TOOL_CALL_NATIVE:${JSON.stringify([{ type: 'function', function: functionCall }])}]`;
    }

    return null;
}

function extractDeltaContent(data) {
    const choice = data?.choices?.[0];
    if (!choice) return '';
    const delta = choice.delta || {};
    return toTextContent(delta.content || delta.text || '');
}

async function parseSSEStream(response, onDelta, options = {}) {
    const reader = response.body?.getReader?.();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let nativeToolCalls = null;
    const timeoutMs = options.timeout || 120000; // 120秒默认超时
    const abortController = new AbortController();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
        timedOut = true;
        abortController.abort();
        if (reader.cancel) {
            reader.cancel(new Error('SSE stream timeout'));
        }
    }, timeoutMs);

    try {
        while (true) {
            if (timedOut) {
                console.warn('[SSE] Stream timed out after', timeoutMs, 'ms');
                break;
            }
            const { value, done } = await reader.read();
            if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';

        for (const event of events) {
            const dataLines = event
                .split(/\r?\n/)
                .filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).trim());

            if (dataLines.length === 0) continue;
            const dataPayload = dataLines.join('\n');

            if (dataPayload === '[DONE]') {
                continue;
            }

            try {
                const json = JSON.parse(dataPayload);
                const delta = extractDeltaContent(json);
                if (delta) {
                    fullText += delta;
                    onDelta?.(delta, fullText, json);
                }

                const marker = extractToolCallMarker(json);
                if (marker) {
                    nativeToolCalls = marker;
                }
            } catch {
                // Ignore malformed SSE frames from intermediate providers.
            }
        }
        }
    } catch (error) {
        if (!timedOut) {
            console.warn('[SSE] Stream error:', error);
        }
    } finally {
        clearTimeout(timeoutId);
    }

    // Flush remaining bytes from decoder (buffer not needed after stream ends)
    decoder.decode();

    if (!fullText && nativeToolCalls) return nativeToolCalls;
    return fullText.trim() || null;
}

async function parseResponseBody(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function buildCompletionEndpoints(baseURL = '') {
    const endpoints = ['/chat/completions'];
    const normalized = String(baseURL || '').trim().replace(/\/+$/, '');

    // If base URL has no explicit API version, try /v1 fallback for
    // OpenAI-compatible providers that require it.
    if (
        normalized &&
        !/\/v\d+$/i.test(normalized) &&
        !/\/chat\/completions$/i.test(normalized)
    ) {
        endpoints.push('/v1/chat/completions');
    }

    return endpoints;
}

/**
 * Call the AI API with the given messages history
 * @param {Array} messages - List of message objects {role, content}
 * @param {Object} options - Optional configuration for the API call
 * @param {string} options.systemPrompt - Custom system prompt for specialized agents
 * @param {string} options.agentId - Agent ID for logging/tracking
 * @param {number} options.maxTokens - Maximum tokens for response (default: 150, task agents: 500)
 * @param {number} options.temperature - Response temperature (default: 0.8)
 * @returns {Promise<string|null>} - The AI response content or null if failed
 */
export async function callAI(messages, options = {}) {
    const aiClient = getAIClient();
    const config = getAIConfiguration();

    if (!config.apiKey) {
        console.error('AI API Key not configured. Set VITE_AI_API_KEY in .env');
        return null;
    }

    // Build messages array with optional system prompt
    let apiMessages = [...messages];

    // Prepend system prompt if provided (for specialized task agents)
    if (options.systemPrompt) {
        // Check if there's already a system message at the start
        if (apiMessages.length > 0 && apiMessages[0].role === 'system') {
            // Enhance existing system message
            apiMessages[0] = {
                role: 'system',
                content: options.systemPrompt + '\n\n---\n\n' + apiMessages[0].content
            };
        } else {
            // Add new system message at the beginning
            apiMessages.unshift({
                role: 'system',
                content: options.systemPrompt
            });
        }
    }

    // Configure tokens and model based on options
    // REMOVED: Default token limits. Let the model/provider decide the limit to prevent truncation.
    const maxTokens = options.maxTokens;
    const temperature = options.temperature ?? 0.8;
    // Allow overriding model (e.g. for Perplexity Sonar search)
    const selectedModel = options.model || config.model;

    const requestBody = {
        model: selectedModel,
        messages: apiMessages,
        temperature: temperature
    };

    if (maxTokens) {
        requestBody.max_tokens = maxTokens;
    }

    if (Array.isArray(options.tools) && options.tools.length > 0) {
        requestBody.tools = options.tools;
    }

    if (options.toolChoice) {
        requestBody.tool_choice = options.toolChoice;
    } else if (options.tool_choice) {
        requestBody.tool_choice = options.tool_choice;
    }

    if (options.stream) {
        requestBody.stream = true;
    }

    try {
        const endpoints = buildCompletionEndpoints(aiClient.baseURL);

        for (let i = 0; i < endpoints.length; i++) {
            const endpoint = endpoints[i];
            const response = await aiClient.post(endpoint, requestBody);
            let data = null;

            if (!response.ok) {
                data = await parseResponseBody(response);
                // Retry with /v1 only on obvious route mismatch.
                if ((response.status === 404 || response.status === 405) && i < endpoints.length - 1) {
                    continue;
                }
                const msg = data?.error?.message || `HTTP ${response.status}`;
                console.error('API Error:', msg, options.agentId ? `(Agent: ${options.agentId})` : '');
                return null;
            }

            if (options.stream && response.headers?.get?.('content-type')?.includes('text/event-stream')) {
                const streamed = await parseSSEStream(response, options.onStreamChunk);
                if (streamed) return streamed;
            }

            data = await parseResponseBody(response);

            if (data?.error) {
                console.error('API Error:', data.error, options.agentId ? `(Agent: ${options.agentId})` : '');
                return null;
            }

            const content = extractAssistantContent(data);
            if (content) {
                return content.trim();
            }

            const toolCallMarker = extractToolCallMarker(data);
            if (toolCallMarker) {
                return toolCallMarker;
            }

            // Endpoint is reachable but payload has no usable content.
            return null;
        }

        return null;
    } catch (error) {
        console.error('API Call Failed:', error, options.agentId ? `(Agent: ${options.agentId})` : '');
        return null;
    }
}

/**
 * Clean tool markers from message content
 * @param {string} content - Raw AI response
 * @returns {string} - Cleaned content for display
 */
export function cleanMessageContent(content) {
    if (!content) return '';
    let cleaned = content;

    // Remove MULTI tags with all content (greedy within the tag)
    cleaned = cleaned.replace(/\[(?:MULTI|Multi|multi):[^\]]*\]/gi, '');

    // Remove SCHEDULE tags
    cleaned = cleaned.replace(/\[SCHEDULE:\s*\d+\s*\]/gi, '');

    // Handle REACT tags - extract just the emoji content
    cleaned = cleaned.replace(/\[REACT:\s*([^\]]*)\]/gi, (match, emoji) => {
        return emoji ? ` ${emoji.trim()}` : '';
    });

    // Remove SILENCE markers
    cleaned = cleaned.replace(/\[SILENCE\]/gi, '');

    // Remove reference patterns like [1], [2], [R1].
    cleaned = cleaned.replace(/\[(?:\d+|R\d+)\]/g, '');

    // Remove stray closing brackets (possibly orphaned)
    cleaned = cleaned.replace(/\]\]/g, ']');
    cleaned = cleaned.replace(/\]\s*$/g, '');
    cleaned = cleaned.replace(/^\s*\[?\]/g, '');

    // Transform GAME:Poll messages for AI context instead of removing them
    cleaned = cleaned.replace(/\[GAME:Poll:\s*(.+?)\]/gi, (match, question) => {
        return `System: A poll has been created: "${question}". Please vote for an option.`;
    });

    // Note: [POLL:ID] messages are kept as is, handled in context preparation

    // Remove any remaining [...] patterns that look like tool markers
    // Match patterns like [Something:...] or [snake_case:...]
    // UPDATED: Allow lowercase keys for tools like [immersive_translate:...]
    cleaned = cleaned.replace(/\[[a-zA-Z0-9_]+:[^\]]*\]/g, '');
    cleaned = cleaned.replace(/\[[A-Z]{2,}\]/g, '');

    // Clean up pipe characters ONLY if surrounded by single spaces (MULTI tag remnants)
    // Preserve pipes at line start/end which are table delimiters
    // DISABLED: This was breaking markdown tables. Better to leave pipes alone.
    // cleaned = cleaned.replace(/\s*\|\s*/g, ' ');

    // Clean up double or triple HORIZONTAL spaces only (preserve newlines for Markdown)
    cleaned = cleaned.replace(/[^\S\n]{2,}/g, ' ');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Calculate typing delay based on message length and typing speed
 * @param {number} messageLength 
 * @param {string} typingSpeed - 'slow', 'normal', 'fast'
 * @returns {number} delay in ms
 */
export function calculateTypingDelay(messageLength, typingSpeed) {
    const baseCharsPerSecond = {
        slow: 3,
        normal: 5,
        fast: 8
    };
    const charsPerSecond = baseCharsPerSecond[typingSpeed] || 5;
    return Math.min(3000, Math.max(500, (messageLength / charsPerSecond) * 1000));
}

/**
 * Calculate random delay within range
 * @param {Object} delayConfig - { min, max }
 * @returns {number} delay in ms
 */
export function getRandomDelay(delayConfig) {
    const { min, max } = delayConfig;
    return min + Math.random() * (max - min);
}
