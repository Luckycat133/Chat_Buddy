import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';
import { seedSocialGraph } from '../test/fixtures.js';
import { resetServerEnvForTests } from '../config.js';
import {
  actorCapabilitySettings,
  conversationMembers,
  conversations,
  messageBursts,
  memoryItems,
  messages,
  socialGraphs,
  toolExecutions,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import type { Database } from '../../db/index.js';

/**
 * The weather tool round (WEB_IMPLEMENTATION §19 + DOMAIN_ARCHITECTURE
 * §11): a model `tool_requests` entry for weather must be executed
 * server-side ONLY when the human user enabled the capability, the real
 * provider result must be fed back for the final answer, and every
 * attempt is audited as a tool_executions row. Fail-closed: no consent →
 * no provider call, and the model answers with guidance instead.
 */

const gatewayMocks = vi.hoisted(() => ({
  createChatCompletion: vi.fn(),
}));

vi.mock('./model-gateway.js', () => ({
  createChatCompletion: gatewayMocks.createChatCompletion,
  DEFAULT_GATEWAY_MODEL: 'test-model',
  ModelGatewayError: class ModelGatewayError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  ModelGatewayErrorCode: {
    BadResponse: 'model_gateway_bad_response',
    EmptyResponse: 'model_gateway_empty_response',
  },
}));

const capabilityMocks = vi.hoisted(() => ({
  fetchWeather: vi.fn(),
}));

vi.mock('../capabilities/index.js', () => ({
  fetchWeather: capabilityMocks.fetchWeather,
}));

const { generateRepliesForConversation, extractToolRequests } = await import(
  './generation.js'
);
const gatewayModule = await import('./model-gateway.js');

function emptyResponseError(): Error {
  return new gatewayModule.ModelGatewayError(
    gatewayModule.ModelGatewayErrorCode.EmptyResponse,
    'model gateway returned no content',
  );
}

let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
/** The generation service accepts the production postgres-js Database. */
let sdb: Database;

/** The runtime hardcodes this audit graph id for its world events. */
const RUNTIME_GRAPH_ID = '00000000-0000-0000-0000-000000000001';

function envelopeReply(texts: string[], toolRequests?: unknown[]): string {
  return JSON.stringify({
    messages: texts.map((text) => ({ target: 'current_conversation', text })),
    ...(toolRequests ? { tool_requests: toolRequests } : {}),
  });
}

async function seedConversation(): Promise<{
  conversationId: string;
  burstId: string;
  humanActorId: string;
  characterActorId: string;
}> {
  const seed = await seedSocialGraph(db);
  // The runtime writes its world events against the well-known graph.
  await db
    .insert(socialGraphs)
    .values({ id: RUNTIME_GRAPH_ID })
    .onConflictDoNothing();

  const conversationId = newId<string>();
  await db.insert(conversations).values({
    id: conversationId,
    socialGraphId: seed.graphId,
    type: 'direct',
    createdByActorId: seed.humanActorId,
  });
  await db.insert(conversationMembers).values(
    [seed.humanActorId, seed.characterActorId].map((actorId) => ({
      conversationId,
      actorId,
      status: 'active' as const,
      joinedAt: new Date(),
    })),
  );

  const burstId = newId<string>();
  await db.insert(messageBursts).values({
    id: burstId,
    conversationId,
    senderActorId: seed.humanActorId,
    firstMessageSequence: 1,
    lastMessageSequence: 1,
    openedAt: new Date(),
  });
  await db.insert(messages).values({
    id: newId<string>(),
    conversationId,
    senderActorId: seed.humanActorId,
    sequence: 1,
    clientIdempotencyKey: `test:${newId<string>()}`,
    kind: 'text',
    content: '北京今天天气怎么样？',
    burstId,
    status: 'accepted',
  });

  return {
    conversationId,
    burstId,
    humanActorId: seed.humanActorId,
    characterActorId: seed.characterActorId,
  };
}

async function grantWeatherConsent(humanActorId: string, city: string) {
  await db.insert(actorCapabilitySettings).values({
    actorId: humanActorId,
    weatherCity: city,
    weatherConsentAt: new Date(),
  });
}

async function insertedReplyTexts(conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ content: messages.content, sequence: messages.sequence })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.sequence));
  // The seeded user message is sequence 1; replies follow it.
  return rows.filter((r) => r.sequence > 1).map((r) => r.content);
}

async function insertedReplyRows(conversationId: string) {
  const rows = await db
    .select({
      content: messages.content,
      sequence: messages.sequence,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.sequence));
  // The seeded user message is sequence 1; replies follow it.
  return rows.filter((r) => r.sequence > 1);
}

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  sdb = created.db as unknown as Database;
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  process.env.SESSION_SIGNING_KEY = '0'.repeat(32);
  delete process.env.MODEL_GATEWAY_MODEL;
  resetServerEnvForTests();
  gatewayMocks.createChatCompletion.mockReset();
  capabilityMocks.fetchWeather.mockReset();
});

afterEach(async () => {
  resetServerEnvForTests();
  await closeTestDatabase(pg);
});

describe('extractToolRequests', () => {
  it('reads tool_requests out of a JSON envelope, tolerates plain text', () => {
    const envelope = envelopeReply(['hi'], [
      { toolName: 'weather', arguments: { city: '北京' } },
    ]);
    expect(extractToolRequests(envelope)).toEqual([
      { toolName: 'weather', arguments: { city: '北京' } },
    ]);
    expect(extractToolRequests('今天天气不错')).toEqual([]);
    expect(extractToolRequests('```json\n{"broken": true}\n```')).toEqual([]);
  });
});

describe('weather tool round in generation', () => {
  it('executes the weather tool when authorized and answers from the real result', async () => {
    const scene = await seedConversation();
    await grantWeatherConsent(scene.humanActorId, '北京');
    capabilityMocks.fetchWeather.mockResolvedValue({
      city: '上海',
      temperatureC: 22,
      condition: '多云',
      observedAt: '2026-09-25T01:00:00Z',
      source: 'stub',
    });
    gatewayMocks.createChatCompletion
      .mockResolvedValueOnce({
        content: envelopeReply(['让我看看天气。'], [
          { toolName: 'weather', arguments: { city: '上海' } },
        ]),
        model: 'test-model',
      })
      .mockResolvedValueOnce({
        content: envelopeReply(['上海现在多云，22°C。']),
        model: 'test-model',
      });

    await generateRepliesForConversation(
      sdb,
      scene.conversationId,
      scene.burstId,
    );

    // The requested city wins over the stored default.
    expect(capabilityMocks.fetchWeather).toHaveBeenCalledTimes(1);
    expect(capabilityMocks.fetchWeather).toHaveBeenCalledWith({
      city: '上海',
    });

    // The real tool result was fed back into the follow-up prompt.
    expect(gatewayMocks.createChatCompletion).toHaveBeenCalledTimes(2);
    const followUpPrompt =
      gatewayMocks.createChatCompletion.mock.calls[1]![0]!.prompt;
    expect(followUpPrompt).toContain('# Tool result (weather)');
    expect(followUpPrompt).toContain('"temperatureC":22');

    // The final reply comes from the follow-up, not the pre-tool text.
    expect(await insertedReplyTexts(scene.conversationId)).toEqual([
      '上海现在多云，22°C。',
    ]);

    // The execution is audited as a succeeded server-side tool run.
    const [row] = await db.select().from(toolExecutions);
    expect(row?.toolName).toBe('weather');
    expect(row?.permissionState).toBe('succeeded');
    expect(row?.completedAt).toBeTruthy();
    expect(row?.result).toMatchObject({ city: '上海' });
  });

  it('falls back to the stored default city when the model names none', async () => {
    const scene = await seedConversation();
    await grantWeatherConsent(scene.humanActorId, '北京');
    capabilityMocks.fetchWeather.mockResolvedValue({
      city: '北京',
      temperatureC: 18,
      condition: '晴',
      observedAt: '2026-09-25T01:00:00Z',
      source: 'stub',
    });
    gatewayMocks.createChatCompletion
      .mockResolvedValueOnce({
        content: envelopeReply([], [{ toolName: 'weather', arguments: {} }]),
        model: 'test-model',
      })
      .mockResolvedValueOnce({
        content: envelopeReply(['北京今天晴，18°C。']),
        model: 'test-model',
      });

    await generateRepliesForConversation(
      sdb,
      scene.conversationId,
      scene.burstId,
    );

    expect(capabilityMocks.fetchWeather).toHaveBeenCalledWith({ city: '北京' });
    expect(await insertedReplyTexts(scene.conversationId)).toEqual([
      '北京今天晴，18°C。',
    ]);
  });

  it('stays fail-closed when unauthorized: no provider call, guidance reply', async () => {
    const scene = await seedConversation();
    capabilityMocks.fetchWeather.mockResolvedValue({
      city: '北京',
      temperatureC: 18,
      condition: '晴',
      observedAt: '2026-09-25T01:00:00Z',
      source: 'stub',
    });
    gatewayMocks.createChatCompletion
      .mockResolvedValueOnce({
        content: envelopeReply(['自己看天气软件吧。'], [
          { toolName: 'weather', arguments: { city: '北京' } },
        ]),
        model: 'test-model',
      })
      .mockResolvedValueOnce({
        content: envelopeReply([
          '我暂时还查不了实时天气。你可以在应用的设置里开启天气能力，我就能帮你查啦。',
        ]),
        model: 'test-model',
      });

    await generateRepliesForConversation(
      sdb,
      scene.conversationId,
      scene.burstId,
    );

    // Never touches the provider without the user's consent.
    expect(capabilityMocks.fetchWeather).not.toHaveBeenCalled();

    // The refusal status was fed back so the model guides instead of
    // deflecting to a system weather app.
    const followUpPrompt =
      gatewayMocks.createChatCompletion.mock.calls[1]![0]!.prompt;
    expect(followUpPrompt).toContain('"status":"not_enabled"');

    // The guidance reply replaces the pre-tool text.
    expect(await insertedReplyTexts(scene.conversationId)).toEqual([
      '我暂时还查不了实时天气。你可以在应用的设置里开启天气能力，我就能帮你查啦。',
    ]);

    const [row] = await db.select().from(toolExecutions);
    expect(row?.permissionState).toBe('requested');
    expect(row?.completedAt).toBeNull();
  });

  it('surfaces provider failure truthfully instead of inventing data', async () => {
    const scene = await seedConversation();
    await grantWeatherConsent(scene.humanActorId, '北京');
    capabilityMocks.fetchWeather.mockRejectedValue(
      new Error('weather provider returned 502'),
    );
    gatewayMocks.createChatCompletion
      .mockResolvedValueOnce({
        content: envelopeReply([], [
          { toolName: 'weather', arguments: { city: '北京' } },
        ]),
        model: 'test-model',
      })
      .mockResolvedValueOnce({
        content: envelopeReply(['我这边的天气服务暂时出了点问题，晚点再问我一次吧。']),
        model: 'test-model',
      });

    await generateRepliesForConversation(
      sdb,
      scene.conversationId,
      scene.burstId,
    );

    const followUpPrompt =
      gatewayMocks.createChatCompletion.mock.calls[1]![0]!.prompt;
    expect(followUpPrompt).toContain('"status":"error"');
    expect(followUpPrompt).toContain('weather provider returned 502');
    expect(await insertedReplyTexts(scene.conversationId)).toEqual([
      '我这边的天气服务暂时出了点问题，晚点再问我一次吧。',
    ]);

    const [row] = await db.select().from(toolExecutions);
    expect(row?.permissionState).toBe('failed');
    expect(row?.result).toMatchObject({ error: 'weather provider returned 502' });
  });

  it('keeps the single-call path when the model requests no tool', async () => {
    const scene = await seedConversation();
    gatewayMocks.createChatCompletion.mockResolvedValueOnce({
      content: envelopeReply(['今天想聊点什么？']),
      model: 'test-model',
    });

    await generateRepliesForConversation(
      sdb,
      scene.conversationId,
      scene.burstId,
    );

    expect(gatewayMocks.createChatCompletion).toHaveBeenCalledTimes(1);
    expect(capabilityMocks.fetchWeather).not.toHaveBeenCalled();
    expect(await insertedReplyTexts(scene.conversationId)).toEqual([
      '今天想聊点什么？',
    ]);
    const rows = await db.select().from(toolExecutions);
    expect(rows).toHaveLength(0);
  });
});

describe('send_message tool path in generation', () => {
  it('turns native send_message tool calls into bubbles with typed rhythm', async () => {
    const scene = await seedConversation();
    gatewayMocks.createChatCompletion.mockResolvedValueOnce({
      content: '',
      model: 'test-model',
      toolCalls: [
        {
          id: 'c1',
          name: 'send_message',
          arguments: JSON.stringify({ text: '嘿，晚上好！', send_delay_ms: 1200 }),
        },
        {
          id: 'c2',
          name: 'send_message',
          arguments: JSON.stringify({ text: '今天过得怎么样？' }),
        },
      ],
    });

    await generateRepliesForConversation(sdb, scene.conversationId, scene.burstId);

    // The send_message definition is advertised with the request.
    const firstCall = gatewayMocks.createChatCompletion.mock.calls[0]![0]!;
    expect(firstCall.tools).toHaveLength(1);
    expect(firstCall.tools[0].function.name).toBe('send_message');
    expect(firstCall.tools[0].function.parameters.required).toEqual(['text']);

    const rows = await insertedReplyRows(scene.conversationId);
    expect(rows.map((r) => r.content)).toEqual(['嘿，晚上好！', '今天过得怎么样？']);
    // send_delay_ms 1200 must show up as a timestamp stagger only — the
    // transaction itself never sleeps.
    const gap = rows[1]!.createdAt.getTime() - rows[0]!.createdAt.getTime();
    expect(Math.abs(gap - 1200)).toBeLessThan(500);

    const [event] = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'message_sent'));
    expect(event?.payload).toMatchObject({ model: 'test-model' });
  });

  it('clamps oversized text and delays server-side and skips malformed calls', async () => {
    const scene = await seedConversation();
    gatewayMocks.createChatCompletion.mockResolvedValueOnce({
      content: '',
      model: 'test-model',
      toolCalls: [
        {
          name: 'send_message',
          arguments: JSON.stringify({
            text: '长'.repeat(2500),
            send_delay_ms: 9999,
          }),
        },
        { name: 'send_message', arguments: 'not-json' },
        { name: 'send_message', arguments: JSON.stringify({ text: '   ' }) },
        { name: 'other_tool', arguments: JSON.stringify({ text: 'nope' }) },
      ],
    });

    await generateRepliesForConversation(sdb, scene.conversationId, scene.burstId);

    const rows = await insertedReplyRows(scene.conversationId);
    expect(rows).toHaveLength(1);
    expect(Array.from(rows[0]!.content)).toHaveLength(2000);
    expect(rows[0]!.content.endsWith('…')).toBe(true);
    // 9999 → clamped to 3000.
    const [event] = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'message_sent'));
    expect(event?.payload).toMatchObject({ sendDelayMs: 3000 });
  });

  it('still honors the legacy messages envelope when no tool calls arrive', async () => {
    const scene = await seedConversation();
    gatewayMocks.createChatCompletion.mockResolvedValueOnce({
      content: envelopeReply(['第一条。', '第二条。']),
      model: 'test-model',
    });

    await generateRepliesForConversation(sdb, scene.conversationId, scene.burstId);

    expect(await insertedReplyTexts(scene.conversationId)).toEqual([
      '第一条。',
      '第二条。',
    ]);
    // Envelope bubbles carry no rhythm hint.
    const [event] = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'message_sent'));
    expect(event?.payload).not.toHaveProperty('sendDelayMs');
  });
});

describe('empty reply recovery in generation', () => {
  it('retries once with a raised budget when the gateway answers empty', async () => {
    const scene = await seedConversation();
    gatewayMocks.createChatCompletion
      .mockRejectedValueOnce(emptyResponseError())
      .mockResolvedValueOnce({
        content: envelopeReply(['第二次就有了。']),
        model: 'test-model',
      });

    await generateRepliesForConversation(sdb, scene.conversationId, scene.burstId);

    expect(gatewayMocks.createChatCompletion).toHaveBeenCalledTimes(2);
    expect(gatewayMocks.createChatCompletion.mock.calls[0]![0]!.maxTokens).toBe(2048);
    expect(gatewayMocks.createChatCompletion.mock.calls[1]![0]!.maxTokens).toBe(4096);
    expect(await insertedReplyTexts(scene.conversationId)).toEqual([
      '第二次就有了。',
    ]);
  });

  it('falls back to a degraded one-liner when both attempts are empty', async () => {
    const scene = await seedConversation();
    gatewayMocks.createChatCompletion.mockRejectedValue(emptyResponseError());

    await generateRepliesForConversation(sdb, scene.conversationId, scene.burstId);

    expect(gatewayMocks.createChatCompletion).toHaveBeenCalledTimes(2);
    const rows = await insertedReplyRows(scene.conversationId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.content).toContain('再说一遍');

    // The degraded flag is auditable on the world event.
    const events = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'message_sent'));
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({ degraded: true });
  });

  it('retries when the envelope parses to zero non-echo replies', async () => {
    const scene = await seedConversation();
    // The user's burst line is echoed verbatim → filtered → empty.
    gatewayMocks.createChatCompletion
      .mockResolvedValueOnce({
        content: envelopeReply(['北京今天天气怎么样？']),
        model: 'test-model',
      })
      .mockResolvedValueOnce({
        content: envelopeReply(['不好意思，刚刚卡了一下。']),
        model: 'test-model',
      });

    await generateRepliesForConversation(sdb, scene.conversationId, scene.burstId);

    expect(gatewayMocks.createChatCompletion).toHaveBeenCalledTimes(2);
    expect(gatewayMocks.createChatCompletion.mock.calls[1]![0]!.maxTokens).toBe(4096);
    expect(await insertedReplyTexts(scene.conversationId)).toEqual([
      '不好意思，刚刚卡了一下。',
    ]);
  });
});

describe('memory_patches persistence in generation', () => {
  it('persists validated patches as ai_self memories with provenance', async () => {
    const scene = await seedConversation();
    gatewayMocks.createChatCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        messages: [{ target: 'current_conversation', text: '记住啦！' }],
        memory_patches: [
          {
            type: 'private',
            objectiveFact: '用户住在厦门',
            subjectiveInterpretation: '用户亲口告诉我的',
            confidence: 'reported',
          },
          // Duplicate within the same reply → deduped.
          {
            type: 'private',
            objectiveFact: '用户住在厦门',
            subjectiveInterpretation: '重复的一次',
            confidence: 'reported',
          },
        ],
      }),
      model: 'test-model',
    });

    await generateRepliesForConversation(sdb, scene.conversationId, scene.burstId);

    expect(await insertedReplyTexts(scene.conversationId)).toEqual(['记住啦！']);
    const rows = await db.select().from(memoryItems);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ownerActorId: scene.characterActorId,
      sourceActorId: scene.characterActorId,
      type: 'private',
      objectiveFact: '用户住在厦门',
      subjectiveInterpretation: '用户亲口告诉我的',
      confidence: 'reported',
      sharePolicy: {},
      visibilityPolicy: {},
    });
    // Provenance points at the reply's own message_sent world event.
    const [event] = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.type, 'message_sent'));
    expect(rows[0]!.sourceEventId).toBe(event?.id);
  });

  it('rejects policy-proposing and schema-invalid patches fail-closed', async () => {
    const scene = await seedConversation();
    gatewayMocks.createChatCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        messages: [{ target: 'current_conversation', text: '好吧。' }],
        memory_patches: [
          // Authorization widening attempt → rejected.
          {
            type: 'public',
            objectiveFact: '越权共享的事实',
            subjectiveInterpretation: '想公开',
            confidence: 'reported',
            sharePolicy: { conversationIds: ['00000000-0000-0000-0000-000000000009'] },
          },
          // Invalid enum value → rejected by ActionEnvelopeSchema.
          {
            type: 'private',
            objectiveFact: '坏信心的事实',
            subjectiveInterpretation: '自信过头',
            confidence: 'certain',
          },
        ],
      }),
      model: 'test-model',
    });

    await generateRepliesForConversation(sdb, scene.conversationId, scene.burstId);

    // The reply still lands; no memory rows exist at all.
    expect(await insertedReplyTexts(scene.conversationId)).toEqual(['好吧。']);
    const rows = await db.select().from(memoryItems);
    expect(rows).toHaveLength(0);
  });

  it('unit: extractMemoryPatches dedupes and counts rejections', async () => {
    const { extractMemoryPatches } = await import('./generation.js');
    const result = extractMemoryPatches(
      JSON.stringify({
        memory_patches: [
          { type: 'shared', objectiveFact: 'A fact', subjectiveInterpretation: '', confidence: 'observed' },
          { type: 'shared', objectiveFact: '  A  FACT ', subjectiveInterpretation: '', confidence: 'observed' },
          { type: 'shared', objectiveFact: 'B fact', subjectiveInterpretation: '', confidence: 'nope' },
          { type: 'shared', objectiveFact: 'C fact', subjectiveInterpretation: '', confidence: 'observed', visibilityPolicy: { graph: 'x' } },
        ],
      }),
    );
    expect(result.accepted.map((p) => p.objectiveFact)).toEqual(['A fact']);
    expect(result.rejected).toBe(2);
    // Non-envelope content simply has no patches.
    expect(extractMemoryPatches('plain text reply')).toEqual({
      accepted: [],
      rejected: 0,
    });
  });
});
