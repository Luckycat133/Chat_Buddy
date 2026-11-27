import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../db/index.js';
import { accountPortableBackups, accounts, actors, conversations, conversationMembers, messages } from '../../db/schema.js';
import { PortableBackupSchema, type PortableBackup } from '../../shared/contracts/portable-backup.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import { buildServer } from '../index.js';
import { seedSocialGraph } from '../test/fixtures.js';
import { closeTestDatabase, createTestDatabase } from '../test/pglite.js';

let app: FastifyInstance;
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let db: Database;
const golden = readFileSync(new URL('../../docs/fixtures/web-v2-cloud-backup-golden.json', import.meta.url), 'utf8');
const fixtureData = PortableBackupSchema.parse(JSON.parse(golden));
const binding = fixtureData.cloudAccount!;
const endpoint = '/v1/account/backup';
const auth = (accessToken: string) => ({ authorization: `Bearer ${accessToken}` });
const upload = (accessToken: string, document: string) => app.inject({
  method: 'PUT', url: endpoint, headers: auth(accessToken), payload: { document },
});
const download = (accessToken: string, suffix = '') => app.inject({ method: 'GET', url: endpoint + suffix, headers: auth(accessToken) });

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/test');
  vi.stubEnv('SESSION_SIGNING_KEY', 'a'.repeat(64));
  vi.stubEnv('LOG_LEVEL', 'silent');
  resetServerEnvForTests();
  fixture = await createTestDatabase();
  db = fixture.db as unknown as Database;
  app = await buildServer({ db, listen: false });
});
afterAll(async () => {
  await app?.close();
  if (fixture) await closeTestDatabase(fixture.pg);
  vi.unstubAllEnvs();
  resetServerEnvForTests();
});

it('round-trips the exact shared Web/iOS golden, scopes it to one account and rolls back rejected replacements', async () => {
  const graph = await seedSocialGraph(fixture.db);
  const other = await seedSocialGraph(fixture.db);
  await db.insert(accounts).values({ id: binding.accountId, displayName: binding.displayName });
  await db.insert(actors).values({ id: binding.actorId, accountId: binding.accountId, socialGraphId: graph.graphId, type: 'human', publicName: binding.displayName });
  const cloudConversation = binding.conversations[0]!.id;
  const peer = binding.conversations[0]!.messages[1]!.senderActorId;
  await db.insert(actors).values({ id: peer, socialGraphId: graph.graphId, type: 'character', publicName: 'fixture-peer', templateId: graph.templateId });
  await db.insert(conversations).values({ id: cloudConversation, socialGraphId: graph.graphId, type: 'direct', createdByActorId: binding.actorId });
  await db.insert(conversationMembers).values([
    { conversationId: cloudConversation, actorId: binding.actorId, status: 'active' },
    { conversationId: cloudConversation, actorId: peer, status: 'active' },
  ]);
  const owner = (await issueTokens(db, binding.accountId)).accessToken;
  const stranger = (await issueTokens(db, other.accountId)).accessToken;
  expect((await download(stranger)).statusCode).toBe(404);
  expect((await upload(stranger, golden)).statusCode).toBe(403);
  const first = await upload(owner, golden);
  expect(first.statusCode).toBe(200);
  expect(first.json().updated).toBe(true);
  expect((await upload(owner, golden)).json()).toEqual({ sha256: first.json().sha256, updated: false });
  const read = await download(owner);
  expect(read.headers['cache-control']).toBe('private, no-store');
  expect(read.body).toBe(golden);
  const transferred = PortableBackupSchema.parse(read.json());
  expect(transferred.cloudAccount?.conversations[0]?.messages[1]?.replyToMessageId).toBe('cloud-message-1');
  expect(transferred.cloudAccount?.conversations[0]?.messages[0]?.attachmentIds).toEqual(['cloud-inline-1']);
  expect(createHash('sha256').update(Buffer.from(transferred.attachments![0]!.contentBase64!, 'base64')).digest('hex'))
    .toBe('1d4b76d057042b92d4f9ae29eed2ca0ee1f4baa28f17f3e72163aec022273e78');
  expect((await upload(owner, read.body)).json().updated).toBe(false);
  for (const corruption of [
    (copy: PortableBackup) => { copy.attachments![0]!.byteLength += 1; },
    (copy: PortableBackup) => { copy.cloudAccount!.conversations[0]!.messages[0]!.attachmentIds = ['absent']; },
    (copy: PortableBackup) => { copy.localStorage['cb.refresh_token'] = 'synthetic-placeholder'; },
    (copy: PortableBackup) => { copy.localStorage['chat-buddy:api-config'] = '{"provider":{"api_key":"synthetic"}}'; },
    (copy: PortableBackup) => { copy.indexedDB['chat-buddy-main']!.kv[0]!.value = '{"privateKey":"synthetic"}'; },
    (copy: PortableBackup) => { copy.cloudAccount!.conversations[0]!.messages.push(copy.cloudAccount!.conversations[0]!.messages[0]!); },
  ]) {
    const copy = structuredClone(fixtureData); corruption(copy);
    expect((await upload(owner, JSON.stringify(copy))).statusCode).toBe(422);
    expect((await download(owner)).body).toBe(golden);
  }
  const missingStore = structuredClone(fixtureData);
  Reflect.deleteProperty(missingStore.indexedDB['chat-buddy-images']!, 'images');
  expect((await upload(owner, JSON.stringify(missingStore))).statusCode).toBe(422);
  expect((await download(owner)).body).toBe(golden);
  const invalidStores = [
    { 'chat-buddy-memories': { memories: [{ text: 'missing-id' }] } },
    { 'chat-buddy-memories': { memories: [{ id: 'repeat' }, { id: 'repeat' }] } },
    { 'chat-buddy-agents': { 'custom-agents': [{ name: 'missing-id' }] } },
    { 'chat-buddy-agents': { 'custom-agents': [{ id: 'repeat' }, { id: 'repeat' }] } },
    { 'chat-buddy-trivia': { quiz_history: [{ score: 1 }] } },
    { 'chat-buddy-trivia': { quiz_history: [{ id: 'repeat' }, { id: 'repeat' }] } },
  ];
  for (const store of invalidStores) {
    const raw = JSON.parse(golden);
    Object.assign(raw.indexedDB, store);
    expect((await upload(owner, JSON.stringify(raw))).statusCode).toBe(422);
    expect((await download(owner)).body).toBe(golden);
  }
  // Tiny fixtures cross explicit validation boundaries without load tests.
  const tooDeep = JSON.parse(golden);
  tooDeep.localStorage['chat-buddy-meta'] = JSON.parse('['.repeat(65) + '0' + ']'.repeat(65));
  const limited = await upload(owner, JSON.stringify(tooDeep));
  expect(limited.statusCode).toBe(422);
  expect((await download(owner)).body).toBe(golden);
  const invalidEnvelope = await app.inject({
    method: 'PUT', url: endpoint, headers: auth(owner),
    payload: { document: golden, unwanted: { nested: true } },
  });
  expect(invalidEnvelope.statusCode).toBe(422);
  expect((await download(owner)).body).toBe(golden);
  const untrusted = structuredClone(fixtureData);
  untrusted.cloudAccount!.conversations[0]!.messages[1]!.senderActorId = other.humanActorId;
  expect((await upload(owner, JSON.stringify(untrusted))).statusCode).toBe(403);
  expect((await download(owner)).body).toBe(golden);
  await fixture.pg.exec(`CREATE FUNCTION reject_test_backup() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'fixture transaction abort'; END;
  $$; CREATE TRIGGER reject_backup AFTER UPDATE ON account_portable_backups
    FOR EACH ROW EXECUTE FUNCTION reject_test_backup();`);
  try {
    expect((await upload(owner, golden.trim())).statusCode).toBe(500);
    expect((await download(owner)).body).toBe(golden);
  } finally {
    await fixture.pg.exec('DROP TRIGGER reject_backup ON account_portable_backups; DROP FUNCTION reject_test_backup();');
  }
  expect((await db.select().from(accountPortableBackups).where(eq(accountPortableBackups.accountId, binding.accountId)))).toHaveLength(1);
});

it('exports exactly the caller’s live visible session with ordered messages, and can reimport/re-export it', async () => {
  const owner = await seedSocialGraph(fixture.db);
  const stranger = await seedSocialGraph(fixture.db);
  const access = (await issueTokens(db, owner.accountId)).accessToken;
  const visible = randomUUID(), hidden = randomUUID(), other = randomUUID(), deletedId = randomUUID();
  await db.insert(conversations).values([
    { id: visible, type: 'direct', socialGraphId: owner.graphId, createdByActorId: owner.humanActorId, publicName: 'Back up my chat' },
    { id: hidden, type: 'hidden_ai_direct', socialGraphId: owner.graphId, createdByActorId: owner.characterActorId },
    { id: other, type: 'direct', socialGraphId: stranger.graphId, createdByActorId: stranger.humanActorId },
  ]);
  await db.insert(conversationMembers).values([
    { conversationId: visible, actorId: owner.humanActorId, status: 'active', lastReadSequence: 2 },
    { conversationId: hidden, actorId: owner.humanActorId, status: 'active' },
    { conversationId: visible, actorId: owner.characterActorId, status: 'active' },
    { conversationId: other, actorId: stranger.humanActorId, status: 'active' },
  ]);
  await db.insert(messages).values([
    { conversationId: visible, senderActorId: owner.humanActorId, sequence: 2, clientIdempotencyKey: 'fixture-2', kind: 'text', content: '第二条', structuredPayload: { details: { retained: true } } },
    { conversationId: visible, senderActorId: owner.characterActorId, sequence: 1, clientIdempotencyKey: 'fixture-1', kind: 'image', content: '第一条', structuredPayload: { attachments: [fixtureData.attachments![0]] } },
    { id: deletedId, conversationId: visible, senderActorId: owner.characterActorId, sequence: 3, clientIdempotencyKey: 'fixture-deleted', kind: 'text', content: 'deleted-body', deletedAt: new Date() },
    { conversationId: hidden, senderActorId: owner.characterActorId, sequence: 1, clientIdempotencyKey: 'hidden-fixture', kind: 'text', content: 'hidden-body' },
    { conversationId: other, senderActorId: stranger.humanActorId, sequence: 1, clientIdempotencyKey: 'other-fixture', kind: 'text', content: 'other-body' },
  ]);
  const live = await download(access, '/live');
  expect(live.statusCode).toBe(200);
  const exported = PortableBackupSchema.parse(live.json());
  expect(exported.cloudAccount?.actorId).toBe(owner.humanActorId);
  expect(exported.cloudAccount?.conversations.map(c => c.id)).toEqual([visible]);
  expect(exported.cloudAccount?.conversations[0]!.lastReadSequence).toBe(2);
  expect(exported.cloudAccount?.conversations[0]!.messages.map(m => m.content)).toEqual(['第一条','第二条']);
  expect(exported.attachments?.[0]).toEqual(fixtureData.attachments?.[0]);
  expect(exported.cloudAccount?.conversations[0]!.messages[0]!.attachmentIds).toEqual(['cloud-inline-1']);
  expect(live.body).not.toMatch(/(?:other-body|hidden-body|deleted-body|appleSubject|refreshToken)/);
  expect((await upload(access, live.body)).statusCode).toBe(200);
  expect((await download(access)).body).toBe(live.body);
});


it('follows active cross-graph group membership, omits pre-join history, and walks message pages without gaps', async () => {
  const owner = await seedSocialGraph(fixture.db);
  const host = await seedSocialGraph(fixture.db);
  const access = (await issueTokens(db, owner.accountId)).accessToken;
  const group = randomUUID();
  const joinedAt = new Date('2026-10-01T00:00:00.000Z');
  await db.insert(conversations).values({ id: group, type: 'group', socialGraphId: host.graphId, createdByActorId: host.humanActorId });
  await db.insert(conversationMembers).values([
    { conversationId: group, actorId: owner.humanActorId, status: 'active', joinedAt },
    { conversationId: group, actorId: host.humanActorId, status: 'active', joinedAt: new Date('2026-09-30T00:00:00.000Z') },
  ]);
  await db.insert(messages).values(Array.from({ length: 260 }, (_, sequence) => ({
    conversationId: group, senderActorId: host.humanActorId, sequence,
    clientIdempotencyKey: 'fixture-sequence-' + String(sequence), kind: 'text' as const,
    content: sequence === 0 ? 'never-export-prejoin' : String(sequence),
    createdAt: new Date(joinedAt.getTime() + sequence * 1000 - 1000),
  })));
  const live = await download(access, '/live');
  expect(live.statusCode).toBe(200);
  const document = PortableBackupSchema.parse(live.json());
  expect(document.cloudAccount?.conversations[0]?.id).toBe(group);
  expect(document.cloudAccount?.conversations[0]?.messages.map(message => message.sequence))
    .toEqual(Array.from({ length: 259 }, (_, index) => index + 1));
  expect(live.body).not.toContain('never-export-prejoin');
  expect((await upload(access, live.body)).statusCode).toBe(200);
  expect((await download(access)).body).toBe(live.body);
});
