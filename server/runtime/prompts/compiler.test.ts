import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '../../test/pglite.js';
import { seedSocialGraph } from '../../test/fixtures.js';
import { compilePrompt, isMemoryPermittedInConversation } from './compiler.js';
import {
  actorCapabilitySettings,
  actors,
  conversationMembers,
  conversations,
  memoryGrants,
  memoryItems,
  personaTemplates,
  relationships,
} from '../../../db/schema.js';
import { newId } from '../../../shared/contracts/ids.js';
import { resetServerEnvForTests } from '../../config.js';
import type { Database } from '../../../db/index.js';

/**
 * Memory provenance + prompt authorization (WEB_IMPLEMENTATION §23
 * P0-continuity "memory provenance", §10; DOMAIN_ARCHITECTURE §5 "Memory"):
 * memories carry provenance into the prompt, and unauthorized memories —
 * deleted, superseded, other-branch private, blocked-relationship, or
 * share-policy-restricted — never enter the prompt.
 */
let db: TestDatabase;
let pg: Awaited<ReturnType<typeof createTestDatabase>>['pg'];
/** The compiler accepts the production postgres-js Database type. */
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

interface Scene {
  seed: Awaited<ReturnType<typeof seedSocialGraph>>;
  otherHumanId: string;
  relWithHuman: string;
  relWithOther: string;
  convWithHuman: string;
  convWithOther: string;
  groupConv: string;
}

async function seedScene(): Promise<Scene> {
  const seed = await seedSocialGraph(db);

  // A second human actor in the same graph.
  const otherHumanId = newId<string>();
  await db.insert(actors).values({
    id: otherHumanId,
    socialGraphId: seed.graphId,
    type: 'human',
    publicName: '另一位用户',
  });

  const mkRel = async (other: string, state: 'accepted' | 'blocked') => {
    const id = newId<string>();
    await db.insert(relationships).values({
      id,
      socialGraphId: seed.graphId,
      actorAId: seed.characterActorId,
      actorBId: other,
      state,
      initiatedBy: seed.characterActorId,
    });
    return id;
  };
  const relWithHuman = await mkRel(seed.humanActorId, 'accepted');
  const relWithOther = await mkRel(otherHumanId, 'accepted');

  const mkConv = async (
    type: 'direct' | 'group',
    memberIds: string[],
  ): Promise<string> => {
    const id = newId<string>();
    await db.insert(conversations).values({
      id,
      socialGraphId: seed.graphId,
      type,
      createdByActorId: seed.characterActorId,
    });
    await db.insert(conversationMembers).values(
      memberIds.map((actorId) => ({
        conversationId: id,
        actorId,
        status: 'active' as const,
        joinedAt: new Date(),
      })),
    );
    return id;
  };
  const convWithHuman = await mkConv('direct', [
    seed.characterActorId,
    seed.humanActorId,
  ]);
  const convWithOther = await mkConv('direct', [
    seed.characterActorId,
    otherHumanId,
  ]);
  const groupConv = await mkConv('group', [
    seed.characterActorId,
    seed.humanActorId,
    otherHumanId,
  ]);

  return {
    seed,
    otherHumanId,
    relWithHuman,
    relWithOther,
    convWithHuman,
    convWithOther,
    groupConv,
  };
}

interface MemorySeed {
  fact: string;
  type: 'private' | 'shared' | 'public' | 'reported' | 'native_world';
  confidence?: 'observed' | 'reported' | 'inferred' | 'uncertain' | 'deceptive_claim';
  relationshipId?: string;
  deleted?: boolean;
  supersededBy?: string;
  sharePolicy?: Record<string, unknown>;
}

async function addMemory(
  ownerActorId: string,
  s: MemorySeed,
): Promise<string> {
  const id = newId<string>();
  await db.insert(memoryItems).values({
    id,
    ownerActorId,
    relationshipId: s.relationshipId ?? null,
    sourceEventId: newId<string>(),
    sourceActorId: ownerActorId,
    type: s.type,
    objectiveFact: s.fact,
    subjectiveInterpretation: '',
    confidence: s.confidence ?? 'observed',
    sharePolicy: s.sharePolicy ?? {},
    deletedAt: s.deleted ? new Date() : null,
    supersededById: s.supersededBy ?? null,
  });
  return id;
}

async function compiledMemorySection(
  actorId: string,
  conversationId: string,
): Promise<string> {
  const sections = await compilePrompt(sdb, {
    actorId,
    conversationId,
    burstId: '',
  });
  return sections.memories;
}

describe('memory provenance in the compiled prompt', () => {
  it('includes owned permitted memories with type/confidence provenance', async () => {
    const s = await seedScene();
    await addMemory(s.seed.characterActorId, {
      fact: '用户喜欢山系咖啡',
      type: 'private',
      relationshipId: s.relWithHuman,
      confidence: 'observed',
    });

    const section = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithHuman,
    );
    expect(section).toContain('- [private/observed] 用户喜欢山系咖啡');
    expect(section).toMatch(/provenance: source_event=[0-9a-f-]{36}/);
  });

  it('excludes deleted memories', async () => {
    const s = await seedScene();
    await addMemory(s.seed.characterActorId, {
      fact: '已被删除的记忆内容',
      type: 'private',
      relationshipId: s.relWithHuman,
      deleted: true,
    });

    const section = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithHuman,
    );
    expect(section).not.toContain('已被删除的记忆内容');
  });

  it('excludes superseded memories', async () => {
    const s = await seedScene();
    const replacement = await addMemory(s.seed.characterActorId, {
      fact: '用户现在改喝燕麦拿铁',
      type: 'private',
      relationshipId: s.relWithHuman,
    });
    await addMemory(s.seed.characterActorId, {
      fact: '用户每天喝美式（旧偏好）',
      type: 'private',
      relationshipId: s.relWithHuman,
      supersededBy: replacement,
    });

    const section = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithHuman,
    );
    expect(section).toContain('用户现在改喝燕麦拿铁');
    expect(section).not.toContain('用户每天喝美式（旧偏好）');
  });

  it('never injects another actor\'s memories', async () => {
    const s = await seedScene();
    await addMemory(s.seed.humanActorId, {
      fact: '人类自己的私密记忆内容',
      type: 'private',
    });

    const section = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithHuman,
    );
    expect(section).not.toContain('人类自己的私密记忆内容');
  });

  it('keeps a relationship-scoped private memory inside its own branch only', async () => {
    const s = await seedScene();
    await addMemory(s.seed.characterActorId, {
      fact: '与用户A的私密约定',
      type: 'private',
      relationshipId: s.relWithHuman,
    });

    // Allowed in the 1:1 conversation with that relationship counterpart.
    const own = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithHuman,
    );
    expect(own).toContain('与用户A的私密约定');

    // Forbidden in the other private branch.
    const other = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithOther,
    );
    expect(other).not.toContain('与用户A的私密约定');

    // Forbidden in a group conversation.
    const group = await compiledMemorySection(
      s.seed.characterActorId,
      s.groupConv,
    );
    expect(group).not.toContain('与用户A的私密约定');
  });

  it('drops relationship-scoped memories once the relationship is blocked', async () => {
    const s = await seedScene();
    await db
      .update(relationships)
      .set({ state: 'blocked' })
      .where(eq(relationships.id, s.relWithOther));
    await addMemory(s.seed.characterActorId, {
      fact: '被拉黑关系里的记忆',
      type: 'private',
      relationshipId: s.relWithOther,
    });

    const section = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithOther,
    );
    expect(section).not.toContain('被拉黑关系里的记忆');
  });

  it('honors share-policy conversation allow-list and deny-list', async () => {
    const s = await seedScene();
    await addMemory(s.seed.characterActorId, {
      fact: '只允许在用户A会话出现的共享记忆',
      type: 'shared',
      sharePolicy: { conversationIds: [s.convWithHuman] },
    });
    await addMemory(s.seed.characterActorId, {
      fact: '被明确排除的共享记忆',
      type: 'shared',
      sharePolicy: { excludeConversationIds: [s.convWithHuman] },
    });

    const own = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithHuman,
    );
    expect(own).toContain('只允许在用户A会话出现的共享记忆');
    expect(own).not.toContain('被明确排除的共享记忆');

    const other = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithOther,
    );
    expect(other).not.toContain('只允许在用户A会话出现的共享记忆');
  });

  it('admits shared/public/reported memories into group conversation', async () => {
    const s = await seedScene();
    await addMemory(s.seed.characterActorId, {
      fact: '公开的展览见闻',
      type: 'public',
    });

    const group = await compiledMemorySection(
      s.seed.characterActorId,
      s.groupConv,
    );
    expect(group).toContain('公开的展览见闻');
  });
});

describe('granted memories in the compiled prompt (grant-recipient path)', () => {
  it('admits an authorized grant into the grantee prompt with grant provenance', async () => {
    const s = await seedScene();
    // The character owns a private memory scoped to its relationship with
    // the human, and explicitly grants the human recall access.
    const memoryId = await addMemory(s.seed.characterActorId, {
      fact: '角色分享给用户的私密约定',
      type: 'private',
      relationshipId: s.relWithHuman,
    });
    await db.insert(memoryGrants).values({
      memoryId,
      granteeActorId: s.seed.humanActorId,
      grantedByEventId: newId<string>(),
      permission: 'know',
    });

    const section = await compiledMemorySection(
      s.seed.humanActorId,
      s.convWithHuman,
    );
    expect(section).toContain('- [private/observed] 角色分享给用户的私密约定');
    expect(section).toMatch(new RegExp(`granted_by=${s.seed.characterActorId}`));
  });

  it('drops an expired grant (fail-closed)', async () => {
    const s = await seedScene();
    const memoryId = await addMemory(s.seed.characterActorId, {
      fact: '授权已过期的记忆',
      type: 'shared',
    });
    await db.insert(memoryGrants).values({
      memoryId,
      granteeActorId: s.seed.humanActorId,
      grantedByEventId: newId<string>(),
      permission: 'know',
      expiresAt: new Date(Date.now() - 1000),
    });

    const section = await compiledMemorySection(
      s.seed.humanActorId,
      s.convWithHuman,
    );
    expect(section).not.toContain('授权已过期的记忆');
  });

  it('keeps a granted relationship-scoped private memory out of other audiences', async () => {
    const s = await seedScene();
    const memoryId = await addMemory(s.seed.characterActorId, {
      fact: '仅限双人对语内存的授权记忆',
      type: 'private',
      relationshipId: s.relWithHuman,
    });
    await db.insert(memoryGrants).values({
      memoryId,
      granteeActorId: s.seed.humanActorId,
      grantedByEventId: newId<string>(),
      permission: 'know',
    });

    // The grant does not widen the audience: a group conversation and the
    // character's other private branch both stay closed.
    const group = await compiledMemorySection(
      s.seed.humanActorId,
      s.groupConv,
    );
    expect(group).not.toContain('仅限双人对语内存的授权记忆');

    const otherBranch = await compiledMemorySection(
      s.seed.characterActorId,
      s.convWithOther,
    );
    expect(otherBranch).not.toContain('仅限双人对语内存的授权记忆');
  });

  it('excludes a granted memory after its source was superseded (fail-closed)', async () => {
    const s = await seedScene();
    const replacement = await addMemory(s.seed.characterActorId, {
      fact: '替代版本的记忆',
      type: 'shared',
    });
    const supersededId = await addMemory(s.seed.characterActorId, {
      fact: '已被替代的授权记忆',
      type: 'shared',
      supersededBy: replacement,
    });
    await db.insert(memoryGrants).values({
      memoryId: supersededId,
      granteeActorId: s.seed.humanActorId,
      grantedByEventId: newId<string>(),
      permission: 'know',
    });

    const section = await compiledMemorySection(
      s.seed.humanActorId,
      s.convWithHuman,
    );
    expect(section).not.toContain('已被替代的授权记忆');
  });
});

describe('isMemoryPermittedInConversation (unit-level contract)', () => {
  it('returns false for a conversation that does not exist', async () => {
    const s = await seedScene();
    const id = await addMemory(s.seed.characterActorId, {
      fact: '任意记忆',
      type: 'public',
    });
    const [row] = await db
      .select()
      .from(memoryItems)
      .where(eq(memoryItems.id, id))
      .limit(1);
    expect(
      await isMemoryPermittedInConversation(sdb, {
        memory: row!,
        conversationId: '00000000-0000-4000-8000-000000000000',
      }),
    ).toBe(false);
  });

  it('never permits a private memory against a non-counterpart audience', async () => {
    const s = await seedScene();
    const id = await addMemory(s.seed.characterActorId, {
      fact: '与其他人无关的私密记忆',
      type: 'private',
      relationshipId: s.relWithHuman,
    });
    const [row] = await db
      .select()
      .from(memoryItems)
      .where(eq(memoryItems.id, id))
      .limit(1);
    expect(
      await isMemoryPermittedInConversation(sdb, {
        memory: row!,
        conversationId: s.convWithOther,
      }),
    ).toBe(false);
  });
});

describe('capability availability section (§19 weather)', () => {
  const compiledCapabilities = async (
    actorId: string,
    conversationId: string,
  ): Promise<string> => {
    const sections = await compilePrompt(sdb, {
      actorId,
      conversationId,
      burstId: '',
    });
    return sections.capabilities;
  };

  it('renders the tool-request contract and ENABLED weather with the default city once the human consents', async () => {
    const s = await seedScene();
    await db
      .update(personaTemplates)
      .set({ capabilities: ['weather', 'light_search'] })
      .where(eq(personaTemplates.id, s.seed.templateId));
    await db.insert(actorCapabilitySettings).values({
      actorId: s.seed.humanActorId,
      weatherCity: '北京',
      weatherConsentAt: new Date(),
    });

    const section = await compiledCapabilities(
      s.seed.characterActorId,
      s.convWithHuman,
    );
    expect(section).toContain('weather, light_search');
    expect(section).toContain('tool_requests');
    expect(section).toContain('ENABLED');
    expect(section).toContain('北京');
    expect(section).not.toContain('NOT ENABLED');
  });

  it('stays fail-closed without consent: NOT ENABLED, no default city, guidance instruction', async () => {
    const s = await seedScene();
    await db
      .update(personaTemplates)
      .set({ capabilities: ['weather'] })
      .where(eq(personaTemplates.id, s.seed.templateId));
    // A default city without consent must not leak into the prompt.
    await db.insert(actorCapabilitySettings).values({
      actorId: s.seed.humanActorId,
      weatherCity: '北京',
      weatherConsentAt: null,
    });

    const section = await compiledCapabilities(
      s.seed.characterActorId,
      s.convWithHuman,
    );
    expect(section).toContain('NOT ENABLED');
    expect(section).toContain('enable the weather capability');
    expect(section).toContain('Never claim you know nothing at all');
    expect(section).not.toContain('北京');
  });

  it('renders (none) for a template without capabilities', async () => {
    const s = await seedScene();
    const section = await compiledCapabilities(
      s.seed.characterActorId,
      s.convWithHuman,
    );
    expect(section).toBe('# Capabilities\n(none)');
  });
});
