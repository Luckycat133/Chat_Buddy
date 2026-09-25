/**
 * Relationship narrative versioning per DOMAIN_ARCHITECTURE §4.9 and
 * WEB_IMPLEMENTATION §12 ("version relationship narrative").
 *
 * Narratives are append-only: every meaningful change inserts a new
 * (relationship_id, version) row; history is never overwritten. The
 * prompt compiler always renders the highest version. No affection
 * score is part of the model (§4.9).
 */
import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { relationshipNarratives } from '../../db/schema.js';

export interface NarrativeVersionInput {
  relationshipId: string;
  currentDynamic: string;
  meaningfulHistory?: unknown[];
  trustAndUncertainty?: string;
  tensions?: unknown[];
  boundaries?: unknown[];
  openThreads?: unknown[];
  relationshipDirection?: string;
  changedByEventIds?: string[];
  modelMetadata?: Record<string, unknown>;
}

export interface NarrativeVersion {
  relationshipId: string;
  version: number;
}

/** Highest existing version for a relationship; 0 when none yet. */
export async function latestNarrativeVersion(
  db: Database,
  relationshipId: string,
): Promise<number> {
  const [row] = await db
    .select({ version: relationshipNarratives.version })
    .from(relationshipNarratives)
    .where(eq(relationshipNarratives.relationshipId, relationshipId))
    .orderBy(desc(relationshipNarratives.version))
    .limit(1);
  return row?.version ?? 0;
}

/**
 * Insert the next sequential version of the narrative. Version numbers
 * start at 1 and strictly increase; the composite primary key makes
 * concurrent duplicate versions fail loudly.
 */
export async function appendRelationshipNarrative(
  db: Database,
  input: NarrativeVersionInput,
): Promise<NarrativeVersion> {
  const version = (await latestNarrativeVersion(db, input.relationshipId)) + 1;
  await db.insert(relationshipNarratives).values({
    relationshipId: input.relationshipId,
    version,
    currentDynamic: input.currentDynamic,
    meaningfulHistory: input.meaningfulHistory ?? [],
    trustAndUncertainty: input.trustAndUncertainty ?? '',
    tensions: input.tensions ?? [],
    boundaries: input.boundaries ?? [],
    openThreads: input.openThreads ?? [],
    relationshipDirection: input.relationshipDirection ?? '',
    changedByEventIds: input.changedByEventIds ?? [],
    modelMetadata: input.modelMetadata ?? {},
  });
  return { relationshipId: input.relationshipId, version };
}
