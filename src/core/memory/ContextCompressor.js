/**
 * Token-efficient context and memory helpers.
 *
 * Memory capture is deliberately local and deterministic. A normal chat turn
 * must never spend a second LLM request just to remember what the user said.
 */

import { memoryStore } from './MemoryStore';
import { callAI } from '../../features/chat/services/chatService';

// Preserve a useful working conversation. Compression applies only after a
// substantial history has accumulated; the current user message is retained
// verbatim by AIPipeline's separate 100k-character history budget.
const COMPRESSION_THRESHOLD = 56;
const RECENT_WINDOW = 48;
const MAX_SUMMARY_SNIPPETS = 6;
const MAX_SUMMARY_SNIPPET_CHARS = 220;
const MAX_MEMORY_FACT_CHARS = 160;
const MAX_LOCAL_MEMORY_ITEMS = 8;

const DURABLE_ZH_PATTERN = /(?:我.{0,10}(?:叫|名叫|住在|来自|工作|上班|生活|喜欢|爱|偏好|习惯|通常|每天|每周|工作日|周末|准备|计划|打算|担心|最离不开|睡|过敏)|(?:我家|家里|它|他|她).{0,32}(?:叫|名叫|住|来自|工作|公司|养|喜欢|爱|偏好|习惯|通常|每天|每周|工作日|周末|准备|计划|打算|担心|最离不开|换成|搬|睡|过敏|玩具))/;
const DURABLE_EN_PATTERN = /\b(?:my\s+\w+|i\s+(?:am|live|work|have|own|like|love|prefer|usually|always|never|plan|intend|want|worry))\b/i;
const DURABLE_ENTITY_PATTERN = /(?:(?:猫|狗|宠物|孩子|伴侣|家人|cat|dog|pet).{0,24}(?:叫|喜欢|玩具|name|likes?|toy)|(?:叫|名叫|named).{0,20}(?:猫|狗|宠物|cat|dog|pet))/i;
const DURABLE_EVENT_PATTERN = /(?:(?:\d{1,2}月\d{1,2}日|今天|明天|后天|下周|下个月|月底|年底).{0,28}(?:从|搬|去|到|出发|开始|结束)|(?:会|将|准备|计划|打算).{0,24}(?:带|搬|去|到|开始|结束)|(?:会带|带着|养(?:了)?|有一只).{0,24}(?:猫|狗|宠物))/u;
const DO_NOT_REMEMBER_PATTERN = /(?:别记|不要记|别保存|不要保存|do not remember|don't remember|forget this)/i;
const RECALL_QUERY_PATTERN = /(?:还记得|你记得|记得我的|不要猜.{0,12}(?:告诉|回答)|逐项(?:告诉|回答)|(?:告诉|回答)我.{0,20}(?:名字|时间|日期|偏好)|do you remember|tell me (?:my|what))/i;

// Pure greetings/pleasantries never carry durable facts. Running the AI
// extraction for them would spend an extra provider call for nothing, so
// they skip both the AI path and the regex fallback entirely.
const TRIVIAL_SMALL_TALK_PATTERN = /^(?:嗨+|哈喽+|嘿+|你好[呀啊吖]?|您好[呀啊吖]?|早上好|中午好|下午好|晚上好|早安|晚安|在吗|在么| hi+|hello+|hey+|yo+|hiya|howdy|good\s*(?:morning|afternoon|evening))\s*[!！。．.~～?？]*$/i;

/**
 * AI extraction is an optional enhancement over the deterministic regex
 * path: when the configured gateway is unreachable or answers garbage,
 * extraction silently falls back to `extractLocalMemoryItems`.
 */
const AI_MEMORY_EXTRACTION_ENABLED = true;
const AI_MEMORY_FACT_CHARS = 160;
const AI_MEMORY_MAX_FACTS = 8;
const AI_MEMORY_CATEGORIES = new Set(['fact', 'preference', 'event']);

const AI_MEMORY_SYSTEM_PROMPT = [
    'You extract durable, long-term-user facts from one chat message. Reply with JSON only:',
    '{"facts":[{"fact":"...","importance":5,"category":"fact|preference|event"}]}',
    'Rules: keep the user\'s original wording inside fact; only durable facts (identity, family, pets, preferences, plans, recurring habits);',
    'no transient tasks, no questions, no small talk; importance 1-9; return {"facts":[]} when nothing qualifies. Never invent facts.',
].join(' ');

function normalizeText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncateText(value, maxChars) {
    const chars = Array.from(normalizeText(value));
    if (chars.length <= maxChars) return chars.join('');
    return `${chars.slice(0, Math.max(1, maxChars - 1)).join('')}…`;
}

function isDurableUserMessage(content) {
    if (
        !content
        || content.startsWith('[')
        || DO_NOT_REMEMBER_PATTERN.test(content)
        || RECALL_QUERY_PATTERN.test(content)
        || /[?？]/u.test(content)
    ) return false;
    return DURABLE_ZH_PATTERN.test(content)
        || DURABLE_EN_PATTERN.test(content)
        || DURABLE_ENTITY_PATTERN.test(content)
        || DURABLE_EVENT_PATTERN.test(content);
}

function extractDurableSegments(content) {
    return content
        .split(/(?<=[。！？!?；;])/u)
        .map(segment => segment.trim())
        .filter(segment => isDurableUserMessage(segment));
}

function classifyMemory(content) {
    if (/(?:喜欢|爱|偏好|不喜欢|想要|安静|prefer|like|love|dislike)/i.test(content)) {
        return 'preference';
    }
    if (/(?:准备|计划|打算|月底|最近|搬|将要|plan|intend|moving|recently)/i.test(content)) {
        return 'event';
    }
    return 'fact';
}

function scoreImportance(content) {
    let importance = 5;
    if (/(?:叫|名叫|搬|住|来自|公司|工作日|每天|家人|孩子|伴侣|猫|狗|宠物|named|moving|live|work)/i.test(content)) {
        importance += 2;
    }
    if (/(?:担心|最离不开|过敏|必须|never|allergic|worry)/i.test(content)) {
        importance += 1;
    }
    return Math.min(9, importance);
}

/**
 * Select compact, durable user statements suitable for long-term recall.
 * The original wording is retained to avoid inventing facts locally.
 */
export function extractLocalMemoryItems(messages = [], maxItems = MAX_LOCAL_MEMORY_ITEMS) {
    if (!Array.isArray(messages) || maxItems <= 0) return [];

    const seen = new Set();
    const items = [];
    for (const message of messages) {
        if (message?.senderId !== 'user-me') continue;
        const content = normalizeText(message.content);
        for (const segment of extractDurableSegments(content)) {
            const compact = truncateText(segment, MAX_MEMORY_FACT_CHARS);
            if (!compact) continue;
            const dedupeKey = compact.toLocaleLowerCase();
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);

            items.push({
                fact: `用户曾说：“${compact}”`,
                importance: scoreImportance(compact),
                category: classifyMemory(compact),
            });
        }
    }

    return items.slice(-maxItems);
}

/**
 * True when the message is pure greeting/pleasantries: nothing durable
 * can be learned, so both extraction paths are skipped and — crucially —
 * no extra provider request is spent.
 */
export function isTrivialSmallTalk(content) {
    const normalized = normalizeText(content);
    if (!normalized || normalized.length > 24) return false;
    return TRIVIAL_SMALL_TALK_PATTERN.test(normalized);
}

function parseAiMemoryFacts(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const fenced = raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = (fenced ? fenced[1] : raw).trim();
    let parsed;
    try {
        parsed = JSON.parse(candidate);
    } catch (err) {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.facts)) {
        return null;
    }
    const items = [];
    const seen = new Set();
    for (const entry of parsed.facts) {
        if (!entry || typeof entry !== 'object') continue;
        const fact = truncateText(String(entry.fact || ''), AI_MEMORY_FACT_CHARS);
        if (!fact) continue;
        const key = fact.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const importance = Number.isFinite(Number(entry.importance))
            ? Math.min(9, Math.max(1, Math.round(Number(entry.importance))))
            : 5;
        const category = AI_MEMORY_CATEGORIES.has(entry.category)
            ? entry.category
            : 'fact';
        items.push({ fact, importance, category });
    }
    return items;
}

/**
 * Optional AI extraction path: hand the latest user message plus the
 * memories already stored to the model gateway (the server's free
 * nemotron route via the same proxy the chat itself uses) and accept
 * well-formed new-fact JSON. Any failure — missing key, timeout, garbage
 * shape — resolves to null so the caller silently falls back to the
 * deterministic regex path.
 */
async function extractMemoryItemsViaAi(latestText, characterId) {
    const existing = await memoryStore.getFactsByCharacter(characterId);
    const existingBlock = (existing || [])
        .slice(0, 20)
        .map((memory) => `- ${memory.fact}`)
        .join('\n') || '(none yet)';
    const prompt = [
        'Existing memories about this user (do not repeat them):',
        existingBlock,
        '',
        'Latest user message:',
        latestText,
    ].join('\n');

    const raw = await callAI(
        [{ role: 'user', content: prompt }],
        {
            systemPrompt: AI_MEMORY_SYSTEM_PROMPT,
            maxTokens: 400,
            temperature: 0.1,
            disableReasoning: true,
            agentId: 'memory-extraction',
        },
    );
    if (!raw) return null;
    return parseAiMemoryFacts(raw);
}

/**
 * Resolve the memory items for one turn: AI extraction first (when
 * enabled and the message could carry facts), deterministic regex
 * extraction as the silent fallback.
 */
async function resolveMemoryItems(messages, characterId) {
    const latestUserMessage = [...(Array.isArray(messages) ? messages : [])]
        .reverse()
        .find((message) => message?.senderId === 'user-me');
    const latestText = normalizeText(latestUserMessage?.content);
    if (!latestText) return [];
    if (
        isTrivialSmallTalk(latestText)
        || DO_NOT_REMEMBER_PATTERN.test(latestText)
    ) {
        return [];
    }

    if (AI_MEMORY_EXTRACTION_ENABLED) {
        try {
            const aiItems = await extractMemoryItemsViaAi(latestText, characterId);
            // A well-formed AI answer is authoritative — even when it
            // reports no durable facts. Only a failure (null) falls back.
            if (aiItems !== null) return aiItems.slice(-MAX_LOCAL_MEMORY_ITEMS);
        } catch (err) {
            // Silent fallback: extraction must never break the chat turn.
        }
    }

    return extractLocalMemoryItems(messages, MAX_LOCAL_MEMORY_ITEMS);
}

/** Persist resolved items into one character's local memory store. */
async function captureMemoryItems(items, characterId, characterName = characterId) {
    if (!Array.isArray(items) || items.length === 0) return 0;

    let saved = 0;
    for (const item of items) {
        const id = await memoryStore.saveFact(
            characterId,
            item.fact,
            item.importance,
            item.category
        );
        if (id) saved += 1;
    }

    if (saved > 0) {
        console.log(`[ContextCompressor] Saved ${saved} local memories for ${characterName}`);
    }
    return saved;
}

/**
 * Persist user memories in IndexedDB only. Kept under the historical
 * async API name so callers do not need a migration. The optional AI
 * extraction path (one bounded provider call) runs first; the original
 * deterministic regex extraction remains the silent fallback.
 */
export async function extractMemoriesAsync(messages, characterId, characterName = characterId) {
    const items = await resolveMemoryItems(messages, characterId);
    return captureMemoryItems(items, characterId, characterName);
}

/**
 * Keep a substantial recent rolling window plus a bounded extractive reminder
 * for older user turns. Unlike the previous whitespace topic collector, this
 * cannot copy an unlimited Chinese paragraph into a single "keyword".
 */
export function compressContext(messages, _personas = []) {
    if (!Array.isArray(messages) || messages.length <= COMPRESSION_THRESHOLD) {
        return { compressed: false, messages: messages || [] };
    }

    const oldMessages = messages.slice(0, -RECENT_WINDOW);
    const recentMessages = messages.slice(-RECENT_WINDOW);
    const snippets = oldMessages
        .filter((message) => message?.senderId === 'user-me')
        .slice(-MAX_SUMMARY_SNIPPETS)
        .map((message) => truncateText(message.content, MAX_SUMMARY_SNIPPET_CHARS))
        .filter(Boolean);

    const summary = snippets.length > 0
        ? `[Earlier user context: ${snippets.join(' | ')}]`
        : '[Earlier conversation omitted to keep this request compact.]';

    return { compressed: true, summary, recentMessages };
}

/**
 * Group memory is also local: one IndexedDB write path per participant.
 * Extraction (AI or regex) runs at most once per turn and the resolved
 * items are shared by every participant, so a group turn never fans out
 * to one provider call per character.
 */
export async function extractGroupMemoriesAsync(messages, _chatId, aiParticipants) {
    if (!Array.isArray(aiParticipants) || aiParticipants.length === 0) return 0;
    const recentUserMessages = (messages || [])
        .filter((message) => message?.senderId === 'user-me')
        .slice(-4);
    if (recentUserMessages.length === 0) return 0;

    const items = await resolveMemoryItems(recentUserMessages, aiParticipants[0].id);
    if (items.length === 0) return 0;

    const counts = await Promise.all(
        aiParticipants.map((ai) => captureMemoryItems(items, ai.id, ai.name))
    );
    return counts.reduce((sum, count) => sum + Number(count || 0), 0);
}
