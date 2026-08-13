/**
 * Token-efficient context and memory helpers.
 *
 * Memory capture is deliberately local and deterministic. A normal chat turn
 * must never spend a second LLM request just to remember what the user said.
 */

import { memoryStore } from './MemoryStore';

const COMPRESSION_THRESHOLD = 8;
const RECENT_WINDOW = 6;
const MAX_SUMMARY_SNIPPETS = 2;
const MAX_SUMMARY_SNIPPET_CHARS = 80;
const MAX_MEMORY_FACT_CHARS = 160;

const DURABLE_ZH_PATTERN = /(?:我.{0,10}(?:叫|名叫|住在|来自|工作|上班|生活|喜欢|爱|偏好|习惯|通常|每天|每周|工作日|周末|准备|计划|打算|担心|最离不开|睡|过敏)|(?:我家|家里|它|他|她).{0,32}(?:叫|名叫|住|来自|工作|公司|养|喜欢|爱|偏好|习惯|通常|每天|每周|工作日|周末|准备|计划|打算|担心|最离不开|换成|搬|睡|过敏|玩具))/;
const DURABLE_EN_PATTERN = /\b(?:my\s+\w+|i\s+(?:am|live|work|have|own|like|love|prefer|usually|always|never|plan|intend|want|worry))\b/i;
const DURABLE_ENTITY_PATTERN = /(?:猫|狗|宠物|孩子|伴侣|家人|cat|dog|pet).{0,24}(?:叫|喜欢|玩具|name|likes?|toy)/i;
const DO_NOT_REMEMBER_PATTERN = /(?:别记|不要记|别保存|不要保存|do not remember|don't remember|forget this)/i;

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
        || /[?？]/u.test(content)
    ) return false;
    return DURABLE_ZH_PATTERN.test(content)
        || DURABLE_EN_PATTERN.test(content)
        || DURABLE_ENTITY_PATTERN.test(content);
}

function compactDurableStatement(content) {
    const segments = content
        .split(/(?<=[。！？!?；;])/u)
        .map(segment => segment.trim())
        .filter(Boolean);
    const durable = segments.filter(segment => isDurableUserMessage(segment));
    return durable.join('');
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
export function extractLocalMemoryItems(messages = [], maxItems = 4) {
    if (!Array.isArray(messages) || maxItems <= 0) return [];

    const seen = new Set();
    const items = [];
    for (const message of messages) {
        if (message?.senderId !== 'user-me') continue;
        const content = normalizeText(message.content);
        const compact = truncateText(compactDurableStatement(content), MAX_MEMORY_FACT_CHARS);
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

    return items.slice(-maxItems);
}

/**
 * Persist user memories in IndexedDB only. Kept under the old async API name
 * so callers do not need a migration and, crucially, no provider is contacted.
 */
export async function extractMemoriesAsync(messages, characterId, characterName = characterId) {
    const items = extractLocalMemoryItems(messages, 4);
    if (items.length === 0) return 0;

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
 * Keep only a recent rolling window and a tightly capped extractive reminder.
 * Unlike the previous whitespace topic collector, this cannot copy entire
 * Chinese paragraphs into the prompt as a single "keyword".
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
 * Group memory is also local: one IndexedDB write path per participant and no
 * fan-out to language models.
 */
export async function extractGroupMemoriesAsync(messages, _chatId, aiParticipants) {
    if (!Array.isArray(aiParticipants) || aiParticipants.length === 0) return 0;
    const recentUserMessages = (messages || [])
        .filter((message) => message?.senderId === 'user-me')
        .slice(-4);

    const counts = await Promise.all(
        aiParticipants.map((ai) => extractMemoriesAsync(recentUserMessages, ai.id, ai.name))
    );
    return counts.reduce((sum, count) => sum + Number(count || 0), 0);
}
