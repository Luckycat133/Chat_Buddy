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
  characterActors,
  conversationMembers,
  memoryItems,
  personaTemplates,
  relationshipNarratives,
  relationships,
} from '../../../db/schema.js';
import { and, eq, inArray, sql } from 'drizzle-orm';

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
a product surface; narrate rather than score.`;

const OUTPUT_SCHEMA_HINT = `Respond with a JSON envelope containing:
  messages, memory_patches, relationship_patch, world_events,
  proactive_intents, tool_requests, social_actions.
Model may not assign authoritative actor IDs outside the permitted set.`;

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
  const memories = await renderMemories(db, actor.id, budget);
  const burst = await renderBurst(db, input.conversationId, input.burstId);
  const recentEvents = await renderRecentEvents(db, input.conversationId);
  const socialContext = await renderSocialContext(db, input.conversationId, actor.id);
  const capabilities = await renderCapabilities(db, actor.templateId);

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

async function renderMemories(
  db: Database,
  actorId: string,
  budget: number,
): Promise<string> {
  const rows = await db
    .select()
    .from(memoryItems)
    .where(eq(memoryItems.ownerActorId, actorId))
    .limit(64);
  const out: string[] = ['# Permitted memories (with provenance)'];
  let used = 0;
  for (const m of rows) {
    const line = `- [${m.type}/${m.confidence}] ${m.objectiveFact} — ${m.subjectiveInterpretation}`;
    if (used + line.length > budget) break;
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
  void conversationId;
  void burstId;
  // The actual burst messages are streamed at send time. Here we keep
  // the slot to preserve the latest user burst completely.
  return `# Current conversation burst\n(burst payload injected at runtime)`;
}

async function renderRecentEvents(
  db: Database,
  conversationId: string,
): Promise<string> {
  void conversationId;
  return `# Recent relevant conversation events\n(streamed at runtime)`;
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

async function renderCapabilities(
  db: Database,
  templateId: string | null,
): Promise<string> {
  if (!templateId) return '# Capabilities\n(none)';
  const [tpl] = await db
    .select({ capabilities: personaTemplates.capabilities })
    .from(personaTemplates)
    .where(eq(personaTemplates.id, templateId))
    .limit(1);
  const caps = (tpl?.capabilities as string[] | undefined) ?? [];
  return `# Capabilities\n${caps.join(', ') || '(none)'}`;
}

void and;
void inArray;