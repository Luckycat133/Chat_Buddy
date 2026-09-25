/**
 * AI generation service: the missing link between the prompt compiler
 * (`server/runtime/prompts/compiler.ts`) and the model gateway.
 *
 * Flow: user message accepted → for each active `character` member,
 * compile the 10-section prompt, call the gateway, parse the JSON
 * envelope (falling back to plain text), and insert reply messages in
 * one transaction with correct sequences/bursts plus world_events.
 *
 * Invariants (DOMAIN_ARCHITECTURE §10-§11):
 *   - Generation never runs for hidden AI conversations (their writes
 *     come from the hidden worker only).
 *   - Failures are logged and swallowed; they must never fail the user
 *     request that triggered them.
 */
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  actors,
  conversationMembers,
  conversations,
  messageBursts,
  memoryItems,
  messages,
  toolExecutions,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import { MessageKind, MessageStatus, ToolExecutionStatus } from '../../shared/contracts/enums.js';
import { ActionEnvelopeSchema } from '../runtime/actions/envelope.js';
import { compilePrompt, resolveWeatherState } from '../runtime/prompts/compiler.js';
import { fetchWeather } from '../capabilities/index.js';
import {
  createChatCompletion,
  DEFAULT_GATEWAY_MODEL,
  ModelGatewayError,
  ModelGatewayErrorCode,
  type ChatCompletionResult,
} from './model-gateway.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

interface EnvelopeMessages {
  messages?: unknown;
  /** Some models put the whole reply here instead of messages[]. */
  message?: unknown;
}

interface EnvelopeMessageEntry {
  text?: unknown;
  content?: unknown;
}

/**
 * Split one long plain-text reply into multiple chat bubbles, the way a
 * real person texts: blank-line separated thoughts become their own
 * bubbles; a single wall-of-text is split at sentence boundaries into at
 * most 3 parts. Short replies stay untouched.
 */
export function splitPlainReplyIntoBubbles(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length <= 1) {
    const single = paragraphs[0] ?? text.trim();
    // One dense block: split at sentence enders only when it reads long.
    if (single.length <= 44) return single.length > 0 ? [single] : [];
    const sentences = single.match(/[^。！？!?～….]+[。！？!?～….]+\s*|[^。！？!?～….]+$/g) ?? [single];
    if (sentences.length < 2) return [single];
    const parts: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      if (current && (current + sentence).length > 44) {
        parts.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts.slice(0, 3);
  }
  return paragraphs.slice(0, 4);
}

/**
 * Best-effort parse of the JSON envelope the output schema requests.
 * Accepts `{text}` or `{content}` string fields per message; anything
 * not matching falls back to plain text split into chat bubbles.
 */
export function parseReplyContent(content: string): string[] {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : trimmed;
  if (candidate.startsWith('{')) {
    try {
      const parsed = JSON.parse(candidate) as EnvelopeMessages;
      if (Array.isArray(parsed.messages)) {
        const texts = parsed.messages
          .filter(
            (m): m is string | EnvelopeMessageEntry =>
              typeof m === 'string' ||
              (typeof m === 'object' &&
                m !== null &&
                (typeof (m as EnvelopeMessageEntry).text === 'string' ||
                  typeof (m as EnvelopeMessageEntry).content === 'string')),
          )
          .map((m) => {
            if (typeof m === 'string') return m;
            const t =
              typeof m.text === 'string'
                ? m.text
                : typeof m.content === 'string'
                  ? m.content
                  : '';
            return t.trim();
          })
          .filter((t) => t.length > 0);
        if (texts.length > 0) return texts;
      }
      if (
        typeof parsed.message === 'string' &&
        parsed.message.trim().length > 0
      ) {
        return [parsed.message.trim()];
      }
    } catch {
      // fall through to plain text
    }
  }
  return splitPlainReplyIntoBubbles(trimmed);
}

/**
 * Drop model replies that exactly echo a message already in the burst.
 * Some models restate the user's line as the first envelope entry.
 */
export function filterEchoedReplies(
  texts: string[],
  burstContents: string[],
): string[] {
  const seen = new Set(burstContents.map((c) => c.trim()));
  return texts.filter((t) => !seen.has(t.trim()));
}

function buildSystemPrompt(sections: {
  persona: string;
  actorState: string;
  relationship: string;
  memories: string;
  socialContext: string;
  capabilities: string;
  outputSchema: string;
  productPolicy: string;
}): string {
  return [
    sections.persona,
    sections.actorState,
    sections.relationship,
    sections.memories,
    sections.socialContext,
    sections.capabilities,
    sections.outputSchema,
    sections.productPolicy,
    'Always reply in the same language as the user\'s most recent message.',
  ]
    .filter((s) => s.length > 0)
    .join('\n\n');
}

function buildUserPrompt(sections: {
  burst: string;
  recentEvents: string;
}): string {
  return [sections.burst, sections.recentEvents]
    .filter((s) => s.length > 0)
    .join('\n\n');
}

async function openOrExtendBurst(
  tx: Tx,
  conversationId: string,
  senderActorId: string,
  sequence: number,
): Promise<string> {
  const [open] = await tx
    .select()
    .from(messageBursts)
    .where(
      and(
        eq(messageBursts.conversationId, conversationId),
        eq(messageBursts.senderActorId, senderActorId),
        sql`${messageBursts.closedAt} IS NULL`,
      ),
    )
    .orderBy(sql`${messageBursts.openedAt} DESC`)
    .limit(1);
  if (open) {
    await tx
      .update(messageBursts)
      .set({ lastMessageSequence: sequence })
      .where(eq(messageBursts.id, open.id));
    return open.id;
  }
  const id = newId<string>();
  await tx.insert(messageBursts).values({
    id,
    conversationId,
    senderActorId,
    firstMessageSequence: sequence,
    lastMessageSequence: sequence,
    openedAt: new Date(),
  });
  return id;
}

const ToolRequestsSchema = z.object({
  tool_requests: z
    .array(
      z.object({
        toolName: z.string().min(1).max(64),
        arguments: z.record(z.unknown()).default({}),
      }),
    )
    .max(8)
    .optional(),
});

/**
 * Parse the (optionally fenced) JSON envelope object out of a completion.
 * Returns null when the content is not a JSON object envelope. Shared by
 * the tool-request and memory-patch extractors so both see identical
 * tolerance rules.
 */
function parseEnvelopeObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : trimmed;
  if (!candidate.startsWith('{')) return null;
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Best-effort extraction of the model's tool requests from a completion.
 * Never throws: a completion without a parsable JSON envelope simply has
 * no tool requests (plain-text replies stay the dominant path).
 */
export function extractToolRequests(
  content: string,
): Array<{ toolName: string; arguments: Record<string, unknown> }> {
  const envelope = parseEnvelopeObject(content);
  if (!envelope) return [];
  try {
    const parsed = ToolRequestsSchema.parse(envelope);
    return parsed.tool_requests ?? [];
  } catch {
    return [];
  }
}

/* --------------------- send_message tool (§7.4) ----------------------- */

/** Tool name for the model-visible reply path. */
export const SEND_MESSAGE_TOOL_NAME = 'send_message';

/** Per-bubble text ceiling (code points). */
export const MAX_SEND_MESSAGE_TEXT_CHARS = 2000;

/** Inclusive bounds of the typing-rhythm hint. */
export const MAX_SEND_DELAY_MS = 3000;

/** Upper bound of tool-called bubbles per turn (mirrors the envelope's
 *  messages cap of 8). */
const MAX_BUBBLES_PER_TURN = 8;

/**
 * The model-visible `send_message` tool. One call = one chat bubble; a
 * reply may call it several times. The runtime re-validates every call
 * (schema is a politeness contract, not a security boundary).
 */
export const SEND_MESSAGE_TOOL = {
  type: 'function',
  function: {
    name: SEND_MESSAGE_TOOL_NAME,
    description:
      'Send one chat bubble to the conversation. Prefer 1-3 short bubbles per turn; call the tool once per bubble.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          minLength: 1,
          maxLength: MAX_SEND_MESSAGE_TEXT_CHARS,
          description:
            "The bubble text, in the user's language. At most 2000 characters.",
        },
        send_delay_ms: {
          type: 'integer',
          minimum: 0,
          maximum: MAX_SEND_DELAY_MS,
          description:
            'Optional typing-rhythm hint in milliseconds (0-3000). The runtime only uses it to pace bubble timestamps; it never blocks the transaction.',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
} as const;

/** Tool definitions forwarded with every generation request. */
export const SEND_MESSAGE_TOOLS: ReadonlyArray<unknown> = [SEND_MESSAGE_TOOL];

const SendMessageArgsSchema = z.object({
  text: z.string(),
  send_delay_ms: z.number().optional(),
});

export interface SendMessageBubble {
  text: string;
  /** Clamped typing-rhythm hint (0-3000ms). */
  sendDelayMs: number;
}

function clampBubbleText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  const chars = Array.from(trimmed);
  if (chars.length <= MAX_SEND_MESSAGE_TEXT_CHARS) return trimmed;
  return `${chars.slice(0, MAX_SEND_MESSAGE_TEXT_CHARS - 1).join('')}…`;
}

function clampSendDelayMs(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.min(MAX_SEND_DELAY_MS, Math.max(0, Math.round(raw)));
}

/**
 * Server-authoritative parsing of native `send_message` tool calls.
 * Malformed arguments skip that one bubble; oversized text is truncated;
 * out-of-range delays are clamped. Never throws.
 */
export function parseSendMessageToolCalls(
  completion: ChatCompletionResult,
): SendMessageBubble[] {
  const calls = completion.toolCalls ?? [];
  const bubbles: SendMessageBubble[] = [];
  for (const call of calls) {
    if (call.name !== SEND_MESSAGE_TOOL_NAME) continue;
    let args: unknown;
    try {
      args = JSON.parse(call.arguments.length > 0 ? call.arguments : '{}');
    } catch {
      continue;
    }
    const parsed = SendMessageArgsSchema.safeParse(args);
    if (!parsed.success) continue;
    const text = clampBubbleText(parsed.data.text);
    if (!text) continue;
    bubbles.push({
      text,
      sendDelayMs: clampSendDelayMs(parsed.data.send_delay_ms),
    });
  }
  return bubbles.slice(0, MAX_BUBBLES_PER_TURN);
}

/* -------------------- memory_patches persistence ---------------------- */

/** Element schema of the shared §7.5 action envelope (single source of
 *  truth for patch validation). */
const MemoryPatchSchema = ActionEnvelopeSchema.shape.memory_patches.element;
export type MemoryPatchInput = z.infer<typeof MemoryPatchSchema>;

export interface MemoryPatchExtraction {
  accepted: MemoryPatchInput[];
  /** Patches dropped by schema validation or authorization. */
  rejected: number;
}

function proposesOwnPolicy(
  policy: Record<string, unknown> | undefined,
): boolean {
  return policy !== undefined && Object.keys(policy).length > 0;
}

/**
 * Extract `memory_patches` from a completion's JSON envelope. Each patch
 * is validated against the shared ActionEnvelopeSchema element; patches
 * that try to bring their own share/visibility policy are REJECTED
 * (§4.19: widening memory access is a human-owner decision, never a
 * model decision). Duplicates within one reply collapse by normalized
 * objective fact. Never throws.
 */
export function extractMemoryPatches(content: string): MemoryPatchExtraction {
  const envelope = parseEnvelopeObject(content);
  const raw = envelope?.['memory_patches'];
  if (!Array.isArray(raw)) return { accepted: [], rejected: 0 };

  const accepted: MemoryPatchInput[] = [];
  let rejected = 0;
  for (const candidate of raw.slice(0, 16)) {
    const parsed = MemoryPatchSchema.safeParse(candidate);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    if (
      proposesOwnPolicy(parsed.data.sharePolicy) ||
      proposesOwnPolicy(parsed.data.visibilityPolicy)
    ) {
      // Authorization rejection: the model may record what it observed,
      // but never decide who else may see it.
      rejected += 1;
      continue;
    }
    accepted.push(parsed.data);
  }

  const seen = new Set<string>();
  const deduped = accepted.filter((patch) => {
    const key = patch.objectiveFact.trim().replace(/\s+/g, ' ').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Duplicates are quiet drops (去重), not rejections (拒绝).
  return { accepted: deduped, rejected };
}

/** Tool name for the §19 weather capability. */
const WEATHER_TOOL_NAME = 'weather';

/**
 * Locate the weather request in a completion: either a legacy envelope
 * `tool_requests` entry or a native OpenAI-shaped tool call.
 */
function findWeatherRequest(
  completion: ChatCompletionResult,
): { toolName: string; arguments: Record<string, unknown> } | null {
  const fromEnvelope = extractToolRequests(completion.content).find(
    (r) => r.toolName.toLowerCase() === WEATHER_TOOL_NAME,
  );
  if (fromEnvelope) return fromEnvelope;
  const native = (completion.toolCalls ?? []).find(
    (c) => c.name.toLowerCase() === WEATHER_TOOL_NAME,
  );
  if (!native) return null;
  let args: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(
      native.arguments.length > 0 ? native.arguments : '{}',
    );
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      args = parsed as Record<string, unknown>;
    }
  } catch {
    // Empty arguments are valid (server falls back to the default city).
  }
  return { toolName: native.name, arguments: args };
}

const WEATHER_TOOL_HINT_ENABLED =
  'Use this real tool result to answer the user\'s latest message now, in character. Never invent data that is not in the result.';

const WEATHER_TOOL_HINT_BLOCKED =
  'The weather tool could not provide data. Answer naturally in character: acknowledge it briefly and, when the capability is not enabled, invite the user to enable the weather capability in this app\'s settings (and to tell you their default city). Never invent weather data and never send the user to a system or third-party weather app.';

/**
 * One bounded weather tool round (WEB_IMPLEMENTATION §19).
 *
 * When the model's completion requests the weather tool, the runtime —
 * not the model — decides whether it may run: the capability executes
 * only when a human member of the conversation has enabled weather
 * (recorded consent; fail-closed otherwise). On execution the REAL
 * provider result is fed back for a final answer; on refusal or failure
 * the model is told the truthful status and answers with guidance. Never
 * fabricates data, never leaks provider errors as fake success.
 *
 * Returns the final reply bubbles, or null when no weather request was
 * made (caller keeps the original completion's replies) or the follow-up
 * call failed (caller keeps the original replies rather than dropping
 * the turn).
 */
export async function resolveWeatherToolReply(
  db: Database,
  input: {
    conversationId: string;
    completion: ChatCompletionResult;
    system: string;
    prompt: string;
    model: string;
  },
): Promise<SendMessageBubble[] | null> {
  const weatherRequest = findWeatherRequest(input.completion);
  if (!weatherRequest) return null;

  const weatherState = await resolveWeatherState(db, input.conversationId);
  const requestedCity =
    typeof weatherRequest.arguments.city === 'string' &&
    weatherRequest.arguments.city.trim().length > 0
      ? weatherRequest.arguments.city.trim()
      : null;

  let toolResult: Record<string, unknown>;
  let toolSucceeded = false;
  if (!weatherState.authorized) {
    toolResult = {
      status: 'not_enabled',
      detail:
        'The user has not enabled the weather capability, so no weather data was fetched.',
    };
    if (weatherState.humanActorId) {
      await recordWeatherExecution(db, {
        conversationId: input.conversationId,
        humanActorId: weatherState.humanActorId,
        city: requestedCity,
        permissionState: ToolExecutionStatus.Requested,
        result: toolResult,
      });
    }
  } else {
    const city = requestedCity ?? weatherState.defaultCity;
    const executionId = await recordWeatherExecution(db, {
      conversationId: input.conversationId,
      humanActorId: weatherState.humanActorId!,
      city,
      permissionState: ToolExecutionStatus.Confirmed,
      result: null,
    });
    try {
      const weather = await fetchWeather({
        city: city ?? undefined,
      });
      toolResult = { status: 'ok', weather };
      toolSucceeded = true;
      await completeWeatherExecution(db, executionId, {
        result: { ...weather },
        permissionState: ToolExecutionStatus.Succeeded,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toolResult = { status: 'error', detail };
      await completeWeatherExecution(db, executionId, {
        result: { error: detail },
        permissionState: ToolExecutionStatus.Failed,
      });
    }
  }

  const toolPrompt = [
    input.prompt,
    '# Tool result (weather)',
    JSON.stringify(toolResult),
    toolSucceeded ? WEATHER_TOOL_HINT_ENABLED : WEATHER_TOOL_HINT_BLOCKED,
  ].join('\n');

  try {
    const followUp = await createChatCompletion({
      model: input.model,
      system: input.system,
      prompt: toolPrompt,
      maxTokens: 2048,
      tools: SEND_MESSAGE_TOOLS,
    });
    // The follow-up may answer via native send_message calls or the
    // legacy envelope; both end up as plain bubbles here.
    const toolBubbles = parseSendMessageToolCalls(followUp);
    if (toolBubbles.length > 0) return toolBubbles;
    return parseReplyContent(followUp.content).map((text) => ({
      text,
      sendDelayMs: 0,
    }));
  } catch (err) {
    // The tool round is best-effort: log and keep the original replies
    // instead of failing the whole generation.
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'weather_tool_followup_failed',
        detail,
      }),
    );
    return null;
  }
}

/** Audit row per §11: every capability attempt is provable. */
async function recordWeatherExecution(
  db: Database,
  input: {
    conversationId: string;
    humanActorId: string;
    city: string | null;
    permissionState: ToolExecutionStatus;
    result: Record<string, unknown> | null;
  },
): Promise<string> {
  const id = newId<string>();
  await db.insert(toolExecutions).values({
    id,
    // The conversation's human is both requester-of-record and target:
    // model-initiated tool runs act on the user's behalf (§11).
    requestingActorId: input.humanActorId,
    targetHumanActorId: input.humanActorId,
    conversationId: input.conversationId,
    toolName: WEATHER_TOOL_NAME,
    arguments: { city: input.city },
    permissionState: input.permissionState,
    ...(input.result ? { result: input.result } : {}),
  });
  return id;
}

async function completeWeatherExecution(
  db: Database,
  id: string,
  update: {
    result: Record<string, unknown>;
    permissionState: ToolExecutionStatus;
  },
): Promise<void> {
  await db
    .update(toolExecutions)
    .set({
      result: update.result,
      completedAt: new Date(),
      permissionState: update.permissionState,
    })
    .where(eq(toolExecutions.id, id));
}

/**
 * Last-resort one-liner so an empty model reply never strands the user.
 * Language follows the trigger burst (CJK → Chinese; default Chinese,
 * the product's primary locale).
 */
export function fallbackReplyText(burstContents: string[]): string {
  const hasCjk = burstContents.some((c) => /[\u3400-\u9fff\uf900-\ufaff]/.test(c));
  return hasCjk
    ? '抱歉，我刚才走了一下神，你能再说一遍吗？'
    : 'Sorry, my mind went blank for a second — could you say that again?';
}

/** Dedupe bubbles by trimmed text, keeping the first rhythm hint. */
function dedupeBubbles(bubbles: SendMessageBubble[]): SendMessageBubble[] {
  const seen = new Set<string>();
  const out: SendMessageBubble[] = [];
  for (const bubble of bubbles) {
    const key = bubble.text.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(bubble);
  }
  return out;
}

/** Drop model bubbles that exactly echo a message already in the burst. */
function filterEchoedBubbles(
  bubbles: SendMessageBubble[],
  burstContents: string[],
): SendMessageBubble[] {
  const seen = new Set(burstContents.map((c) => c.trim()));
  return bubbles.filter((b) => !seen.has(b.text.trim()));
}

interface ResolvedCompletionReply {
  bubbles: SendMessageBubble[];
  memoryPatches: MemoryPatchExtraction;
}

/**
 * Turn one completion into final reply bubbles plus its proposed memory
 * patches. Preference order:
 *   1. weather tool round result (when the completion requested weather
 *      via legacy envelope tool_requests or a native tool call),
 *   2. native `send_message` tool calls,
 *   3. legacy JSON envelope / plain-text replies (unchanged behavior).
 * Every path passes through the shared echo filter and dedupe.
 */
async function resolveReplyFromCompletion(
  db: Database,
  input: {
    conversationId: string;
    completion: ChatCompletionResult;
    system: string;
    prompt: string;
    model: string;
    burstContents: string[];
  },
): Promise<ResolvedCompletionReply> {
  const memoryPatches = extractMemoryPatches(input.completion.content);

  // One bounded tool round: if the model requested the weather tool,
  // the runtime executes it (authorization-gated, §19) and the model
  // answers from the real result. No request or failed follow-up →
  // the original replies stand.
  const weatherBubbles = await resolveWeatherToolReply(db, {
    conversationId: input.conversationId,
    completion: input.completion,
    system: input.system,
    prompt: input.prompt,
    model: input.model,
  });
  if (weatherBubbles && weatherBubbles.length > 0) {
    return {
      bubbles: dedupeBubbles(
        filterEchoedBubbles(weatherBubbles, input.burstContents),
      ),
      memoryPatches,
    };
  }

  const toolBubbles = parseSendMessageToolCalls(input.completion);
  if (toolBubbles.length > 0) {
    return {
      bubbles: dedupeBubbles(
        filterEchoedBubbles(toolBubbles, input.burstContents),
      ),
      memoryPatches,
    };
  }

  const envelopeTexts = filterEchoedReplies(
    parseReplyContent(input.completion.content),
    input.burstContents,
  );
  return {
    bubbles: dedupeBubbles(
      envelopeTexts.map((text) => ({ text, sendDelayMs: 0 })),
    ),
    memoryPatches,
  };
}

/**
 * Persist model-proposed memory patches as ai_self memories (§7.4 step
 * 7, §8, §4.19). The character owns what it observed during the turn;
 * provenance points at the reply world event that produced it; policies
 * are server-forced to empty — a model never widens memory access.
 */
async function persistMemoryPatches(
  tx: Tx,
  input: {
    conversationId: string;
    characterActorId: string;
    patches: MemoryPatchInput[];
    sourceEventId: string | null;
  },
): Promise<void> {
  const sourceEventId = input.sourceEventId ?? newId<string>();
  for (const patch of input.patches) {
    await tx.insert(memoryItems).values({
      ownerActorId: input.characterActorId,
      relationshipId: null,
      sourceEventId,
      // source=ai_self: the memory originates from this character's own
      // generation, so the source actor is the character itself.
      sourceActorId: input.characterActorId,
      type: patch.type,
      objectiveFact: patch.objectiveFact,
      subjectiveInterpretation: patch.subjectiveInterpretation,
      confidence: patch.confidence,
      visibilityPolicy: {},
      sharePolicy: {},
      relevanceTags: [],
    });
  }
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'ai_memory_patches_persisted',
      conversationId: input.conversationId,
      count: input.patches.length,
    }),
  );
}

/**
 * Generate replies for every active character member of the conversation.
 * Fire-and-forget contract: never throws to the caller.
 */
export async function generateRepliesForConversation(
  db: Database,
  conversationId: string,
  triggerBurstId: string | null,
): Promise<void> {
  try {
    const [conv] = await db
      .select({ type: conversations.type })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!conv || conv.type === 'hidden_ai_direct') return;

    const characters = await db
      .select({
        actorId: actors.id,
        name: actors.publicName,
      })
      .from(conversationMembers)
      .innerJoin(actors, eq(actors.id, conversationMembers.actorId))
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.status, 'active'),
          eq(actors.type, 'character'),
        ),
      );
    if (characters.length === 0) return;

    const { serverEnv } = await import('../config.js');
    const model = serverEnv().MODEL_GATEWAY_MODEL ?? DEFAULT_GATEWAY_MODEL;

    for (const character of characters) {
      const sections = await compilePrompt(db, {
        actorId: character.actorId,
        burstId: triggerBurstId ?? '',
        conversationId,
      });
      const burstContents = triggerBurstId
        ? await db
            .select({ content: messages.content })
            .from(messages)
            .where(
              and(
                eq(messages.conversationId, conversationId),
                eq(messages.burstId, triggerBurstId),
              ),
            )
            .then((rows) => rows.map((r) => r.content))
        : [];
      const system = buildSystemPrompt(sections);
      const prompt = buildUserPrompt(sections);

      // Attempt 1 at the normal budget. An HTTP 200 with neither content
      // nor tool calls (observed ~12% on free-tier upstreams) surfaces as
      // `model_gateway_empty_response`; anything else keeps the existing
      // gateway retry/failure semantics.
      let completion: ChatCompletionResult | null = null;
      try {
        completion = await createChatCompletion({
          model,
          system,
          prompt,
          maxTokens: 2048,
          tools: SEND_MESSAGE_TOOLS,
        });
      } catch (err) {
        if (
          !(err instanceof ModelGatewayError) ||
          err.code !== ModelGatewayErrorCode.EmptyResponse
        ) {
          throw err;
        }
      }

      let degraded = false;
      let resolved: ResolvedCompletionReply = completion
        ? await resolveReplyFromCompletion(db, {
            conversationId,
            completion,
            system,
            prompt,
            model,
            burstContents,
          })
        : { bubbles: [], memoryPatches: { accepted: [], rejected: 0 } };

      if (resolved.bubbles.length === 0) {
        // Empty-reply recovery: exactly one retry with a raised token
        // budget, then a degraded one-liner — the user never sees a turn
        // vanish into silence.
        let retryCompletion: ChatCompletionResult | null = null;
        try {
          retryCompletion = await createChatCompletion({
            model,
            system,
            prompt,
            maxTokens: 4096,
            tools: SEND_MESSAGE_TOOLS,
          });
        } catch {
          retryCompletion = null;
        }
        if (retryCompletion) {
          completion = retryCompletion;
          resolved = await resolveReplyFromCompletion(db, {
            conversationId,
            completion: retryCompletion,
            system,
            prompt,
            model,
            burstContents,
          });
        }
        if (resolved.bubbles.length === 0) {
          resolved = {
            bubbles: [{ text: fallbackReplyText(burstContents), sendDelayMs: 0 }],
            memoryPatches: { accepted: [], rejected: 0 },
          };
          degraded = true;
          console.warn(
            JSON.stringify({
              level: 'warn',
              msg: 'ai_reply_degraded_empty_response',
              conversationId,
              model: completion?.model ?? model,
            }),
          );
        }
      }
      const modelUsed = completion?.model ?? model;

      await db.transaction(async (tx) => {
        const sequenceRow = await tx
          .select({
            next: sql<number>`COALESCE(MAX(${messages.sequence}), 0) + 1`,
          })
          .from(messages)
          .where(eq(messages.conversationId, conversationId));
        let sequence = sequenceRow[0]?.next ?? 1;
        const burstId = await openOrExtendBurst(
          tx,
          conversationId,
          character.actorId,
          sequence,
        );
        // send_delay_ms only staggers the bubbles' timestamps (typing
        // rhythm); no timer ever blocks the transaction.
        let cumulativeDelayMs = 0;
        let firstWorldEventId: string | null = null;
        for (const bubble of resolved.bubbles) {
          const id = newId<string>();
          const worldEventId = newId<string>();
          if (firstWorldEventId === null) firstWorldEventId = worldEventId;
          await tx.insert(messages).values({
            id,
            conversationId,
            senderActorId: character.actorId,
            sequence,
            // Gateway replies are server-generated; key is deterministic.
            clientIdempotencyKey: `ai:${id}`,
            kind: MessageKind.Text,
            content: bubble.text,
            burstId,
            status: MessageStatus.Accepted,
            createdAt: new Date(Date.now() + cumulativeDelayMs),
          });
          await tx.insert(worldEvents).values({
            id: worldEventId,
            socialGraphId: '00000000-0000-0000-0000-000000000001',
            type: 'message_sent',
            actorId: character.actorId,
            subjectActorIds: [character.actorId],
            conversationId,
            payload: {
              messageId: id,
              sequence,
              burstId,
              model: modelUsed,
              ...(bubble.sendDelayMs > 0
                ? { sendDelayMs: bubble.sendDelayMs }
                : {}),
              ...(degraded ? { degraded: true } : {}),
            },
            visibilityPolicy: { conversation: conversationId },
            idempotencyKey: `message_sent:${id}`,
          });
          sequence += 1;
          cumulativeDelayMs += bubble.sendDelayMs;
        }

        // §7.4 step 7: persist approved memory patches atomically with
        // the reply that proposed them.
        if (resolved.memoryPatches.rejected > 0) {
          console.warn(
            JSON.stringify({
              level: 'warn',
              msg: 'ai_memory_patches_rejected',
              conversationId,
              count: resolved.memoryPatches.rejected,
            }),
          );
        }
        if (resolved.memoryPatches.accepted.length > 0) {
          await persistMemoryPatches(tx, {
            conversationId,
            characterActorId: character.actorId,
            patches: resolved.memoryPatches.accepted,
            sourceEventId: firstWorldEventId,
          });
        }
      });
    }
  } catch (err) {
    // Generation must never break the triggering request. Log the stable
    // code plus the error message (never env values).
    const code =
      err instanceof ModelGatewayError ? err.code : 'generation_failed';
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'ai_generation_failed',
        code,
        detail,
      }),
    );
  }
}
