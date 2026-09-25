/**
 * Character life scheduler per DOMAIN_ARCHITECTURE §9 and WEB_IMPLEMENTATION §14.
 *
 * Adaptive frequency: recently active actors get more opportunities
 * (retry in 1h) while quiet actors back off (3h). Publication requires a
 * validated candidate — placeholders, blanks, and oversize content are
 * rejected, and "no meaningful event" (generator null) publishes nothing.
 * Total background model spend is capped per social graph over a rolling
 * 24h window; the generator is never called once the cap is reached.
 *
 * The generator is injectable (tests pass fakes; production wires
 * `generateLifeEventViaModel` via the offline scheduler).
 */
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import {
  actors,
  characterActors,
  messages,
  moments,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import { createChatCompletion } from '../services/model-gateway.js';

export interface LifeCandidateInput {
  actorId: string;
  socialGraphId: string;
  publicName: string;
  nativeWorldState: unknown;
  recentEvents: string[];
  recentActivityCount: number;
}

/**
 * Produces one candidate life-event text, or null when nothing
 * meaningful exists. Never throws on "no event" — only on real failures,
 * which the tick swallows without publishing.
 */
export type LifeCandidateGenerator = (
  input: LifeCandidateInput,
) => Promise<string | null>;

export interface LifeTickResult {
  considered: number;
  generated: number;
  /** Due actors skipped because the graph hit the 24h spend cap. */
  spendCapped: number;
  /** Candidates rejected by validation instead of published. */
  rejected: number;
}

/**actors considered per tick, bounding model spend per pass. */
const MAX_PER_TICK = 8;

/** Successful publication reschedules the next simulation this far out. */
const ACTIVE_RETRY_MS = 60 * 60_000;

/** Quiet actors (nothing meaningful) back off by this much. */
const QUIET_BACKOFF_MS = 3 * 60 * 60_000;

/** Rolling-window per-graph cap on generated life events. */
const GRAPH_DAILY_EVENT_CAP = 12;

const PLACEHOLDER_PATTERN =
  /\[object object\]|undefined|\btodo\b|\bplaceholder\b|\blorem ipsum\b/i;

/**
 * Validate and normalize a candidate. Returns the trimmed content, or
 * null when it is blank, a placeholder, or over the 8000-char cap — such
 * content must never reach Moments.
 */
export function validateCandidate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 8000) return null;
  if (PLACEHOLDER_PATTERN.test(trimmed)) return null;
  return trimmed;
}

interface GenerateLifeEventInput {
  actorId: string;
  socialGraphId: string;
  publicName: string;
  nativeWorldState: unknown;
  recentEvents: string[];
  recentActivityCount: number;
}

/**
 * Default generator: asks the model gateway for one meaningful native
 * world event. Unconfigured gateway or a NONE answer means "no event".
 */
export async function generateLifeEventViaModel(
  input: GenerateLifeEventInput,
): Promise<string | null> {
  try {
    const { serverEnv } = await import('../config.js');
    const env = serverEnv();
    if (!env.MODEL_GATEWAY_URL || !env.MODEL_GATEWAY_KEY) {
      return null;
    }
    const completion = await createChatCompletion({
      model: env.MODEL_GATEWAY_MODEL ?? 'openrouter/auto',
      system:
        'You generate one short, concrete first-person life event for a character. Reply with the event text only, or NONE if nothing meaningful happened.',
      prompt: [
        `Character: ${input.publicName}`,
        `Native world state: ${JSON.stringify(input.nativeWorldState ?? {})}`,
        `Recent events: ${input.recentEvents.join(' | ') || '(none)'}`,
        `Recent user interactions in 24h: ${input.recentActivityCount}`,
      ].join('\n'),
      maxTokens: 256,
    });
    const candidate = completion.content.trim();
    if (!candidate || /^none$/i.test(candidate)) return null;
    return validateCandidate(candidate);
  } catch {
    // Unconfigured or failing gateway: no event, never a placeholder.
    return null;
  }
}

export async function runLifeTick(
  db: Database,
  now: Date = new Date(),
  generate?: LifeCandidateGenerator,
): Promise<LifeTickResult> {
  const generator = generate ?? generateLifeEventViaModel;
  const windowStart = new Date(now.getTime() - 24 * 60 * 60_000);

  const due = await db
    .select({
      actorId: characterActors.actorId,
      socialGraphId: characterActors.socialGraphId,
      nativeWorldState: characterActors.nativeWorldState,
      publicName: actors.publicName,
    })
    .from(characterActors)
    .innerJoin(actors, eq(actors.id, characterActors.actorId))
    .where(
      sql`${characterActors.nextSimulationAfter} IS NULL OR ${characterActors.nextSimulationAfter} <= ${now.toISOString()}`,
    )
    .orderBy(asc(characterActors.lastSimulatedAt))
    .limit(MAX_PER_TICK);

  let generated = 0;
  let spendCapped = 0;
  let rejected = 0;

  for (const ch of due) {
    // Adaptive frequency needs the actor's recent chat activity.
    const [activity] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.senderActorId, ch.actorId),
          gte(messages.createdAt, windowStart),
        ),
      );
    const recentActivityCount = activity?.count ?? 0;

    // Per-graph spend cap: check BEFORE calling the model.
    const [capRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(worldEvents)
      .where(
        and(
          eq(worldEvents.socialGraphId, ch.socialGraphId),
          eq(worldEvents.type, 'native_world_event'),
          gte(worldEvents.occurredAt, windowStart),
        ),
      );
    if ((capRow?.count ?? 0) >= GRAPH_DAILY_EVENT_CAP) {
      spendCapped += 1;
      await db
        .update(characterActors)
        .set({
          lastSimulatedAt: now,
          nextSimulationAfter: new Date(now.getTime() + QUIET_BACKOFF_MS),
        })
        .where(eq(characterActors.actorId, ch.actorId));
      continue;
    }

    let candidate: string | null = null;
    try {
      candidate = await generator({
        actorId: ch.actorId,
        socialGraphId: ch.socialGraphId,
        publicName: ch.publicName,
        nativeWorldState: ch.nativeWorldState,
        recentEvents: [],
        recentActivityCount,
      });
    } catch {
      // Generator failure publishes nothing; the actor stays due.
      continue;
    }

    const validated = validateCandidate(candidate);
    if (validated === null) {
      // Nothing meaningful (or invalid content): no forced event. A
      // recently active actor retries sooner than a quiet one.
      rejected += candidate !== null ? 1 : 0;
      await db
        .update(characterActors)
        .set({
          lastSimulatedAt: now,
          nextSimulationAfter: new Date(
            now.getTime() + (recentActivityCount > 0 ? ACTIVE_RETRY_MS : QUIET_BACKOFF_MS),
          ),
        })
        .where(eq(characterActors.actorId, ch.actorId));
      continue;
    }

    const momentId = newId<string>();
    await db.transaction(async (tx) => {
      await tx.insert(moments).values({
        id: momentId,
        actorId: ch.actorId,
        socialGraphId: ch.socialGraphId,
        content: validated,
        mediaAssets: [],
        audiencePolicy: { allowedActorIds: [], class: 'public_within_graph' },
      });
      await tx.insert(worldEvents).values({
        id: newId<string>(),
        socialGraphId: ch.socialGraphId,
        type: 'native_world_event',
        actorId: ch.actorId,
        subjectActorIds: [ch.actorId],
        momentId,
        occurredAt: now,
        payload: { source: 'life_scheduler' },
        visibilityPolicy: { public_within_graph: true },
        idempotencyKey: `native_world_event:${momentId}`,
      });
      await tx
        .update(characterActors)
        .set({
          lastSimulatedAt: now,
          nextSimulationAfter: new Date(now.getTime() + ACTIVE_RETRY_MS),
        })
        .where(eq(characterActors.actorId, ch.actorId));
    });
    generated += 1;
  }

  return { considered: due.length, generated, spendCapped, rejected };
}
