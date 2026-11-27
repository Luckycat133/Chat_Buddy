import { createHash } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Database } from '../../db/index.js';
import { accounts, accountPortableBackups, conversations, conversationMembers, messages } from '../../db/schema.js';
import {
  MAX_PORTABLE_BACKUP_BYTES, PortableAttachmentSchema, PortableBackupDocumentSchema, PortableBackupSchema,
  type PortableBackup,
} from '../../shared/contracts/portable-backup.js';
import { PortableMergeCommitSchema } from '../../shared/contracts/portable-backup.js';
import { mergePrivateArchive } from '../services/portable-merge.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';

function invalid(): never {
  throw new ApiError(ApiErrorCodes.ValidationFailed, 'Unsupported or invalid Web v2 backup');
}

function guardSize(document: string) {
  if (Buffer.byteLength(document) > MAX_PORTABLE_BACKUP_BYTES) invalid();
}

const MAX_STRUCTURE_TOKENS = 100000;
const MAX_DEPTH = 64;

type WorkBudget = { remaining: number };

// Count only structural tokens before allocating decoded values. Strings
// (including escaped quotes) are a linear scan over the original text.
function parseWithBudget(text: string, budget: WorkBudget, maxDepth = MAX_DEPTH): unknown {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === 92) escaped = true; // backslash
      else if (char === 34) quoted = false; // quote
      continue;
    }
    if (char === 34) quoted = true;
    else if (char === 123 || char === 91) { // { [
      if (++depth > maxDepth) invalid();
    } else if (char === 125 || char === 93) { // } ]
      if (--depth < 0) invalid();
    }
    if ((char === 123 || char === 91 || char === 44 || char === 58) && --budget.remaining < 0) invalid();
  }
  if (depth !== 0 || quoted) invalid();
  try { return JSON.parse(text) as unknown; } catch { invalid(); }
}

function validate(document: string) {
  guardSize(document);
  const budget = { remaining: MAX_STRUCTURE_TOKENS };
  const value = parseWithBudget(document, budget);
  const parsed = PortableBackupSchema.safeParse(value);
  if (!parsed.success) invalid();
  validateSafeMetadata(value);
  const data = parsed.data;
  for (const [key, entry] of Object.entries(data.localStorage)) {
    if (!/^chat-buddy[-:]/.test(key)) invalid();
    validateStructuredString(entry, budget);
  }
  for (const row of data.indexedDB['chat-buddy-main']?.kv ?? []) {
    validateStructuredString(row.value, budget);
  }
  for (const keys of [
    data.indexedDB['chat-buddy-main']?.kv.map(record => record.key),
    data.indexedDB['chat-buddy-images']?.images.map(record => record.id),
    data.indexedDB['chat-buddy-memories']?.memories.map(record => record.id),
    data.indexedDB['chat-buddy-agents']?.['custom-agents'].map(record => record.id),
    data.indexedDB['chat-buddy-trivia']?.quiz_history.map(record => record.id),
  ]) {
    if (keys && new Set(keys).size !== keys.length) invalid();
  }
  const attachments = new Set<string>();
  for (const item of data.attachments ?? []) {
    if (attachments.has(item.id)) invalid();
    attachments.add(item.id);
    if (item.contentBase64 !== undefined) {
      const bytes = Buffer.from(item.contentBase64, 'base64');
      if (bytes.length !== item.byteLength || bytes.toString('base64') !== item.contentBase64) invalid();
    }
  }
  const seenConversations = new Set<string>();
  for (const conversation of data.cloudAccount?.conversations ?? []) {
    if (seenConversations.has(conversation.id)) invalid();
    seenConversations.add(conversation.id);
    const messageIds = new Set<string>();
    const sequence = new Set<number>();
    for (const message of conversation.messages) {
      if (messageIds.has(message.id) || sequence.has(message.sequence)
        || message.attachmentIds?.some(ref => !attachments.has(ref))) invalid();
      messageIds.add(message.id);
      sequence.add(message.sequence);
    }
  }
  return data;
}

function validateStructuredString(value: unknown, budget: WorkBudget) {
  if (typeof value !== 'string') return;
  const text = value.trimStart();
  if (!text.startsWith('{') && !text.startsWith('[')) return;
  // Structured legacy state must be valid JSON, not an obfuscated container.
  validateSafeMetadata(parseWithBudget(text, budget));
}

// Depth is already bounded by the lexical preflight. DFS holds one branch,
// rather than allocating an auxiliary queue for every archive node.
function validateSafeMetadata(value: unknown) {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) validateSafeMetadata(item);
    return;
  }
  for (const key of Object.keys(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
    if (/(?:accesstoken|refreshtoken|sessionapikey|apikey|apisecret|authorization|appletokens?|applesubject|password|privatekey)$/.test(normalized)) invalid();
    validateSafeMetadata((value as Record<string, unknown>)[key]);
  }
}

function privateDownload(reply: FastifyReply, document: string) {
  return reply.header('cache-control', 'private, no-store')
    .header('content-disposition', 'attachment; filename="chat-buddy-web-v2.json"')
    .header('x-content-type-options', 'nosniff')
    .type('application/json').send(document);
}

export function registerPortableBackupRoutes(app: FastifyInstance): void {
  const writing = new Set<string>();
  const admitted = new WeakMap<FastifyRequest, { accountId: string; timer: ReturnType<typeof setTimeout>; processing: boolean }>();
  const largeUploads = new Map<string, { bytes: number; until: number }>();

  function finish(request: FastifyRequest) {
    const slot = admitted.get(request);
    if (slot) {
      clearTimeout(slot.timer);
      writing.delete(slot.accountId);
    }
    admitted.delete(request);
  }

  function abortReceipt(request: FastifyRequest) {
    if (!admitted.get(request)?.processing) finish(request);
  }

  // Register this route family in a Fastify child scope. Parse its PUT body
  // as bounded text so malicious envelope nesting never reaches JSON.parse.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, callback) => callback(null, body));

  for (const mode of ['preview', 'commit'] as const) {
    app.post(`/v1/account/backup/merge/${mode}`, { onRequest: requireAuth, bodyLimit: 1024 }, async (request, reply) => {
      const { accountId, actorId, socialGraphId } = request.requestContext;
      if (!accountId || !actorId || !socialGraphId) throw new ApiError(ApiErrorCodes.Unauthorized, 'No account actor');
      const parsed = typeof request.body === 'string' ? parseWithBudget(request.body, { remaining: 12 }, 2) : null;
      let token: string | undefined;
      if (mode === 'commit') {
        const result = PortableMergeCommitSchema.safeParse(parsed);
        if (!result.success) invalid();
        token = result.data.previewToken;
      } else if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length !== 0) invalid();
      reply.header('cache-control', 'private, no-store');
      return mergePrivateArchive(request.server.db as Database, { accountId, actorId, socialGraphId }, validate, token);
    });
  }

  app.get('/v1/account/backup', { preHandler: requireAuth }, async (request, reply) => {
    const accountId = request.requestContext.accountId;
    if (!accountId) throw new ApiError(ApiErrorCodes.Unauthorized, 'No account bound to session');
    const db = request.server.db as Database;
    const [backup] = await db.select().from(accountPortableBackups)
      .where(eq(accountPortableBackups.accountId, accountId));
    if (!backup) throw new ApiError(ApiErrorCodes.NotFound, 'No imported backup');
    return privateDownload(reply, backup.document);
  });

  app.put('/v1/account/backup', {
    onRequest: [requireAuth, async (request, reply) => {
      const accountId = request.requestContext.accountId;
      if (!accountId) throw new ApiError(ApiErrorCodes.Unauthorized, 'No account bound to session');
      if (writing.has(accountId) || writing.size >= 4) {
        throw new ApiError(ApiErrorCodes.RateLimited, 'An archive upload is already in progress');
      }
      writing.add(accountId);
      const timer = setTimeout(() => {
        finish(request);
        reply.hijack();
        reply.raw.destroy();
      }, 30_000);
      timer.unref();
      admitted.set(request, { accountId, timer, processing: false });
      reply.raw.once('close', () => abortReceipt(request));
    }],
    onResponse: async request => abortReceipt(request),
    onRequestAbort: async request => abortReceipt(request),
    bodyLimit: MAX_PORTABLE_BACKUP_BYTES * 2 + 32,
  }, async (request, reply) => {
    const { accountId, actorId } = request.requestContext;
    if (!accountId) throw new ApiError(ApiErrorCodes.Unauthorized, 'No account bound to session');
    const slot = admitted.get(request);
    if (!slot || typeof request.body !== 'string') invalid();
    // The upload deadline covers only receiving the body. Once accepted,
    // hold the permit through commit/rollback even if the client goes away.
    slot.processing = true;
    clearTimeout(slot.timer);
    const deadline = Date.now() + 10_000;
    const checkWork = () => {
      if (reply.raw.destroyed || Date.now() > deadline) {
        throw new ApiError(ApiErrorCodes.RateLimited, 'Archive replacement did not complete');
      }
    };
    try {
      // Bound the work on large submissions, including invalid ones. Small
      // interactive files are already protected by lexical/node work caps.
      const bytes = Buffer.byteLength(request.body);
      if (bytes > 128 * 1024) {
        const now = Date.now();
        for (const [key, state] of largeUploads) if (state.until <= now) largeUploads.delete(key);
        const state = largeUploads.get(accountId) ?? { bytes: 0, until: now + 10000 };
        if (state.bytes + bytes > MAX_PORTABLE_BACKUP_BYTES * 6 ||
          (!largeUploads.has(accountId) && largeUploads.size >= 1024)) {
          throw new ApiError(ApiErrorCodes.RateLimited, 'Large backup upload budget exhausted');
        }
        state.bytes += bytes;
        largeUploads.set(accountId, state);
      }
      const { document } = PortableBackupDocumentSchema.parse(parseWithBudget(request.body, { remaining: 12 }, 2));
      const data = validate(document);
      if (data.cloudAccount && (data.cloudAccount.accountId !== accountId || data.cloudAccount.actorId !== actorId)) {
        throw new ApiError(ApiErrorCodes.Forbidden, 'Backup is bound to a different account');
      }
      const sha256 = createHash('sha256').update(document).digest('hex');
      const db = request.server.db as Database;
      checkWork();
      return await db.transaction(async tx => {
        await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
        await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
        checkWork();
        const [owner] = await tx.select({ status: accounts.status }).from(accounts)
          .where(eq(accounts.id, accountId)).for('update');
        if (owner?.status !== 'active') throw new ApiError(ApiErrorCodes.Unauthorized, 'Account unavailable');
        // Imported cloud histories remain read-only and cannot claim authors or
        // conversations outside the bound user's actual graph and membership.
        if (actorId && data.cloudAccount) {
          const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const archive = data.cloudAccount.conversations;
          for (let i = 0; i < archive.length; i += 256) {
            checkWork();
            const batch = archive.slice(i, i + 256);
            const ids = batch.map(thread => thread.id);
            if (ids.some(id => !uuid.test(id))) invalid();
            const owned = await tx.select({ id: conversations.id }).from(conversationMembers)
              .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
              .where(and(inArray(conversations.id, ids), eq(conversationMembers.actorId, actorId),
                eq(conversationMembers.status, 'active'),
                eq(conversations.status, 'active'), ne(conversations.type, 'hidden_ai_direct')));
            if (owned.length !== batch.length) throw new ApiError(ApiErrorCodes.Forbidden, 'Backup contains an unavailable conversation');
            const memberRows = await tx.select({ conversationId: conversationMembers.conversationId,
              actorId: conversationMembers.actorId }).from(conversationMembers)
              .where(inArray(conversationMembers.conversationId, ids));
            const membership = new Set(memberRows.map(row => `${row.conversationId}:${row.actorId}`));
            if (batch.some(thread => thread.messages.some(message => !membership.has(`${thread.id}:${message.senderActorId}`)))) {
              throw new ApiError(ApiErrorCodes.Forbidden, 'Backup contains an untrusted message author');
            }
          }
        }
        const [existing] = await tx.select({ sha256: accountPortableBackups.sha256 })
          .from(accountPortableBackups).where(eq(accountPortableBackups.accountId, accountId));
        checkWork();
        if (existing?.sha256 === sha256) return { sha256, updated: false };
        await tx.insert(accountPortableBackups).values({ accountId, sha256, document })
          .onConflictDoUpdate({ target: accountPortableBackups.accountId,
            set: { sha256, document, updatedAt: new Date() } });
        checkWork();
        return { sha256, updated: true };
      });
    } finally {
      finish(request);
    }
  });

  app.get('/v1/account/backup/live', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId, actorId, socialGraphId } = request.requestContext;
    if (!accountId || !actorId || !socialGraphId) throw new ApiError(ApiErrorCodes.Unauthorized, 'No account actor');
    const db = request.server.db as Database;
    const document = await db.transaction(async tx => {
      const [account] = await tx.select({ displayName: accounts.displayName, locale: accounts.locale, timezone: accounts.timezone })
        .from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.status, 'active'))).for('share');
      if (!account) throw new ApiError(ApiErrorCodes.Unauthorized, 'Account unavailable');
      const list: NonNullable<PortableBackup['cloudAccount']>['conversations'] = [];
      const result: PortableBackup = {
        _meta: { app: 'Chat Buddy', version: 2, exportedAt: new Date().toISOString(), includesIndexedDB: true },
        localStorage: {}, indexedDB: {},
        cloudAccount: { accountId, actorId, ...account, conversations: list },
      };
      const visible = and(eq(conversationMembers.actorId, actorId), eq(conversationMembers.status, 'active'),
        eq(conversations.status, 'active'),
        ne(conversations.type, 'hidden_ai_direct'));
      let threadCursor: string | undefined;
      let totalBytes = Buffer.byteLength(JSON.stringify(result));
      const countBytes = (row: unknown) => {
        totalBytes += Buffer.byteLength(JSON.stringify(row)) + 1;
        if (totalBytes > MAX_PORTABLE_BACKUP_BYTES + 128) invalid();
      };
      for (;;) {
        const threads = await tx.select({
          id: conversations.id, type: conversations.type, publicName: conversations.publicName,
          createdAt: conversations.createdAt, lastReadSequence: conversationMembers.lastReadSequence,
        }).from(conversationMembers).innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
          .where(and(visible, threadCursor ? gt(conversations.id, threadCursor) : undefined))
          .orderBy(asc(conversations.id)).limit(256);
        for (const thread of threads) {
          const row = { ...thread, createdAt: thread.createdAt.toISOString(), messages: [] };
          countBytes(row);
          list.push(row);
        }
        if (threads.length < 256) break;
        threadCursor = threads.at(-1)!.id;
      }
      const exportById = new Map(list.map(row => [row.id, row]));
      const attachments = new Map<string, NonNullable<PortableBackup['attachments']>[number]>();
      let messageCursor: { conversationId: string; sequence: number } | undefined;
      for (;;) {
        const rows = await tx.select({
          id: messages.id, conversationId: messages.conversationId, senderActorId: messages.senderActorId,
          sequence: messages.sequence, content: messages.content, kind: messages.kind, status: messages.status,
          structuredPayload: messages.structuredPayload, replyToMessageId: messages.replyToMessageId,
          createdAt: messages.createdAt, editedAt: messages.editedAt,
        }).from(messages).innerJoin(conversations, eq(conversations.id, messages.conversationId))
          .innerJoin(conversationMembers, eq(conversationMembers.conversationId, conversations.id))
          .where(and(visible, isNull(messages.deletedAt),
            or(ne(conversations.type, 'group'), lte(conversationMembers.joinedAt, messages.createdAt)),
            messageCursor ? or(
            gt(messages.conversationId, messageCursor.conversationId),
            and(eq(messages.conversationId, messageCursor.conversationId), gt(messages.sequence, messageCursor.sequence)),
          ) : undefined)).orderBy(asc(messages.conversationId), asc(messages.sequence)).limit(256);
        for (const { conversationId, ...row } of rows) {
          const payload = row.structuredPayload as Record<string, unknown> | null;
          const message = { ...row, createdAt: row.createdAt.toISOString(), editedAt: row.editedAt?.toISOString() ?? null,
            structuredPayload: payload };
          const references: string[] = [];
          const items = payload?.attachments;
          if (items !== undefined) {
            if (!Array.isArray(items)) invalid();
            for (const item of items) {
              const parsed = PortableAttachmentSchema.safeParse(item);
              if (!parsed.success) invalid();
              const known = attachments.get(parsed.data.id);
              if (known && JSON.stringify(known) !== JSON.stringify(parsed.data)) invalid();
              if (!known) { countBytes(parsed.data); attachments.set(parsed.data.id, parsed.data); }
              references.push(parsed.data.id);
            }
          }
          if (references.length === 0 && row.kind === 'image') {
            const id = `image:${row.id}`;
            const [match, mimeType, contentBase64] = row.content.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/) ?? [];
            const asset = { id, name: 'Image', mimeType: mimeType || 'application/octet-stream',
              byteLength: match && contentBase64 ? Buffer.from(contentBase64, 'base64').length : 0,
              ...(contentBase64 ? { contentBase64 } : {}) };
            countBytes(asset);
            attachments.set(id, asset);
            references.push(id);
          }
          const portable = references.length ? { ...message, attachmentIds: references } : message;
          countBytes(portable);
          exportById.get(conversationId)?.messages.push(portable);
        }
        if (rows.length < 256) break;
        messageCursor = rows.at(-1)!;
      }
      if (attachments.size) result.attachments = [...attachments.values()];
      const serialized = JSON.stringify(result);
      validate(serialized);
      return serialized;
    }, { isolationLevel: 'repeatable read' });
    return privateDownload(reply, document);
  });
}
