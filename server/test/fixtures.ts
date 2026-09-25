/**
 * Shared PGlite seeding helpers for server integration tests.
 * Minimal rows satisfying NOT NULL constraints; tests insert only what
 * the behavior under test needs.
 */
import { eq } from 'drizzle-orm';
import type { TestDatabase } from './pglite.js';
import {
  accounts,
  actors,
  friendRequests,
  personaTemplates,
  socialGraphs,
} from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';

export interface SeededGraph {
  graphId: string;
  accountId: string;
  humanActorId: string;
  characterActorId: string;
  templateId: string;
}

export async function seedSocialGraph(
  db: TestDatabase,
): Promise<SeededGraph> {
  const graphId = newId<string>();
  await db.insert(socialGraphs).values({ id: graphId });

  const templateId = newId<string>();
  await db.insert(personaTemplates).values({
    id: templateId,
    slug: `test-template-${templateId.slice(0, 8)}`,
    schemaVersion: '1',
    publicName: '米拉',
    canonAnchor: 'official first friend',
    identityPrompt: 'Warm, reliable guide; declines strangers without context.',
    speakingStyle: 'Gentle, concise.',
    rightsStatus: 'original',
    contentPolicyProfile: 'demo_default',
  });

  const accountId = newId<string>();
  await db.insert(accounts).values({
    id: accountId,
    displayName: 'Test Human',
  });

  const humanActorId = newId<string>();
  await db.insert(actors).values({
    id: humanActorId,
    socialGraphId: graphId,
    accountId,
    type: 'human',
    publicName: '测试用户',
  });

  const characterActorId = newId<string>();
  await db.insert(actors).values({
    id: characterActorId,
    socialGraphId: graphId,
    type: 'character',
    publicName: '米拉',
    templateId,
  });

  return { graphId, accountId, humanActorId, characterActorId, templateId };
}

export async function seedFriendRequest(
  db: TestDatabase,
  senderActorId: string,
  recipientActorId: string,
  overrides: Partial<typeof friendRequests.$inferInsert> = {},
): Promise<string> {
  const id = newId<string>();
  await db.insert(friendRequests).values({
    id,
    senderActorId,
    recipientActorId,
    status: 'pending',
    ...overrides,
  });
  return id;
}

export async function requestStatus(
  db: TestDatabase,
  id: string,
): Promise<string> {
  const { friendRequests } = await import('../../db/schema.js');
  const [row] = await db
    .select({ status: friendRequests.status })
    .from(friendRequests)
    .where(eq(friendRequests.id, id))
    .limit(1);
  return row?.status ?? 'missing';
}
