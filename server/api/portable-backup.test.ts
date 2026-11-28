import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../db/index.js';
import { accountPortableBackups, accountPortableMergeQuotas, accounts, actors, conversations, conversationMembers, messages, worldEvents } from '../../db/schema.js';
import { PortableBackupSchema, type PortableBackup } from '../../shared/contracts/portable-backup.js';
import { issueTokens } from '../auth/session.js';
import { resetServerEnvForTests } from '../config.js';
import { buildServer } from '../index.js';
import { portableMergeQuota } from '../services/portable-merge.js';
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

it('merges only private self-authored rows and rolls back a failed multi-message transaction', async () => {
  const owner = await seedSocialGraph(fixture.db);
  const other = await seedSocialGraph(fixture.db);
  const headers = auth((await issueTokens(db, owner.accountId)).accessToken);
  const outside = auth((await issueTokens(db, other.accountId)).accessToken);
  const privateId = randomUUID(), sharedId = randomUUID(), deletedId = randomUUID();
  await db.insert(conversations).values([privateId, sharedId, deletedId].map(id =>
    ({ id, type: 'direct' as const, socialGraphId: owner.graphId, createdByActorId: owner.humanActorId })));
  await db.insert(conversationMembers).values([
    ...[privateId, sharedId, deletedId].map(conversationId => ({ conversationId, actorId: owner.humanActorId, status: 'active' as const })),
    { conversationId: privateId, actorId: owner.characterActorId, status: 'active' },
    { conversationId: sharedId, actorId: other.humanActorId, status: 'left' },
  ]);
  const timestamp = new Date('2026-11-02T02:03:04.000Z');
  const make = (content: string, sequence: number, more: Partial<NonNullable<PortableBackup['cloudAccount']>['conversations'][number]['messages'][number]> = {}) => ({
    id: randomUUID(), senderActorId: owner.humanActorId, sequence, content, kind: 'text', status: 'accepted',
    createdAt: timestamp.toISOString(), editedAt: null, replyToMessageId: null, structuredPayload: null, ...more,
  });
  const old = make('Old value from stale backup', 1);
  const removed = make('Deleted value must never revive', 2);
  const first = make('First missing', 3, { attachmentIds: [fixtureData.attachments![0]!.id] });
  const second = make('Second missing', 4, { replyToMessageId: first.id, attachmentIds: [fixtureData.attachments![0]!.id] });
  await db.insert(messages).values([
    { id: old.id, conversationId: privateId, senderActorId: owner.humanActorId, sequence: 1, content: 'Newer online value', kind: 'text', status: 'accepted', clientIdempotencyKey: old.id, createdAt: timestamp },
    { id: removed.id, conversationId: privateId, senderActorId: owner.humanActorId, sequence: 2, content: removed.content, kind: 'text', status: 'accepted', clientIdempotencyKey: removed.id, createdAt: timestamp, deletedAt: timestamp },
  ]);
  const draft = structuredClone(fixtureData);
  const prototype = binding.conversations[0]!;
  draft.cloudAccount = { ...binding, accountId: owner.accountId, actorId: owner.humanActorId, conversations: [
    { ...prototype, id: privateId, type: 'direct', messages: [
      old, removed, first, second,
      make('Character archive row must not be inserted', 5, { senderActorId: owner.characterActorId }),
      make('Unsafe structured payload', 6, { structuredPayload: { command: 'synthetic' } }),
      make('Cannot link deleted target', 7, { replyToMessageId: removed.id }),
      make('x'.repeat(32_001), 8),
    ] },
    { ...prototype, id: sharedId, type: 'direct', messages: [make('Shared chat forbidden', 1)] },
    { ...prototype, id: deletedId, type: 'direct', messages: [make('Conversation deleted after upload', 1)] },
  ] };
  const archive = JSON.stringify(draft);
  expect((await app.inject({ url: endpoint, method: 'PUT', headers, payload: { document: archive } })).statusCode).toBe(200);
  await db.update(conversations).set({ status: 'deleted' }).where(eq(conversations.id, deletedId));
  const post = (suffix: string, payload: unknown, h = headers) => app.inject({ method: 'POST', url: endpoint + '/merge/' + suffix, headers: h, payload: JSON.stringify(payload) });
  // Fastify's custom parser requires an explicit JSON type when payload is text.
  headers['content-type' as keyof typeof headers] = 'application/json';
  outside['content-type' as keyof typeof outside] = 'application/json';
  expect((await post('preview', {}, outside)).statusCode).toBe(404);
  const initial = await post('preview', {});
  expect(initial.statusCode, initial.body).toBe(200);
  const preview = initial.json();
  expect(preview.counts.conversations).toEqual({ insert: 0, skip: 1, conflict: 2 });
  expect(preview.counts.messages).toEqual({ insert: 2, skip: 0, conflict: 8 });
  expect(preview.counts.attachments).toEqual({ insert: 1, skip: 1, conflict: 0 });
  expect(preview.conflicts.conversations).toEqual([sharedId, deletedId]);
  expect(preview.conflicts.messages).toContain(removed.id);
  const write = (previewToken = preview.previewToken, confirm = true) => post('commit', { previewToken, confirm });
  expect((await write(preview.previewToken, false)).statusCode).toBe(422);
  expect((await write('bad-token')).statusCode).toBe(409);
  expect((await db.select().from(messages)).map(m => m.id)).not.toContain(first.id);
  await fixture.pg.exec(`CREATE FUNCTION reject_archived_row() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.content = 'Second missing' THEN RAISE EXCEPTION 'synthetic insert rollback'; END IF; RETURN NEW; END;
    $$; CREATE TRIGGER reject_archive_insert AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION reject_archived_row();`);
  try {
    const failed = await write();
    expect(failed.statusCode).toBe(502);
    expect(failed.body).toContain('Private archive merge did not complete');
    expect(failed.body).not.toContain('Second missing');
    const rows = await db.select().from(messages).where(eq(messages.conversationId, privateId));
    expect(rows).toHaveLength(2);
    expect(await db.select().from(accountPortableMergeQuotas).where(eq(accountPortableMergeQuotas.accountId, owner.accountId))).toEqual([]);
    expect(rows.find(m => m.id === old.id)?.content).toBe('Newer online value');
  } finally {
    await fixture.pg.exec('DROP TRIGGER reject_archive_insert ON messages; DROP FUNCTION reject_archived_row();');
  }
  const worldBefore = await db.select({ id: worldEvents.id }).from(worldEvents).where(eq(worldEvents.conversationId, privateId));
  const success = await write();
  expect(success.statusCode, success.body).toBe(200);
  expect(await db.select({ id: worldEvents.id }).from(worldEvents).where(eq(worldEvents.conversationId, privateId))).toEqual(worldBefore);
  expect(success.json().affectedConversationStarts).toEqual({ [privateId]: 3 });
  const rows = await db.select().from(messages).where(eq(messages.conversationId, privateId));
  const recovered = rows.find(row => row.content === first.content);
  const reply = rows.find(row => row.content === second.content);
  expect(recovered?.id).not.toBe(first.id);
  expect(reply?.replyToMessageId).toBe(recovered?.id);
  expect(reply?.sequence).toBe(4);
  expect(recovered?.structuredPayload).toEqual({
    attachments: [{ ...fixtureData.attachments![0], id: expect.stringMatching(/^backup:[0-9a-f]{64}$/) }],
  });
  expect(recovered?.structuredPayload).toEqual(reply?.structuredPayload);
  expect((await write()).statusCode).toBe(409);
  const again = (await post('preview', {})).json();
  expect(again.counts.messages).toEqual({ insert: 0, skip: 2, conflict: 8 });
  expect(again.counts.attachments.insert).toBe(0);
  expect((await download(headers.authorization.slice(7))).body).toBe(archive);
});

it('namespaces repeated source attachment IDs across two exportable private conversations', async () => {
  const owner = await seedSocialGraph(fixture.db);
  const access = (await issueTokens(db, owner.accountId)).accessToken;
  const destinations = [randomUUID(), randomUUID()];
  await db.insert(conversations).values(destinations.map(id =>
    ({ id, socialGraphId: owner.graphId, type: 'direct' as const, createdByActorId: owner.humanActorId })));
  await db.insert(conversationMembers).values(destinations.map(conversationId =>
    ({ conversationId, actorId: owner.humanActorId, status: 'active' as const })));
  const post = (step: string, payload: object) => app.inject({
    method: 'POST', url: endpoint + '/merge/' + step, payload, headers: auth(access),
  });
  for (const [index, id] of destinations.entries()) {
    const draft = structuredClone(fixtureData);
    const attachment = draft.attachments![0]!;
    attachment.name = `synthetic-image-${index}.png`;
    const original = binding.conversations[0]!;
    draft.cloudAccount = { ...binding, accountId: owner.accountId, actorId: owner.humanActorId, conversations: [{
      ...original, id, type: 'direct', messages: [{
        ...original.messages[0]!, id: randomUUID(), senderActorId: owner.humanActorId,
        structuredPayload: null, attachmentIds: [attachment.id],
      }],
    }] };
    expect((await upload(access, JSON.stringify(draft))).statusCode).toBe(200);
    const preview = await post('preview', {});
    expect(preview.statusCode, preview.body).toBe(200);
    const commit = await post('commit', { previewToken: preview.json().previewToken, confirm: true });
    expect(commit.statusCode, commit.body).toBe(200);
    expect(commit.json().counts.messages.insert).toBe(1);
  }
  const live = await download(access, '/live');
  expect(live.statusCode, live.body).toBe(200);
  const attachments = PortableBackupSchema.parse(live.json()).attachments!;
  expect(attachments).toHaveLength(2);
  expect(attachments[0]?.id).not.toBe(attachments[1]?.id);
  expect(attachments.map(a => a.name).sort()).toEqual(['synthetic-image-0.png', 'synthetic-image-1.png']);
  expect(attachments.map(a => a.contentBase64)).toEqual(Array(2).fill(fixtureData.attachments![0]!.contentBase64));
});

it('charges durable per-account merge quotas once and cannot reset them by replacing the archive', async () => {
  const owner = await seedSocialGraph(fixture.db);
  const access = (await issueTokens(db, owner.accountId)).accessToken;
  const cid = randomUUID();
  await db.insert(conversations).values({ id: cid, socialGraphId: owner.graphId, type: 'direct', createdByActorId: owner.humanActorId });
  await db.insert(conversationMembers).values({ conversationId: cid, actorId: owner.humanActorId, status: 'active' });
  const head = draftDocument();
  function draftDocument(): PortableBackup {
    const draft = structuredClone(fixtureData);
    const prototype = binding.conversations[0]!;
    draft.cloudAccount = { ...binding, accountId: owner.accountId, actorId: owner.humanActorId, conversations: [{
      ...prototype, id: cid, type: 'direct', messages: [{
        ...prototype.messages[0]!, id: randomUUID(), senderActorId: owner.humanActorId, kind: 'text',
        structuredPayload: null, attachmentIds: [draft.attachments![0]!.id],
      }],
    }] };
    return draft;
  }
  const quota = () => db.select().from(accountPortableMergeQuotas).where(eq(accountPortableMergeQuotas.accountId, owner.accountId));
  const post = (step: string, payload: object) => app.inject({
    method: 'POST', url: endpoint + '/merge/' + step, payload, headers: auth(access),
  });
  const confirm = async () => {
    const preview = await post('preview', {});
    expect(preview.statusCode, preview.body).toBe(200);
    return post('commit', { previewToken: preview.json().previewToken, confirm: true });
  };
  expect((await upload(access, JSON.stringify(head))).statusCode).toBe(200);
  expect((await confirm()).statusCode).toBe(200);
  const state = (await quota())[0]!;
  expect(state).toMatchObject({ lifetimeRows: 1, windowRows: 1, windowCommits: 1 });
  expect(state.lifetimeBytes).toBeGreaterThan(head.attachments![0]!.byteLength);
  expect((await confirm()).json().counts.messages.insert).toBe(0);
  expect(await quota()).toEqual([state]);
  for (const [limited, reset, reason] of [
    [{ windowCommits: portableMergeQuota.windowCommits }, { windowCommits: 1 }, 'daily'],
    [{ windowRows: portableMergeQuota.windowRows }, { windowRows: 1 }, 'daily'],
    [{ windowBytes: portableMergeQuota.windowBytes }, { windowBytes: state.windowBytes }, 'daily'],
    [{ lifetimeRows: portableMergeQuota.lifetimeRows }, { lifetimeRows: 1 }, 'cumulative'],
    [{ lifetimeBytes: portableMergeQuota.lifetimeBytes }, { lifetimeBytes: state.lifetimeBytes }, 'cumulative'],
  ] as const) {
    await db.update(accountPortableMergeQuotas).set(limited).where(eq(accountPortableMergeQuotas.accountId, owner.accountId));
    expect((await upload(access, JSON.stringify(draftDocument()))).statusCode).toBe(200);
    const charged = await quota();
    const blocked = await confirm();
    expect(blocked.statusCode, blocked.body).toBe(429);
    expect(blocked.body).toContain(reason);
    expect(await quota()).toEqual(charged);
    expect(await db.select().from(messages).where(eq(messages.conversationId, cid))).toHaveLength(1);
    await db.update(accountPortableMergeQuotas).set(reset).where(eq(accountPortableMergeQuotas.accountId, owner.accountId));
  }
  await db.update(accountPortableMergeQuotas).set({
    windowStartedAt: new Date(Date.now() - portableMergeQuota.windowMs - 1000),
    windowRows: portableMergeQuota.windowRows, windowBytes: portableMergeQuota.windowBytes, windowCommits: portableMergeQuota.windowCommits,
  }).where(eq(accountPortableMergeQuotas.accountId, owner.accountId));
  expect((await confirm()).statusCode).toBe(200);
  expect((await quota())[0]).toMatchObject({ lifetimeRows: 2, windowRows: 1, windowCommits: 1 });
});

it('reopens a retained private conversation only for complete authoritative authors and reply chains', async () => {
  const owner = await seedSocialGraph(fixture.db);
  const other = await seedSocialGraph(fixture.db);
  const access = (await issueTokens(db, owner.accountId)).accessToken;
  const outsider = (await issueTokens(db, other.accountId)).accessToken;
  const cid = randomUUID();
  await db.insert(conversations).values({ id: cid, socialGraphId: owner.graphId, type: 'direct',
    createdByActorId: owner.humanActorId, publicName: 'Synthetic recoverable direct' });
  await db.insert(conversationMembers).values([owner.humanActorId, owner.characterActorId].map(actorId =>
    ({ conversationId: cid, actorId, status: 'active' as const })));
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  await db.insert(messages).values(ids.map((id, i) => ({
    id, conversationId: cid, senderActorId: i ? owner.characterActorId : owner.humanActorId,
    sequence: i + 1, kind: i === 2 ? ('system' as const) : ('text' as const), content: `Trusted original ${i + 1}`,
    structuredPayload: i === 2 ? { source: 'synthetic run' } : null, replyToMessageId: i ? ids[i - 1] : null,
    deletedAt: i === 3 ? new Date() : null, clientIdempotencyKey: id,
  })));
  const original = (await download(access, '/live')).json();
  await db.update(conversations).set({ status: 'deleted' }).where(eq(conversations.id, cid));
  const list = (a = access) => app.inject({ method: 'GET', url: '/v1/conversations', headers: auth(a) });
  const getMessages = (a = access) => app.inject({ method: 'GET', url: `/v1/conversations/${cid}/messages`, headers: auth(a) });
  expect((await list()).json().items).toEqual([]);
  expect((await getMessages()).statusCode).toBe(403);
  expect((await download(access, '/live')).json().cloudAccount.conversations).toEqual([]);
  const forgedOwner = structuredClone(original);
  forgedOwner.cloudAccount.accountId = other.accountId;
  forgedOwner.cloudAccount.actorId = other.humanActorId;
  expect((await upload(outsider, JSON.stringify(forgedOwner))).statusCode).toBe(403);

  const post = (step: string, payload: object) => app.inject({
    method: 'POST', url: endpoint + '/merge/' + step + '?rebuild=1', payload, headers: auth(access),
  });
  const editedMetadata = structuredClone(original);
  editedMetadata.cloudAccount.conversations[0].messages[2].structuredPayload.source = 'untrusted archive edit';
  expect((await upload(access, JSON.stringify(editedMetadata))).statusCode).toBe(200);
  const rejectedProof = (await post('preview', {})).json();
  expect(rejectedProof.unsupportedConversationIds).toEqual([cid]);
  expect(rejectedProof.restoredConversationIds).toEqual([]);
  expect((await getMessages()).statusCode).toBe(403);
  for (const corrupt of [
    (m: Array<{ content: string; senderActorId: string; replyToMessageId: string | null; kind: string }>) => { m[1]!.content = 'fake assistant reply'; },
    (m: Array<{ content: string; senderActorId: string; replyToMessageId: string | null; kind: string }>) => { m[1]!.senderActorId = owner.humanActorId; },
    (m: Array<{ content: string; senderActorId: string; replyToMessageId: string | null; kind: string }>) => { m[2]!.replyToMessageId = null; },
    (m: Array<{ content: string; senderActorId: string; replyToMessageId: string | null; kind: string }>) => { m[1]!.kind = 'system'; },
    (m: Array<{ content: string; senderActorId: string; replyToMessageId: string | null; kind: string }>) => { m.pop(); },
  ]) {
    const forged = structuredClone(original);
    corrupt(forged.cloudAccount.conversations[0].messages);
    expect((await upload(access, JSON.stringify(forged))).statusCode).toBe(200);
    const would = (await post('preview', {})).json();
    expect(would.unsupportedConversationIds).toEqual([cid]);
    const receipt = await post('commit', { previewToken: would.previewToken, confirm: true });
    expect(receipt.statusCode).toBe(200);
    expect(receipt.json().restoredConversationIds).toEqual([]);
    expect((await getMessages()).statusCode).toBe(403);
  }
  expect((await upload(access, JSON.stringify(original))).statusCode).toBe(200);
  const legacy = await app.inject({ method: 'POST', url: endpoint + '/merge/preview', payload: {}, headers: auth(access) });
  expect(Object.keys(legacy.json()).sort()).toEqual(['archiveSha256', 'conflicts', 'counts', 'previewToken']);
  expect(legacy.json().counts.conversations).toEqual({ insert: 0, skip: 0, conflict: 1 });
  const peek = await post('preview', {});
  const plan = peek.json();
  const downgraded = await app.inject({ method: 'POST', url: endpoint + '/merge/commit',
    payload: { previewToken: plan.previewToken, confirm: true }, headers: auth(access) });
  expect(downgraded.statusCode).toBe(409);
  expect(plan.restoredConversationIds).toEqual([cid]);
  expect(plan.counts.messages.insert).toBe(3);
  expect((await list()).json().items).toEqual([]);
  await db.update(messages).set({ content: 'changed authoritative source after preview' }).where(eq(messages.id, ids[1]!));
  expect((await post('commit', { previewToken: plan.previewToken, confirm: true })).statusCode).toBe(409);
  expect((await getMessages()).statusCode).toBe(403);
  await db.update(messages).set({ content: 'Trusted original 2' }).where(eq(messages.id, ids[1]!));
  const refreshed = (await post('preview', {})).json();
  const [q] = await db.insert(accountPortableMergeQuotas).values({
    accountId: owner.accountId, lifetimeRows: 0, lifetimeBytes: 0, windowStartedAt: new Date(),
    windowRows: 0, windowBytes: 0, windowCommits: portableMergeQuota.windowCommits,
  }).returning();
  expect((await post('commit', { previewToken: refreshed.previewToken, confirm: true })).statusCode).toBe(429);
  expect((await getMessages()).statusCode).toBe(403);
  await db.update(accountPortableMergeQuotas).set({ windowCommits: 0 }).where(eq(accountPortableMergeQuotas.accountId, q!.accountId));
  await fixture.pg.exec(`CREATE FUNCTION reject_verified_reopen() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic restore abort'; END; $$;
    CREATE TRIGGER reject_verified_reopen AFTER UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION reject_verified_reopen();`);
  try {
    expect((await post('commit', { previewToken: refreshed.previewToken, confirm: true })).statusCode).toBe(502);
    expect((await getMessages()).statusCode).toBe(403);
    const [rolledBack] = await db.select().from(accountPortableMergeQuotas).where(eq(accountPortableMergeQuotas.accountId, owner.accountId));
    expect(rolledBack).toMatchObject({ lifetimeRows: 0, windowCommits: 0 });
  } finally {
    await fixture.pg.exec('DROP TRIGGER reject_verified_reopen ON conversations; DROP FUNCTION reject_verified_reopen();');
  }
  const ok = await post('commit', { previewToken: refreshed.previewToken, confirm: true });
  expect(ok.statusCode, ok.body).toBe(200);
  expect(ok.json()).toMatchObject({ restoredConversationIds: [cid], affectedConversationIds: [cid], affectedConversationStarts: { [cid]: 1 } });
  expect(ok.json().restoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(Math.abs(Date.parse(ok.json().restoredAt) - Date.now())).toBeLessThan(30_000);
  const timeline = (await getMessages()).json().items;
  expect(await db.select().from(messages).where(eq(messages.conversationId, cid))).toHaveLength(4);
  expect(timeline.map((row: typeof messages.$inferSelect) => [row.id, row.senderActorId, row.kind, row.replyToMessageId])).toEqual([
    [ids[0], owner.humanActorId, 'text', null],
    [ids[1], owner.characterActorId, 'text', ids[0]],
    [ids[2], owner.characterActorId, 'system', ids[1]],
  ]);
  expect((await getMessages(outsider)).statusCode).toBe(403);
  expect((await list()).json().items[0].id).toBe(cid);
  expect((await post('commit', { previewToken: plan.previewToken, confirm: true })).statusCode).toBe(409);
  const next = (await post('preview', {})).json();
  expect(next.counts.messages).toEqual({ insert: 0, skip: 3, conflict: 0 });
  expect(next.restoredConversationIds).toEqual([]);
  const [charged] = await db.select().from(accountPortableMergeQuotas).where(eq(accountPortableMergeQuotas.accountId, owner.accountId));
  expect(charged).toMatchObject({ lifetimeRows: 3, windowCommits: 1 });
  const newer = Array.from({ length: 200 }, () => randomUUID());
  await db.insert(conversations).values(newer.map(id => ({ id, socialGraphId: owner.graphId, type: 'direct' as const,
    createdByActorId: owner.humanActorId, createdAt: new Date(Date.now() + 1000) })));
  await db.insert(conversationMembers).values(newer.map(conversationId => ({ conversationId, actorId: owner.humanActorId, status: 'active' as const })));
  expect((await list()).json().items.some((row: { id: string }) => row.id === cid)).toBe(false);
  const targeted = (a = access) => app.inject({ method: 'GET', url: `/v1/conversations?ids=${cid}`, headers: auth(a) });
  expect((await targeted()).json().items.map((row: { id: string }) => row.id)).toEqual([cid]);
  expect((await targeted(outsider)).json().items).toEqual([]);
});
