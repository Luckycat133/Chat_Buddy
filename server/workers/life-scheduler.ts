/**
 * Character life scheduler per DOMAIN_ARCHITECTURE §9 and WEB_IMPLEMENTATION §14.
 *
 * Adaptive frequency: recently active actors get more opportunities;
 * quiet actors get fewer. No forced event when nothing meaningful exists.
 * Total background model spend is capped per social graph.
 *
 * Stub implementation: walks `character_actors` whose
 * `next_simulation_after` is null or past, generates a placeholder
 * native-world event, and writes a Moment + world_event pair. The
 * production wiring would call the model gateway here.
 */
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import {
  characterActors,
  moments,
  worldEvents,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';

export interface LifeTickResult {
  considered: number;
  generated: number;
}

const MAX_PER_TICK = 8;

export async function runLifeTick(
  db: Database,
  now: Date = new Date(),
): Promise<LifeTickResult> {
  const due = await db
    .select()
    .from(characterActors)
    .where(
      sql`${characterActors.nextSimulationAfter} IS NULL OR ${characterActors.nextSimulationAfter} <= ${now.toISOString()}`,
    )
    .orderBy(asc(characterActors.lastSimulatedAt))
    .limit(MAX_PER_TICK);

  let generated = 0;
  for (const ch of due) {
    const candidate = await candidateEvent(ch);
    if (!candidate) continue;
    const momentId = newId<string>();
    await db.transaction(async (tx) => {
      await tx.insert(moments).values({
        id: momentId,
        actorId: ch.actorId,
        socialGraphId: ch.socialGraphId,
        content: candidate,
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
        payload: { source: 'scheduler_stub' },
        visibilityPolicy: { public_within_graph: true },
        idempotencyKey: `native_world_event:${momentId}`,
      });
      await tx
        .update(characterActors)
        .set({
          lastSimulatedAt: now,
          nextSimulationAfter: new Date(now.getTime() + 30 * 60_000),
        })
        .where(eq(characterActors.actorId, ch.actorId));
    });
    generated += 1;
  }

  return { considered: due.length, generated };
}

async function candidateEvent(
  ch: typeof characterActors.$inferSelect,
): Promise<string | null> {
  // Stub: 1-in-4 chance of producing an event per tick to keep traffic sparse.
  if (Math.random() > 0.25) return null;
  return `Routine activity from ${ch.actorId} at ${new Date().toISOString()}`;
}

// Keep strict noUnusedLocals satisfied for helper imports.
void and;
void eq;
void isNotNull;