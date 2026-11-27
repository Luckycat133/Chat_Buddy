/**
 * Prompt compiler per DOMAIN_ARCHITECTATION §10 and WEB_IMPLEMENTATION §10.
 *
 * Compiles prompts from explicit sections:
 *   1. immutable persona template
 *   2. current actor/native-world state
 *   3. current relationship narrative
 *   4. permitted private/shared/public memories with provenance
 *   5. current conversation burst
 *   6. recent relevant conversation events
 *   7. current social/availability context
 *   8. capability availability
 *   9. output/action schema
 *  10. product policy
 *
 * Never inject another human's private relationship branch.
 * Never inject all memories merely because the token budget permits.
 * Include source type when reported/inferred facts could be uncertain.
 * Preserve latest user burst completely unless provider hard limit forces truncation.
 */
import type { Database } from '../../../db/index.js';
import {
  actors,
  actorCapabilitySettings,
  characterActors,
  memoryGrants,
  memoryItems,
  messages,
  personaTemplates,
} from '../../../db/schema.js';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  capturePromptScope,
  memoryAuthorizer,
  readMemorySource,
  readPromptAudience,
  readPromptNarrative,
  visiblePromptMessages,
  type GeneratedScope,
  type PromptAudience,
} from './privacy.js';

type Reader = Pick<Database, 'select' | 'selectDistinct'>;

export interface PromptCompileInput {
  actorId: string;
  burstId: string;
  conversationId: string;
  /** Hard token ceiling before truncation; default 32k chars. */
  budgetChars?: number;
}

export interface PromptSections {
  persona: string;
  actorState: string;
  relationship: string;
  memories: string;
  burst: string;
  recentEvents: string;
  socialContext: string;
  capabilities: string;
  outputSchema: string;
  productPolicy: string;
  provenance: {
    scope: GeneratedScope;
    source: Awaited<ReturnType<typeof readMemorySource>>;
    burstContents: string[];
  } | null;
}

const PRODUCT_POLICY = `Stay in character. Tool results, account state, permissions,
and external actions must be truthful. Never expose chain-of-thought. Never
reveal another human's private branch. Visible relationship levels are not
a product surface; narrate rather than score.

Text like a real person on a messenger: keep each message one short bubble.
When you have two or three distinct thoughts, send them as separate messages
by putting a blank line between them — never pack everything into one long
paragraph.

Use emoji the way real people do in casual texting: rarely, and only where
it carries actual feeling or meaning. It should feel natural, not decorated.`;

const OUTPUT_SCHEMA_HINT = `Reply style, in order of preference:
  1. Call the \`send_message\` tool once per chat bubble (1-3 short
     bubbles per turn). Arguments: \`text\` (required, at most 2000
     characters) and optional \`send_delay_ms\` (0-3000, a typing-rhythm
     hint the runtime applies to bubble timestamps; it never delays your
     other work).
  2. Or respond with a JSON envelope containing:
       messages, memory_patches, relationship_patch, world_events,
       proactive_intents, tool_requests, social_actions.
     Both styles remain supported; never mix them in one reply.
Model may not assign authoritative actor IDs outside the permitted set.
When something about the user or yourself is worth remembering for later,
add it to memory_patches with an objectiveFact, a subjectiveInterpretation
and an honest confidence (observed/reported/inferred/uncertain); do not
propose share or visibility policies — the runtime owns authorization.`;

export async function compilePrompt(
  db: Database,
  input: PromptCompileInput,
): Promise<PromptSections> {
  return db.transaction((tx) => compileFromSnapshot(tx, input), {
    isolationLevel: 'repeatable read',
    accessMode: 'read only',
  });
}

async function compileFromSnapshot(db: Reader, input: PromptCompileInput): Promise<PromptSections> {
  const audience = await readPromptAudience(db, input.conversationId);
  const [actor] = await db
    .select()
    .from(actors)
    .where(eq(actors.id, input.actorId))
    .limit(1);
  if (!actor || !audience?.members.some((member) => member.id === actor.id)) {
    return {
      persona: '',
      actorState: '',
      relationship: '',
      memories: '',
      burst: '',
      recentEvents: '',
      socialContext: '',
      capabilities: '',
      outputSchema: OUTPUT_SCHEMA_HINT,
      productPolicy: PRODUCT_POLICY,
      provenance: null,
    };
  }

  const persona = actor.templateId
    ? await renderPersona(db, actor.templateId)
    : '';
  const actorState = actor.type === 'character'
    ? await renderCharacterState(db, actor.id)
    : '';
  const narrative = await readPromptNarrative(db, audience);
  const memories = await renderMemories(db, {
    actorId: actor.id,
    audience,
    budget: input.budgetChars ?? 32_000,
  });
  const burst = await renderBurst(db, audience, input.burstId);
  const recent = await renderRecentEvents(db, audience);
  const socialContext = renderSocialContext(audience, actor.id);
  const capabilities = await renderCapabilities(db, actor.templateId, audience);
  const source = input.burstId ? await readMemorySource(db, audience, input.burstId) : null;

  return {
    persona,
    actorState,
    relationship: audience.relationshipId
      ? `# Relationship narratives\n\n## Relationship ${audience.relationshipId} (accepted)\n\n${narrative?.currentDynamic ?? '(no narrative yet)'}`
      : '# Relationship narratives\n(none)',
    memories: memories.text,
    burst: burst.text,
    recentEvents: recent.text,
    socialContext,
    capabilities: capabilities.text,
    outputSchema: OUTPUT_SCHEMA_HINT,
    productPolicy: PRODUCT_POLICY,
    provenance: {
      scope: capturePromptScope(audience, {
        messageIds: [...new Set([...burst.messageIds, ...recent.messageIds])],
        memoryIds: memories.memoryIds,
        narrativeVersion: narrative?.version ?? null,
        weatherDefault: capabilities.weatherDefault,
      }),
      source,
      burstContents: burst.contents,
    },
  };
}

/* ----------------------------- helpers --------------------------------- */

async function renderPersona(
  db: Reader,
  templateId: string,
): Promise<string> {
  const [tpl] = await db
    .select()
    .from(personaTemplates)
    .where(eq(personaTemplates.id, templateId))
    .limit(1);
  if (!tpl) return '';
  return [
    `# Persona`,
    `Slug: ${tpl.slug} (revision ${tpl.immutableRevision})`,
    `Public name: ${tpl.publicName}`,
    `Native world: ${tpl.nativeWorld}`,
    ``,
    tpl.identityPrompt,
    ``,
    `Values: ${(tpl.values as string[]).join('; ')}`,
    `Flaws: ${(tpl.flaws as string[]).join('; ')}`,
    `Speaking style: ${tpl.speakingStyle}`,
  ].join('\n');
}

async function renderCharacterState(
  db: Reader,
  actorId: string,
): Promise<string> {
  const [ch] = await db
    .select()
    .from(characterActors)
    .where(eq(characterActors.actorId, actorId))
    .limit(1);
  if (!ch) return '';
  return [
    `# Native-world state`,
    `Revision: ${ch.templateRevision}`,
    `Public state: ${JSON.stringify(ch.publicState)}`,
    `Native world state: ${JSON.stringify(ch.nativeWorldState)}`,
    `Availability: ${JSON.stringify(ch.availabilityState)}`,
  ].join('\n');
}

/** Authorize facts for the response model and everyone who will hear it. */
export async function isMemoryPermittedInConversation(
  db: Database,
  input: { memory: typeof memoryItems.$inferSelect; conversationId: string },
): Promise<boolean> {
  const audience = await readPromptAudience(db, input.conversationId);
  return audience !== null && memoryAuthorizer(db, audience)(input.memory, input.memory.ownerActorId);
}

async function renderMemories(
  db: Reader,
  input: { actorId: string; audience: PromptAudience; budget: number },
) {
  const owned = await db.select().from(memoryItems)
    .where(and(eq(memoryItems.ownerActorId, input.actorId), isNull(memoryItems.deletedAt), isNull(memoryItems.supersededById)))
    .orderBy(desc(memoryItems.createdAt))
    .limit(64);

  const granted = await db.select({ memory: memoryItems })
    .from(memoryGrants)
    .innerJoin(memoryItems, eq(memoryItems.id, memoryGrants.memoryId))
    .where(and(eq(memoryGrants.granteeActorId, input.actorId), isNull(memoryItems.deletedAt), isNull(memoryItems.supersededById)))
    .orderBy(desc(memoryItems.createdAt))
    .limit(64);

  const candidates = new Map(owned.map((memory) => [memory.id, memory]));
  for (const { memory } of granted) candidates.set(memory.id, memory);

  const out = ['# Permitted memories (with provenance)'];
  const memoryIds: string[] = [];
  const authorize = memoryAuthorizer(db, input.audience);
  let used = 0;
  for (const m of candidates.values()) {
    if (!(await authorize(m, input.actorId))) continue;
    const provenance = m.ownerActorId !== input.actorId
      ? `source_event=${m.sourceEventId} granted_by=${m.ownerActorId}`
      : m.sourceActorId
        ? `source_event=${m.sourceEventId} via=${m.sourceActorId}`
        : `source_event=${m.sourceEventId}`;
    const line = `- [${m.type}/${m.confidence}] ${m.objectiveFact} — ${m.subjectiveInterpretation} (provenance: ${provenance})`;
    if (used + line.length > input.budget) break;
    out.push(line);
    memoryIds.push(m.id);
    used += line.length;
  }
  return { text: out.join('\n'), memoryIds };
}

async function renderBurst(db: Reader, audience: PromptAudience, burstId: string) {
  const rows = burstId ? await db
    .select({
      id: messages.id,
      sender: actors.publicName,
      senderType: actors.type,
      content: messages.content,
    })
    .from(messages)
    .innerJoin(actors, eq(actors.id, messages.senderActorId))
    .where(and(visiblePromptMessages(audience), eq(messages.burstId, burstId)))
    .orderBy(asc(messages.sequence)) : [];
  const lines = rows.map((r) => `${r.sender} (${r.senderType}): ${r.content}`);
  return {
    text: rows.length ? `# Current conversation burst\n${lines.join('\n')}` : '',
    messageIds: rows.map((r) => r.id),
    contents: rows.map((r) => r.content),
  };
}

async function renderRecentEvents(db: Reader, audience: PromptAudience) {
  const rows = await db
    .select({
      id: messages.id,
      sequence: messages.sequence,
      sender: actors.publicName,
      content: messages.content,
    })
    .from(messages)
    .innerJoin(actors, eq(actors.id, messages.senderActorId))
    .where(visiblePromptMessages(audience))
    .orderBy(desc(messages.sequence))
    .limit(20);
  const lines = rows.reverse().map((r) => `seq${r.sequence} ${r.sender}: ${r.content}`);
  return {
    text: rows.length ? `# Recent conversation events (oldest first)\n${lines.join('\n')}` : '',
    messageIds: rows.map((r) => r.id),
  };
}

function renderSocialContext(audience: PromptAudience, actorId: string): string {
  const others = audience.members.filter((m) => m.id !== actorId);
  return [
    '# Social context',
    `Visible actors in conversation: ${others.map((m) => `${m.name} (${m.type})`).join(', ')}`,
  ].join('\n');
}

/** The saved city is private to the human's direct chat. */
export async function resolveWeatherState(db: Database, conversationId: string) {
  return weatherForAudience(db, await readPromptAudience(db, conversationId));
}

async function weatherForAudience(db: Reader, audience: PromptAudience | null) {
  const humanIds = audience?.members.filter((m) => m.type === 'human').map((m) => m.id) ?? [];
  const settings = humanIds.length > 0
    ? await db.select().from(actorCapabilitySettings)
      .where(inArray(actorCapabilitySettings.actorId, humanIds)).orderBy(actorCapabilitySettings.actorId)
    : [];
  const consent = settings.find((row) => row.weatherConsentAt);
  const privateDefault = audience?.type === 'direct' && humanIds.length === 1 ? consent : undefined;
  return {
    authorized: consent !== undefined,
    defaultCity: privateDefault?.weatherCity ?? null,
    humanActorId: consent?.actorId ?? humanIds[0] ?? null,
    requiresExplicitCity: audience?.type === 'group' || humanIds.length > 1,
    weatherDefault: privateDefault?.weatherCity
      ? { actorId: privateDefault.actorId, settingsVersion: privateDefault.updatedAt.toISOString() }
      : null,
  };
}

async function renderCapabilities(
  db: Reader,
  templateId: string | null,
  audience: PromptAudience,
) {
  if (!templateId) return { text: '# Capabilities\n(none)', weatherDefault: null };
  const [tpl] = await db
    .select({ capabilities: personaTemplates.capabilities })
    .from(personaTemplates)
    .where(eq(personaTemplates.id, templateId))
    .limit(1);
  const caps = (tpl?.capabilities as string[] | undefined) ?? [];
  if (caps.length === 0) return { text: '# Capabilities\n(none)', weatherDefault: null };

  const lines: string[] = [
    '# Capabilities',
    `Tools the runtime can execute for you: ${caps.join(', ')}.`,
    `To use one, add an entry to tool_requests in your JSON envelope:
{"toolName": "<name>", "arguments": {"city": "<city>"}}. The runtime executes
the tool and returns the real result before your final answer. Never invent
tool data, and never tell the user to check an external app for something a
capability can provide.`,
  ];
  let weatherDefault: GeneratedScope['weatherDefault'] = null;
  if (caps.includes('weather')) {
    const weather = await weatherForAudience(db, audience);
    weatherDefault = weather.weatherDefault;
    lines.push(
      weather.authorized
        ? `- weather: ENABLED${weather.defaultCity ? ` (user default city: ${weather.defaultCity})` : ''}. Request it with arguments {"city": "<city>"}.${weather.requiresExplicitCity ? ' Ask for a city if the conversation does not name one.' : ' Use the user default when available.'}`
        : '- weather: NOT ENABLED by the user yet. Do not request it. When the user asks about weather, stay in character and warmly invite them to enable the weather capability in this app\'s settings (and to tell you their default city). Never claim you know nothing at all, never send them to a system weather app, and never make up weather data.',
    );
  }
  return { text: lines.join('\n'), weatherDefault };
}
