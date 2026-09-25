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
  conversationMembers,
  conversations,
  memoryGrants,
  memoryItems,
  messages,
  personaTemplates,
  relationshipNarratives,
  relationships,
} from '../../../db/schema.js';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

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
  const budget = input.budgetChars ?? 32_000;

  const [actor] = await db
    .select()
    .from(actors)
    .where(eq(actors.id, input.actorId))
    .limit(1);
  if (!actor) {
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
    };
  }

  const persona = actor.templateId
    ? await renderPersona(db, actor.templateId)
    : '';
  const actorState = actor.type === 'character'
    ? await renderCharacterState(db, actor.id)
    : '';
  const relationship = await renderRelationship(db, actor.id);
  const memories = await renderMemories(db, {
    actorId: actor.id,
    conversationId: input.conversationId,
    budget,
  });
  const burst = await renderBurst(db, input.conversationId, input.burstId);
  const recentEvents = await renderRecentEvents(db, input.conversationId);
  const socialContext = await renderSocialContext(db, input.conversationId, actor.id);
  const capabilities = await renderCapabilities(
    db,
    actor.templateId,
    input.conversationId,
  );

  return {
    persona,
    actorState,
    relationship,
    memories,
    burst,
    recentEvents,
    socialContext,
    capabilities,
    outputSchema: OUTPUT_SCHEMA_HINT,
    productPolicy: PRODUCT_POLICY,
  };
}

/* ----------------------------- helpers --------------------------------- */

async function renderPersona(
  db: Database,
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
  db: Database,
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

async function renderRelationship(
  db: Database,
  actorId: string,
): Promise<string> {
  const rows = await db
    .select()
    .from(relationships)
    .where(
      sql`${relationships.actorAId} = ${actorId} OR ${relationships.actorBId} = ${actorId}`,
    )
    .limit(16);
  if (rows.length === 0) return '# Relationship narratives\n(none)';
  const sections: string[] = ['# Relationship narratives'];
  for (const rel of rows) {
    const [narrative] = await db
      .select()
      .from(relationshipNarratives)
      .where(eq(relationshipNarratives.relationshipId, rel.id))
      .orderBy(desc(relationshipNarratives.version))
      .limit(1);
    sections.push(`## Relationship ${rel.id} (${rel.state})`);
    sections.push(
      narrative
        ? narrative.currentDynamic
        : '(no narrative yet)',
    );
  }
  return sections.join('\n\n');
}

/**
 * Conversation audience of a conversation minus the compiling actor:
 * active members only (§5: visibility is computed at delivery time).
 */
async function conversationAudience(
  db: Database,
  conversationId: string,
  actorId: string,
): Promise<Array<{ actorId: string; type: string }>> {
  const [conv] = await db
    .select({ type: conversations.type })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return [];
  const members = await db
    .select({ actorId: conversationMembers.actorId })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.status, 'active'),
      ),
    );
  return members
    .filter((m) => m.actorId !== actorId)
    .map((m) => ({ actorId: m.actorId, type: conv.type }));
}

/**
 * Memory authorization per DOMAIN_ARCHITECTURE §5 ("Memory"):
 * a prompt may include a memory only when
 *   1. the requesting character owns it, OR an explicit `memory_grants`
 *      row authorizes the requesting actor as a grantee (unexpired;
 *      every grant permission level implies at least "know"),
 *   2. the target conversation's audience is compatible with the
 *      share policy,
 *   3. the source data has not been deleted or superseded.
 * Everything else stays fail-closed: no grant row → the memory never
 * enters the grantee's prompt, exactly like an unauthorized one.
 *
 * A relationship-scoped private memory may enter only a 1:1
 * conversation (direct or hidden_ai_direct) whose sole other active
 * member is that relationship's counterpart, and only while the
 * relationship is still accepted (a block invalidates access).
 * `shared`/`public`/`reported`/`native_world` memories may enter any
 * conversation the owner participates in, subject to explicit
 * share-policy overrides:
 *   - sharePolicy.conversationIds: allow-list (when non-empty)
 *   - sharePolicy.excludeConversationIds: deny-list
 */
export async function isMemoryPermittedInConversation(
  db: Database,
  input: {
    memory: typeof memoryItems.$inferSelect;
    conversationId: string;
  },
): Promise<boolean> {
  const { memory, conversationId } = input;
  const [conv] = await db
    .select({ type: conversations.type })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return false; // no real conversation, no permitted audience
  if (memory.deletedAt !== null) return false;
  if (memory.supersededById !== null) return false;

  const share = (memory.sharePolicy ?? {}) as {
    conversationIds?: unknown;
    excludeConversationIds?: unknown;
  };
  const allowList = Array.isArray(share.conversationIds)
    ? (share.conversationIds as unknown[]).filter(
        (v): v is string => typeof v === 'string',
      )
    : [];
  const denyList = Array.isArray(share.excludeConversationIds)
    ? (share.excludeConversationIds as unknown[]).filter(
        (v): v is string => typeof v === 'string',
      )
    : [];
  if (denyList.includes(conversationId)) return false;
  if (allowList.length > 0 && !allowList.includes(conversationId)) {
    return false;
  }

  if (memory.type !== 'private') return true;
  if (!memory.relationshipId) {
    // The owner's own inner memory: owner-wide knowledge.
    return true;
  }
  const [rel] = await db
    .select({
      actorAId: relationships.actorAId,
      actorBId: relationships.actorBId,
      state: relationships.state,
    })
    .from(relationships)
    .where(eq(relationships.id, memory.relationshipId))
    .limit(1);
  if (!rel || rel.state !== 'accepted') return false;

  const audience = await conversationAudience(
    db,
    conversationId,
    memory.ownerActorId,
  );
  if (audience.length !== 1) return false; // group or empty: no private leak
  if (conv.type !== 'direct' && conv.type !== 'hidden_ai_direct') return false;
  const counterpart =
    rel.actorAId === memory.ownerActorId ? rel.actorBId : rel.actorAId;
  return audience[0]!.actorId === counterpart;
}

async function renderMemories(
  db: Database,
  input: { actorId: string; conversationId: string; budget: number },
): Promise<string> {
  const owned = await db
    .select()
    .from(memoryItems)
    .where(eq(memoryItems.ownerActorId, input.actorId))
    .limit(64);

  // Grant-recipient path: memories explicitly granted to this actor by
  // another actor. The grant row alone is not sufficient — every entry
  // still passes isMemoryPermittedInConversation (deleted/superseded/
  // share-policy/private-branch checks) and expired grants are dropped,
  // so the path remains fail-closed while authorized memories become
  // visible to the grantee's prompt.
  const grantedRows = await db
    .select({ memory: memoryItems, expiresAt: memoryGrants.expiresAt })
    .from(memoryGrants)
    .innerJoin(memoryItems, eq(memoryItems.id, memoryGrants.memoryId))
    .where(eq(memoryGrants.granteeActorId, input.actorId))
    .limit(64);

  const now = Date.now();
  const byId = new Map<
    string,
    { memory: typeof memoryItems.$inferSelect; grantedBy: string | null }
  >();
  for (const m of owned) byId.set(m.id, { memory: m, grantedBy: null });
  for (const row of grantedRows) {
    if (byId.has(row.memory.id)) continue; // owner view already included
    if (row.expiresAt && row.expiresAt.getTime() <= now) continue;
    byId.set(row.memory.id, {
      memory: row.memory,
      grantedBy: row.memory.ownerActorId,
    });
  }

  const out: string[] = ['# Permitted memories (with provenance)'];
  let used = 0;
  for (const entry of byId.values()) {
    const m = entry.memory;
    if (
      !(await isMemoryPermittedInConversation(db, {
        memory: m,
        conversationId: input.conversationId,
      }))
    ) {
      continue;
    }
    const provenance = entry.grantedBy
      ? `source_event=${m.sourceEventId} granted_by=${entry.grantedBy}`
      : m.sourceActorId
        ? `source_event=${m.sourceEventId} via=${m.sourceActorId}`
        : `source_event=${m.sourceEventId}`;
    const line = `- [${m.type}/${m.confidence}] ${m.objectiveFact} — ${m.subjectiveInterpretation} (provenance: ${provenance})`;
    if (used + line.length > input.budget) break;
    out.push(line);
    used += line.length;
  }
  return out.join('\n');
}

async function renderBurst(
  db: Database,
  conversationId: string,
  burstId: string,
): Promise<string> {
  if (!burstId) return '';
  const rows = await db
    .select({
      sequence: messages.sequence,
      sender: actors.publicName,
      senderType: actors.type,
      content: messages.content,
    })
    .from(messages)
    .innerJoin(actors, eq(actors.id, messages.senderActorId))
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.burstId, burstId),
      ),
    )
    .orderBy(asc(messages.sequence));
  if (rows.length === 0) return '';
  const lines = rows.map(
    (r) => `${r.sender} (${r.senderType}): ${r.content}`,
  );
  return `# Current conversation burst
${lines.join('\n')}`;
}

async function renderRecentEvents(
  db: Database,
  conversationId: string,
): Promise<string> {
  const rows = await db
    .select({
      sequence: messages.sequence,
      sender: actors.publicName,
      content: messages.content,
    })
    .from(messages)
    .innerJoin(actors, eq(actors.id, messages.senderActorId))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.sequence))
    .limit(20);
  if (rows.length === 0) return '';
  const lines = rows
    .reverse()
    .map((r) => `seq${r.sequence} ${r.sender}: ${r.content}`);
  return `# Recent conversation events (oldest first)\n${lines.join('\n')}`;
}

async function renderSocialContext(
  db: Database,
  conversationId: string,
  actorId: string,
): Promise<string> {
  const members = await db
    .select({ id: actors.id, name: actors.publicName, type: actors.type })
    .from(conversationMembers)
    .innerJoin(actors, eq(conversationMembers.actorId, actors.id))
    .where(eq(conversationMembers.conversationId, conversationId));
  const filtered = members.filter((m) => m.id !== actorId);
  return [
    `# Social context`,
    `Visible actors in conversation: ${filtered
      .map((m) => `${m.name} (${m.type})`)
      .join(', ')}`,
  ].join('\n');
}

/**
 * Weather authorization for a conversation (WEB_IMPLEMENTATION §19).
 *
 * Consent is a user gesture performed by a human, so the capability is
 * enabled for a conversation only when one of its active human members
 * has recorded weather consent; that member's stored default city is the
 * fallback when a tool request names none. Fail-closed: no consent row →
 * `authorized: false`, and the runtime must neither execute the tool nor
 * let the model fabricate data.
 */
export async function resolveWeatherState(
  db: Database,
  conversationId: string,
): Promise<{ authorized: boolean; defaultCity: string | null; humanActorId: string | null }> {
  const humans = await db
    .select({ actorId: conversationMembers.actorId })
    .from(conversationMembers)
    .innerJoin(actors, eq(actors.id, conversationMembers.actorId))
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.status, 'active'),
        eq(actors.type, 'human'),
      ),
    );
  if (humans.length === 0) {
    return { authorized: false, defaultCity: null, humanActorId: null };
  }
  const settingsRows = await db
    .select()
    .from(actorCapabilitySettings)
    .where(
      inArray(
        actorCapabilitySettings.actorId,
        humans.map((h) => h.actorId),
      ),
    );
  // Prefer a consenting member's defaults; fall back to the first human
  // so audit rows always name the user the tool would act for.
  const consented =
    settingsRows.find((s) => s.weatherConsentAt != null) ?? null;
  if (!consented) {
    return {
      authorized: false,
      defaultCity: null,
      humanActorId: humans[0]!.actorId,
    };
  }
  return {
    authorized: true,
    defaultCity: consented.weatherCity ?? null,
    humanActorId: consented.actorId,
  };
}

async function renderCapabilities(
  db: Database,
  templateId: string | null,
  conversationId: string,
): Promise<string> {
  if (!templateId) return '# Capabilities\n(none)';
  const [tpl] = await db
    .select({ capabilities: personaTemplates.capabilities })
    .from(personaTemplates)
    .where(eq(personaTemplates.id, templateId))
    .limit(1);
  const caps = (tpl?.capabilities as string[] | undefined) ?? [];
  if (caps.length === 0) return '# Capabilities\n(none)';

  const lines: string[] = [
    '# Capabilities',
    `Tools the runtime can execute for you: ${caps.join(', ')}.`,
    `To use one, add an entry to tool_requests in your JSON envelope:
{"toolName": "<name>", "arguments": {"city": "<city>"}}. The runtime executes
the tool and returns the real result before your final answer. Never invent
tool data, and never tell the user to check an external app for something a
capability can provide.`,
  ];
  if (caps.includes('weather')) {
    const weather = await resolveWeatherState(db, conversationId);
    lines.push(
      weather.authorized
        ? `- weather: ENABLED${weather.defaultCity ? ` (user default city: ${weather.defaultCity})` : ''}. When the user asks about weather, request it with arguments {"city": "<city>"}; use their default city when they do not name one.`
        : '- weather: NOT ENABLED by the user yet. Do not request it. When the user asks about weather, stay in character and warmly invite them to enable the weather capability in this app\'s settings (and to tell you their default city). Never claim you know nothing at all, never send them to a system weather app, and never make up weather data.',
    );
  }
  return lines.join('\n');
}
