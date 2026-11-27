import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { accounts, accountPortableBackups, actors, conversations, conversationMembers, messages } from '../../db/schema.js';
import { MAX_PORTABLE_BACKUP_BYTES, PortableAttachmentSchema } from '../../shared/contracts/portable-backup.js';
import type { PortableBackup } from '../../shared/contracts/portable-backup.js';
import { serverEnv } from '../config.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { conversationAdvisoryKey } from './conversation-writes.js';

const ttl = 5 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const stats = () => ({ insert: 0, skip: 0, conflict: 0 });
type Scope = { accountId: string; actorId: string; socialGraphId: string };
type Cloud = NonNullable<PortableBackup['cloudAccount']>;
type Attachment = NonNullable<PortableBackup['attachments']>[number];
type StoredMessage = typeof messages.$inferSelect;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex');
function stale(): never {
  throw new ApiError(ApiErrorCodes.Conflict, 'Merge preview expired or changed. Preview again.');
}
function forbidden(): never {
  throw new ApiError(ApiErrorCodes.Forbidden, 'The private archive does not belong to this account actor.');
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]),
  );
  return value;
}
function tokenFor(scope: Scope, fingerprint: string, deadline: number) {
  const key = createHmac('sha256', serverEnv().SESSION_SIGNING_KEY).update('chat-buddy:private-merge:v1').digest();
  return `${deadline}.${createHmac('sha256', key).update(JSON.stringify([scope, fingerprint, deadline])).digest('hex')}`;
}
function tokenDeadline(token: string) {
  if (!/^\d{13}\.[0-9a-f]{64}$/.test(token)) stale();
  const deadline = Number(token.split('.')[0]);
  const now = Date.now();
  if (deadline < now || deadline > now + ttl) stale();
  return deadline;
}
function verify(token: string, scope: Scope, fingerprint: string) {
  const deadline = tokenDeadline(token);
  const expected = tokenFor(scope, fingerprint, deadline);
  if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected))) stale();
}

/** Keep client-selected IDs from probing/reserving global message primary keys.
 * The source identity stays stable within this private account/conversation. */
function scopedMessageId(scope: Scope, conversationId: string, sourceId: string) {
  const key = digest(['chat-buddy-portable-merge-v1', scope.accountId, scope.actorId, conversationId, sourceId]);
  return `${key.slice(0,8)}-${key.slice(8,12)}-8${key.slice(13,16)}-a${key.slice(17,20)}-${key.slice(20,32)}`;
}
function attachmentHash(asset: Attachment) {
  return digest([asset.name, asset.mimeType, asset.byteLength, asset.contentBase64]);
}
function scopedAttachmentId(scope: Scope, conversationId: string, sourceId: string) {
  return `backup:${digest(['chat-buddy-portable-attachment-v1', scope.accountId, scope.actorId, conversationId, sourceId])}`;
}
function safeAttachment(a: Attachment): boolean {
  if (!a.contentBase64) return a.byteLength === 0;
  const prefix = Buffer.from(a.contentBase64.slice(0, 12), 'base64');
  return (a.mimeType === 'image/png' && prefix.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') ||
    (a.mimeType === 'image/jpeg' && prefix.subarray(0, 3).toString('hex') === 'ffd8ff');
}

export async function mergePrivateArchive(
  db: Database, scope: Scope, validate: (raw: string) => PortableBackup, token?: string,
) {
  if (token !== undefined) tokenDeadline(token);
  const { accountId, actorId, socialGraphId } = scope;
  return db.transaction(async tx => {
    await tx.execute(sql`set local lock_timeout = '4s'`);
    await tx.execute(sql`set local statement_timeout = '8s'`);
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.status, 'active'))).for('update');
    if (!account) forbidden();
    const [backup] = await tx.select().from(accountPortableBackups).where(eq(accountPortableBackups.accountId, accountId));
    if (!backup) throw new ApiError(ApiErrorCodes.NotFound, 'No imported backup');
    const archive = validate(backup.document);
    if (archive.cloudAccount && (archive.cloudAccount.accountId !== accountId || archive.cloudAccount.actorId !== actorId)) forbidden();
    const threads = archive.cloudAccount?.conversations ?? [];
    const manifest = new Map((archive.attachments ?? []).map(a => [a.id, a]));
    const ids = threads.map(t => t.id).filter(id => uuid.test(id)).sort();
    const manifestHashes = new Map([...manifest].map(([id, a]) => [id, attachmentHash(a)]));
    const unsafeAssets = new Set([...manifest].filter(([, a]) => !safeAttachment(a)).map(([id]) => id));
    const assetBytes = new Map([...manifest].map(([id, a]) => [id, Buffer.byteLength(JSON.stringify(a))]));
    let projectionBytes = 0;
    // A given request must hold a bounded number of locks and parameters.
    if (threads.length > 100 || threads.reduce((n, t) => n + t.messages.length, 0) > 2000) {
      throw new ApiError(ApiErrorCodes.ValidationFailed, 'Merge supports at most 100 conversations and 2000 messages.');
    }
    const counts = { conversations: stats(), messages: stats(), attachments: stats() };
    const inserts: Array<typeof messages.$inferInsert> = [];
    const conflicts = { conversations: [] as string[], messages: [] as string[], attachments: [] as string[] };
    const record = (kind: keyof typeof conflicts, id: string) => {
      if (conflicts[kind].length < 50 && !conflicts[kind].includes(id)) conflicts[kind].push(id);
    };
    const fingerprints: unknown[] = [];
    const assets = new Map<string, 'insert' | 'skip' | 'conflict'>();
    const markAsset = (id: string, status: 'insert' | 'skip' | 'conflict') => {
      const prev = assets.get(id);
      if (!prev || (prev !== 'conflict' && status === 'conflict') || (prev === 'skip' && status === 'insert')) assets.set(id, status);
    };
    const owners = ids.length ? await tx.select({ id: conversations.id }).from(conversations)
      .where(and(inArray(conversations.id, ids), eq(conversations.socialGraphId, socialGraphId),
        eq(conversations.createdByActorId, actorId), eq(conversations.type, 'direct'), eq(conversations.status, 'active'))) : [];
    const ownIds = owners.map(row => row.id);
    // Same advisory identity as normal writers, acquired consistently. Then lock
    // parent rows to prevent new members; lock existing member/actor rows below.
    const lockKeys = [...new Set(ownIds.map(conversationAdvisoryKey))].sort();
    for (const key of lockKeys) await tx.execute(sql`select pg_advisory_xact_lock(${key}::bigint)`);
    const present = ownIds.length ? await tx.select().from(conversations).where(inArray(conversations.id, ownIds)).for('update') : [];
    const byId = new Map(present.map(t => [t.id, t]));
    const members = ownIds.length ? await tx.select({
      conversationId: conversationMembers.conversationId, actorId: conversationMembers.actorId,
      memberStatus: conversationMembers.status, type: actors.type, actorStatus: actors.status,
      accountId: actors.accountId, graphId: actors.socialGraphId,
    }).from(conversationMembers).innerJoin(actors, eq(conversationMembers.actorId, actors.id))
      .where(inArray(conversationMembers.conversationId, ownIds)).for('update') : [];
    const occurrence = new Map<string, number>();
    for (const t of threads) for (const m of t.messages) occurrence.set(m.id, (occurrence.get(m.id) ?? 0) + 1);
    for (const thread of threads) {
      const live = byId.get(thread.id);
      const memberships = members.filter(m => m.conversationId === thread.id);
      const eligible = uuid.test(thread.id) && thread.type === 'direct' && live
        && (live.socialGraphId === socialGraphId && live.type === 'direct' && live.status === 'active'
          && live.createdByActorId === actorId && memberships.some(m => m.actorId === actorId)
          && memberships.every(m => m.memberStatus === 'active' && m.actorStatus === 'active' && m.graphId === socialGraphId &&
            (m.actorId === actorId ? m.type === 'human' && m.accountId === accountId : m.type === 'character' && !m.accountId)));
      // Never reveal metadata, keys or contents of a collision or shared thread.
      if (!eligible) {
        counts.conversations.conflict++;
        record('conversations', thread.id);
        counts.messages.conflict += thread.messages.length;
        for (const m of thread.messages) record('messages', m.id);
        for (const m of thread.messages) for (const id of m.attachmentIds ?? []) markAsset(id, 'conflict');
        fingerprints.push([thread.id, 'blocked']);
        continue;
      }
      const liveIds = new Set(thread.messages.flatMap(m => [m.id, ...(m.replyToMessageId ? [m.replyToMessageId] : [])]).filter(id => uuid.test(id)));
      for (const id of [...liveIds]) liveIds.add(scopedMessageId(scope, thread.id, id));
      const wanted = [...new Set(thread.messages.flatMap(m => m.attachmentIds ?? []))];
      const searchIds = [...new Set(wanted.flatMap(ref => [ref, scopedAttachmentId(scope, thread.id, ref)]))];
      for (const id of wanted) {
        const imageId = id.startsWith('image:') ? id.slice(6) : '';
        if (uuid.test(imageId)) liveIds.add(imageId);
      }
      // Read just referenced rows and the sequence high-water mark. Existing attachments
      // are expanded narrowly below without modifying any stored live payload.
      const rows = live && liveIds.size ? await tx.select().from(messages)
        .where(and(eq(messages.conversationId, thread.id), inArray(messages.id, [...liveIds]))).for('update') : [];
      const [high] = live ? await tx.select({ max: sql<number>`coalesce(max(${messages.sequence}), 0)` }).from(messages)
        .where(eq(messages.conversationId, thread.id)) : [{ max: 0 }];
      let sequence = high?.max ?? 0;
      const onlineAssets = wanted.length && live ? await tx.select({
        count: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(octet_length(assets.item::text)), 0)::double precision`,
        items: sql<unknown[]>`case when count(*) <= 4000 and coalesce(sum(octet_length(assets.item::text)), 0) <= ${MAX_PORTABLE_BACKUP_BYTES}
          then jsonb_agg(assets.item) else '[]'::jsonb end`,
      }).from(sql`(
        select distinct a.item as item from ${messages}
        cross join lateral jsonb_array_elements(case when jsonb_typeof(structured_payload->'attachments') = 'array'
          then structured_payload->'attachments' else '[]'::jsonb end) a(item)
        where conversation_id = ${thread.id}::uuid and a.item->>'id' in (${sql.join(searchIds.map(id => sql`${id}`), sql`, `)})
        limit 4001
      ) assets`) : [];
      const onlineItems = onlineAssets[0]?.items ?? [];
      if ((onlineAssets[0]?.count ?? 0) > 4000 || (onlineAssets[0]?.bytes ?? 0) > MAX_PORTABLE_BACKUP_BYTES) throw new ApiError(ApiErrorCodes.ValidationFailed, 'Too many matching attachments');
      const known = new Map<string, string>();
      for (const item of onlineItems) {
        const parsed = PortableAttachmentSchema.safeParse(item);
        const id = (item as { id?: string } | null)?.id;
        if (!id) continue;
        const hash = parsed.success ? attachmentHash(parsed.data) : 'invalid';
        known.set(id, known.has(id) && known.get(id) !== hash ? 'conflicting' : hash);
      }
      // The prior live exporter also synthesizes image:<messageId> for
      // rows that store the inline image solely in their content column.
      for (const row of rows) {
        const id = `image:${row.id}`;
        if (row.kind !== 'image' || !manifest.has(id) || (row.structuredPayload as { attachments?: unknown } | null)?.attachments !== undefined) continue;
        const [, mimeType, contentBase64] = row.content.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/) ?? [];
        const hash = attachmentHash({
          id, name: 'Image', mimeType: mimeType ?? 'application/octet-stream',
          byteLength: contentBase64 ? Buffer.from(contentBase64, 'base64').length : 0,
          ...(contentBase64 ? { contentBase64 } : {}),
        });
        known.set(id, known.has(id) && known.get(id) !== hash ? 'conflicting' : hash);
      }
      const rowsById = new Map(rows.map(m => [m.id, m]));
      const target = (source: string) => rowsById.has(source) ? source : scopedMessageId(scope, thread.id, source);
      const same = (row: StoredMessage, m: Cloud['conversations'][number]['messages'][number]) =>
        !row.deletedAt && row.senderActorId === m.senderActorId && row.kind === m.kind && row.status === m.status
        && row.content === m.content && row.replyToMessageId === (m.replyToMessageId ? target(m.replyToMessageId) : null)
        && row.createdAt.getTime() === Date.parse(m.createdAt) && (row.editedAt?.getTime() ?? null) === (m.editedAt ? Date.parse(m.editedAt) : null);
      // Only existing or newly accepted same-ID reply targets in the same thread may be linked.
      const accepted = new Set(rows.filter(row => !row.deletedAt).map(row => row.id));
      const denied = new Set<string>();
      for (const m of [...thread.messages].sort((a, b) => a.sequence - b.sequence)) {
        const id = target(m.id);
        const row = rowsById.get(id);
        const refs = m.attachmentIds ?? [];
        const attachments = refs.map(id => manifest.get(id)!);
        projectionBytes += refs.reduce((n, ref) => n + assetBytes.get(ref)!, 0) + Buffer.byteLength(m.content);
        if (projectionBytes > MAX_PORTABLE_BACKUP_BYTES * 2) {
          throw new ApiError(ApiErrorCodes.ValidationFailed, 'Expanded merge would exceed 8 MiB.');
        }
        const hashes = refs.map(id => manifestHashes.get(id)!);
        const scopedRefs = refs.map(ref => scopedAttachmentId(scope, thread.id, ref));
        const targetRefs = refs.map((ref, i) => known.has(ref) ? ref : scopedRefs[i]!);
        const targetAssets = attachments.map((asset, i) => ({ ...asset, id: targetRefs[i]! }));
        const assetConflict = new Set(refs).size !== refs.length || refs.some(id => unsafeAssets.has(id)) ||
          refs.some((id, i) => (known.has(id) && known.get(id) !== hashes[i]) ||
            (known.has(scopedRefs[i]!) && known.get(scopedRefs[i]!) !== hashes[i]));
        const imageContent = m.kind !== 'image' || attachments.some(a => a.contentBase64 &&
          m.content === `data:${a.mimeType};base64,${a.contentBase64}`);
        const body = m.structuredPayload;
        const safePayload = body === null || Object.keys(body).every(k => k === 'attachments');
        const embedded = m.structuredPayload?.attachments;
        const refsAgree = embedded === undefined || digest(canonical(embedded)) === digest(canonical(attachments));
        const rowAssets = row?.structuredPayload as { attachments?: Attachment[] } | undefined;
        const livePayloadSafe = !row?.structuredPayload || Object.keys(row.structuredPayload).every(k => k === 'attachments');
        const existingRefsAgree = (!refs.length && !rowAssets?.attachments?.length) ||
          digest(canonical(rowAssets?.attachments)) === digest(canonical(targetAssets))
          || (refs.length === 1 && m.kind === 'image' && refs[0] === `image:${m.id}` && !rowAssets?.attachments?.length &&
            (attachments[0]!.contentBase64 ? row?.content === `data:${attachments[0]!.mimeType};base64,${attachments[0]!.contentBase64}` : row?.content === m.content));
        if (assetConflict || !uuid.test(m.id) || occurrence.get(m.id) !== 1 || (m.senderActorId !== actorId && !row) ||
          m.content.length > 32_000 || m.content.includes('\0') || !imageContent || !safePayload || !refsAgree || (m.replyToMessageId && (!accepted.has(target(m.replyToMessageId)) || denied.has(m.replyToMessageId))) ||
          (row ? !same(row, m) || !livePayloadSafe || !existingRefsAgree : !['text', 'image'].includes(m.kind) || m.status !== 'accepted' || sequence >= 2147483647)) {
          counts.messages.conflict++;
          record('messages', m.id);
          denied.add(m.id);
          for (const id of refs) markAsset(id, 'conflict');
          continue;
        }
        accepted.add(id);
        if (row) {
          counts.messages.skip++;
          for (const id of refs) markAsset(id, 'skip');
        } else {
          counts.messages.insert++;
          for (const [i, ref] of refs.entries()) {
            markAsset(ref, known.has(targetRefs[i]!) ? 'skip' : 'insert');
            known.set(targetRefs[i]!, hashes[i]!);
          }
          inserts.push({
            id, conversationId: thread.id, senderActorId: actorId, sequence: ++sequence,
            clientIdempotencyKey: m.id, kind: m.kind as 'text' | 'image',
            content: m.content, structuredPayload: targetAssets.length ? { attachments: targetAssets } : null,
            status: 'accepted', replyToMessageId: m.replyToMessageId ? target(m.replyToMessageId) : null, createdAt: new Date(m.createdAt),
            editedAt: m.editedAt ? new Date(m.editedAt) : null,
          });
        }
      }
      counts.conversations.skip++;
      fingerprints.push([thread.id, memberships.map(m => m.actorId).sort(), high?.max ?? 0, rows.map(r => [r.id, digest(canonical({ ...r, createdAt: +r.createdAt, editedAt: r.editedAt?.getTime(), deletedAt: r.deletedAt?.getTime() }))]).sort()]);
    }
    for (const [id] of manifest) {
      const status = assets.get(id) ?? 'skip';
      counts.attachments[status]++;
      if (status === 'conflict') record('attachments', id);
    }
    const fingerprint = digest([backup.sha256, counts, inserts, fingerprints, [...assets].sort()]);
    const receipt = { archiveSha256: backup.sha256, counts, conflicts };
    if (token === undefined) return { ...receipt, previewToken: tokenFor(scope, fingerprint, Date.now() + ttl) };
    verify(token, scope, fingerprint);
    // Deliberately no message event, notifications, ACL changes to existing chats or AI work.
    for (let i = 0; i < inserts.length; i += 100) await tx.insert(messages).values(
      inserts.slice(i, i + 100).map(row => ({ ...row, clientIdempotencyKey: `private-archive:${randomUUID()}` })),
    );
    const starts = new Map<string, number>();
    for (const row of inserts) if (!starts.has(row.conversationId)) starts.set(row.conversationId, row.sequence);
    return { ...receipt, affectedConversationIds: [...starts.keys()], affectedConversationStarts: Object.fromEntries(starts) };
  }, { isolationLevel: 'read committed' });
}
