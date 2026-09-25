/**
 * Resolves the social graph an actor belongs to. World-event projections
 * must always carry the actors' real graph: a hardcoded demo-graph id
 * breaks any runtime whose actors live outside the seeded demo graph
 * (tests, multi-graph deployments).
 */
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { actors } from '../../db/schema.js';

export async function actorGraphId(
  db: Database,
  actorId: string,
): Promise<string> {
  const [row] = await db
    .select({ socialGraphId: actors.socialGraphId })
    .from(actors)
    .where(eq(actors.id, actorId))
    .limit(1);
  if (!row) {
    throw new Error(`actor not found: ${actorId}`);
  }
  return row.socialGraphId;
}
