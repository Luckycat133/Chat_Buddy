import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '../test/pglite.js';
import { seedSocialGraph } from '../test/fixtures.js';
import type { Database } from '../../db/index.js';
import {
  appendRelationshipNarrative,
  latestNarrativeVersion,
} from './narrative.js';
import { compilePrompt } from '../runtime/prompts/compiler.js';
import { relationshipNarratives, relationships } from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';
import { resetServerEnvForTests } from '../config.js';

/**
 * Relationship narrative versioning (WEB_IMPLEMENTATION §23 P0-continuity,
 * §12 "version relationship narrative"; DOMAIN_ARCHITECTURE §4.9):
 * append-only history, strictly increasing versions, the prompt compiler
 * renders the highest version, and no affection score exists anywhere.
 */
let db: TestDatabase;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
/** Continuity services accept the production postgres-js Database type. */
let sdb: Database;

beforeEach(async () => {
  const created = await createTestDatabase();
  db = created.db;
  pg = created.pg;
  sdb = created.db as unknown as Database;
  resetServerEnvForTests();
});

afterEach(async () => {
  resetServerEnvForTests();
  await closeTestDatabase(pg);
});

async function seedAcceptedRelationship(): Promise<{
  relId: string;
  seed: Awaited<ReturnType<typeof seedSocialGraph>>;
}> {
  const seed = await seedSocialGraph(db);
  const relId = newId<string>();
  await db.insert(relationships).values({
    id: relId,
    socialGraphId: seed.graphId,
    actorAId: seed.humanActorId,
    actorBId: seed.characterActorId,
    state: 'accepted',
    initiatedBy: seed.humanActorId,
  });
  return { relId, seed };
}

describe('appendRelationshipNarrative', () => {
  it('creates strictly increasing versions from 1', async () => {
    const { relId } = await seedAcceptedRelationship();

    const v1 = await appendRelationshipNarrative(sdb, {
      relationshipId: relId,
      currentDynamic: '刚加上好友，礼貌但保持距离。',
    });
    const v2 = await appendRelationshipNarrative(sdb, {
      relationshipId: relId,
      currentDynamic: '一起看过两次展，开始主动分享日常。',
      changedByEventIds: ['11111111-1111-4111-8111-111111111111'],
      modelMetadata: { model: 'test-model', generatedAt: '2026-09-25T00:00:00Z' },
    });

    expect(v1).toEqual({ relationshipId: relId, version: 1 });
    expect(v2).toEqual({ relationshipId: relId, version: 2 });
    expect(await latestNarrativeVersion(sdb, relId)).toBe(2);
  });

  it('persists narrative fields and provenance metadata', async () => {
    const { relId } = await seedAcceptedRelationship();
    await appendRelationshipNarrative(sdb, {
      relationshipId: relId,
      currentDynamic: '互换了联系方式。',
      meaningfulHistory: [{ summary: '展会初识' }],
      trustAndUncertainty: '信任建立中',
      tensions: ['聊天频率不一致'],
      boundaries: ['不聊工作收入'],
      openThreads: ['约了周末爬山'],
      relationshipDirection: '双向靠近',
      changedByEventIds: ['22222222-2222-4222-8222-222222222222'],
      modelMetadata: { template: 'mira', revision: 3 },
    });

    const [row] = await db
      .select()
      .from(relationshipNarratives)
      .where(eq(relationshipNarratives.relationshipId, relId));
    expect(row).toBeTruthy();
    expect(row!.version).toBe(1);
    expect(row!.currentDynamic).toBe('互换了联系方式。');
    expect(row!.meaningfulHistory).toEqual([{ summary: '展会初识' }]);
    expect(row!.trustAndUncertainty).toBe('信任建立中');
    expect(row!.tensions).toEqual(['聊天频率不一致']);
    expect(row!.boundaries).toEqual(['不聊工作收入']);
    expect(row!.openThreads).toEqual(['约了周末爬山']);
    expect(row!.relationshipDirection).toBe('双向靠近');
    expect(row!.changedByEventIds).toEqual([
      '22222222-2222-4222-8222-222222222222',
    ]);
    expect(row!.modelMetadata).toEqual({ template: 'mira', revision: 3 });
  });

  it('fails loudly on a duplicate version (composite PK)', async () => {
    const { relId } = await seedAcceptedRelationship();
    await appendRelationshipNarrative(sdb, {
      relationshipId: relId,
      currentDynamic: 'v1',
    });
    await expect(
      db.insert(relationshipNarratives).values({
        relationshipId: relId,
        version: 1,
        currentDynamic: 'duplicate v1',
      }),
    ).rejects.toThrow();
  });

  it('is isolated per relationship', async () => {
    const { relId: relA } = await seedAcceptedRelationship();
    const { relId: relB } = await seedAcceptedRelationship();
    await appendRelationshipNarrative(sdb, {
      relationshipId: relA,
      currentDynamic: 'A 的故事',
    });
    expect(await latestNarrativeVersion(sdb, relB)).toBe(0);
  });
});

describe('prompt compiler renders the highest narrative version', () => {
  it('uses the latest version, never an older one', async () => {
    const { relId, seed } = await seedAcceptedRelationship();
    await appendRelationshipNarrative(sdb, {
      relationshipId: relId,
      currentDynamic: 'VERSION-ONE-动态',
    });
    await appendRelationshipNarrative(sdb, {
      relationshipId: relId,
      currentDynamic: 'VERSION-TWO-动态',
    });

    const sections = await compilePrompt(sdb, {
      actorId: seed.characterActorId,
      conversationId: '00000000-0000-4000-8000-000000000000',
      burstId: '',
    });
    expect(sections.relationship).toContain('VERSION-TWO-动态');
    expect(sections.relationship).not.toContain('VERSION-ONE-动态');
  });
});
