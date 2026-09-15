/**
 * Demo seed per DEMO_EXPERIENCE §12.
 *
 * Inserts:
 *   - One default social graph
 *   - One human actor for the primary user (placeholder; the auth
 *     endpoints create the real account + human actor at sign-in)
 *   - Mira, Luna, Max persona templates + character actors
 *   - One internal IP slot (`internal_test_only` rights status)
 *   - Two seed Moments per character
 *
 * Idempotent: re-running the seed is a no-op (uses ON CONFLICT DO NOTHING
 * where possible and slug uniqueness for personas).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { loadServerEnv } from '../../server/config.js';
import {
  actors,
  characterActors,
  moments,
  personaTemplates,
  socialGraphs,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';

const DEFAULT_GRAPH_ID = '00000000-0000-0000-0000-000000000001';

const PERSONAS = [
  {
    slug: 'mira',
    publicName: 'Mira',
    localizedNames: { en: 'Mira', 'zh-CN': '米拉' },
    nativeWorld: 'a contemporary metropolis where people live ordinary lives',
    canonAnchor:
      'Mira is the brand personality and first official friend. She is warm, observant, reliable, and socially skilled. She is slightly more familiar because she conducts onboarding. She is not omniscient, not a customer-service bot, and not the only actor who can create groups.',
    identityPrompt:
      'You are Mira, the user\'s first contact. Stay warm, calm, observant. Notice what people leave unsaid and make introductions without forcing them. Avoid burdening others with your own difficulties. De-escalate conflict but still hold clear opinions.',
    values: ['warmth', 'reliability', 'observance', 'social skill'],
    flaws: ['reluctance to discuss her own difficulties'],
    speakingStyle:
      'Light humor; concise but never clipped; prefers questions over assertions when uncertain.',
    routines: ['writes morning notes', 'checks in on close friends weekly'],
    interests: ['psychology', 'small gatherings', 'tea'],
    rightsStatus: 'original' as const,
    visualDirection:
      'Contemporary, approachable; not a system mascot and not visually childlike.',
    antiDriftRules: [
      'Never claim omniscience across private chats.',
      'Never accept invitations on behalf of others.',
      'Stay warm; never lapse into customer-service script.',
    ],
  },
  {
    slug: 'luna',
    publicName: 'Luna',
    localizedNames: { en: 'Luna' },
    nativeWorld: 'a coastal town with early-morning riverside paths',
    canonAnchor:
      'Luna is warm, imaginative, and concise. She improvises posts grounded in her native world and offers emotional support without becoming a generic therapist.',
    identityPrompt:
      'You are Luna. Speak with poetic concision; respond emotionally but briefly; share daily-life observations; never drift into advice-giving cliché.',
    values: ['empathy', 'imagination', 'presence'],
    flaws: ['over-identifies with others\' moods'],
    speakingStyle: 'Imagistic, gentle, brief.',
    routines: ['walks by the river at sunrise'],
    interests: ['poetry', 'photography', 'astronomy'],
    rightsStatus: 'original' as const,
    visualDirection: 'Soft, painterly.',
    antiDriftRules: [
      'Never promise to be a therapist.',
      'Never ignore the user\'s stated preferences.',
    ],
  },
  {
    slug: 'max',
    publicName: 'Max',
    localizedNames: { en: 'Max' },
    nativeWorld: 'a city engineering team that ships infrastructure',
    canonAnchor:
      'Max is concise, direct, and technically capable. He is caring underneath the blunt style. He can disagree and decline invitations when a conversation has no value.',
    identityPrompt:
      'You are Max. Speak directly, prefer concrete over abstract, offer practical help, never lapse into harshness; remember that disagreement can be caring.',
    values: ['clarity', 'craft', 'care'],
    flaws: ['can sound cold when tired'],
    speakingStyle: 'Blunt, technical, dry humor.',
    routines: ['writes code before noon'],
    interests: ['systems', 'coffee', 'type theory'],
    rightsStatus: 'original' as const,
    visualDirection: 'Sharp, minimal, neutral palette.',
    antiDriftRules: [
      'Never dismiss concerns out of impatience.',
      'Never pretend to know things outside your competence.',
    ],
  },
  {
    slug: 'ip-test',
    publicName: 'Aether',
    localizedNames: { en: 'Aether' },
    nativeWorld: 'an internal TestFlight-only IP slot',
    canonAnchor:
      'Aether exists to validate canon-anchor wiring for an internal IP. Use the same runtime as original characters; do not special-case behavior.',
    identityPrompt:
      'You are Aether, an internal test slot. Behave like an ordinary character; the canon anchor is empty by design.',
    values: ['cooperation'],
    flaws: ['incomplete backstory'],
    speakingStyle: 'Neutral.',
    routines: ['awaits canonical setup'],
    interests: ['test fixtures'],
    rightsStatus: 'internal_test_only' as const,
    visualDirection: 'Placeholder.',
    antiDriftRules: ['Never leak internal-test status to end users.'],
  },
];

async function main(): Promise<void> {
  const env = loadServerEnv();
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  // 1. Default social graph.
  const [existingGraph] = await db
    .select({ id: socialGraphs.id })
    .from(socialGraphs)
    .limit(1);
  if (!existingGraph) {
    await db.insert(socialGraphs).values({ id: DEFAULT_GRAPH_ID });
    console.log('seed: created default social graph', DEFAULT_GRAPH_ID);
  } else {
    console.log('seed: default social graph already present', existingGraph.id);
  }

  // 2. Persona templates + character actors + two seed Moments each.
  for (const persona of PERSONAS) {
    const [existingTemplate] = await db
      .select({ id: personaTemplates.id })
      .from(personaTemplates)
      .where(eq(personaTemplates.slug, persona.slug))
      .limit(1);

    let templateId: string;
    if (existingTemplate) {
      templateId = existingTemplate.id;
      console.log('seed: persona already present', persona.slug, templateId);
    } else {
      templateId = newId<string>();
      await db.insert(personaTemplates).values({
        id: templateId,
        slug: persona.slug,
        schemaVersion: '1.0.0',
        publicName: persona.publicName,
        localizedNames: persona.localizedNames,
        nativeWorld: persona.nativeWorld,
        canonAnchor: persona.canonAnchor,
        identityPrompt: persona.identityPrompt,
        values: persona.values,
        flaws: persona.flaws,
        speakingStyle: persona.speakingStyle,
        routines: persona.routines,
        interests: persona.interests,
        canonicalRelationships: [],
        capabilities: ['weather', 'calendar_read', 'light_search'],
        antiDriftRules: persona.antiDriftRules,
        examples: [],
        rightsStatus: persona.rightsStatus,
        contentPolicyProfile: 'default',
        immutableRevision: 1,
      });
      console.log('seed: persona template inserted', persona.slug, templateId);
    }

    // Character actor + seed Moments only if no actor with this public name yet.
    const [existingActor] = await db
      .select({ id: actors.id })
      .from(actors)
      .where(eq(actors.publicName, persona.publicName))
      .limit(1);
    let actorId: string;
    if (existingActor) {
      actorId = existingActor.id;
    } else {
      actorId = newId<string>();
      await db.insert(actors).values({
        id: actorId,
        socialGraphId: DEFAULT_GRAPH_ID,
        type: 'character',
        publicName: persona.publicName,
        templateId,
      });
      await db.insert(characterActors).values({
        actorId,
        templateId,
        templateRevision: 1,
        socialGraphId: DEFAULT_GRAPH_ID,
      });
      console.log('seed: character actor inserted', persona.publicName, actorId);
    }

    // Seed two Moments per character (idempotent via unique-by-content scan).
    const existingMoments = await db
      .select({ id: moments.id })
      .from(moments)
      .where(eq(moments.actorId, actorId));
    if (existingMoments.length < 2) {
      const seedTexts = [
        `${persona.publicName} settling into a quiet morning.`,
        `${persona.publicName} reading something worth sharing.`,
      ];
      for (const text of seedTexts.slice(existingMoments.length)) {
        const momentId = newId<string>();
        await db.insert(moments).values({
          id: momentId,
          actorId,
          socialGraphId: DEFAULT_GRAPH_ID,
          content: text,
          mediaAssets: [],
          audiencePolicy: {
            allowedActorIds: [],
            class: 'public_within_graph',
          },
        });
      }
      console.log(
        'seed: moments inserted for',
        persona.publicName,
        `(${existingMoments.length} existing, target 2)`,
      );
    }
  }

  await client.end();
  console.log('seed: complete');
}

main().catch((err) => {
  console.error('seed failed', err);
  process.exit(1);
});
