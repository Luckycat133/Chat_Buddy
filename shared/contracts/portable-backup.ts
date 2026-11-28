import { z } from 'zod';

export const MAX_PORTABLE_BACKUP_BYTES = 4 * 1024 * 1024;
const id = z.string().min(1).max(256);
const jsonRecord = z.record(z.unknown());
export const PortableAttachmentSchema = z.object({
  id, name: z.string().max(512), mimeType: z.string().max(128),
  byteLength: z.number().int().nonnegative().max(MAX_PORTABLE_BACKUP_BYTES),
  contentBase64: z.string().max(MAX_PORTABLE_BACKUP_BYTES).optional(),
}).strict();
const inlineAttachmentRef = z.array(id).max(10000);
const cloudMessage = z.object({
  id, senderActorId: id, content: z.string(), kind: z.string(), sequence: z.number().int().nonnegative(),
  createdAt: z.string().datetime(), editedAt: z.string().datetime().nullable(),
  replyToMessageId: id.nullable(), status: z.string(),
  structuredPayload: jsonRecord.nullable(),
  attachmentIds: inlineAttachmentRef.optional(),
}).strict();
const cloudConversation = z.object({
  id, type: z.string(), publicName: z.string().nullable(), createdAt: z.string().datetime(),
  lastReadSequence: z.number().int().nonnegative(),
  messages: z.array(cloudMessage).max(100000),
}).strict();
export const PortableBackupSchema = z.object({
  _meta: z.object({
    app: z.literal('Chat Buddy'), version: z.literal(2),
    exportedAt: z.string().datetime(), includesIndexedDB: z.boolean(),
  }).strict(),
  localStorage: jsonRecord,
  indexedDB: z.object({
    'chat-buddy-main': z.object({ kv: z.array(z.object({ key: id }).passthrough()).max(100000) }).strict().optional(),
    'chat-buddy-images': z.object({ images: z.array(z.object({ id, data: z.string() }).passthrough()).max(100000) }).strict().optional(),
    'chat-buddy-memories': z.object({ memories: z.array(z.object({ id }).passthrough()).max(100000) }).strict().optional(),
    'chat-buddy-agents': z.object({ 'custom-agents': z.array(z.object({ id }).passthrough()).max(100000) }).strict().optional(),
    'chat-buddy-trivia': z.object({ quiz_history: z.array(z.object({ id }).passthrough()).max(100000) }).strict().optional(),
  }).strict(),
  attachments: z.array(PortableAttachmentSchema).max(10000).optional(),
  cloudAccount: z.object({
    accountId: z.string().uuid(), actorId: z.string().uuid(),
    displayName: z.string(), locale: z.string(), timezone: z.string(),
    conversations: z.array(cloudConversation).max(100000),
  }).strict().optional(),
}).strict();

export type PortableBackup = z.infer<typeof PortableBackupSchema>;
export const PortableBackupDocumentSchema = z.object({ document: z.string().max(MAX_PORTABLE_BACKUP_BYTES) }).strict();
export const PortableBackupReceiptSchema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/), updated: z.boolean(),
}).strict();

const mergeStats = z.object({
  insert: z.number().int().nonnegative(), skip: z.number().int().nonnegative(), conflict: z.number().int().nonnegative(),
}).strict();
export const PortableMergeReceiptSchema = z.object({
  archiveSha256: z.string().regex(/^[0-9a-f]{64}$/),
  counts: z.object({ conversations: mergeStats, messages: mergeStats, attachments: mergeStats }).strict(),
  restoredConversationIds: z.array(z.string().uuid()).max(100).optional(),
  unsupportedConversationIds: z.array(id).max(50).optional(),
  conflicts: z.object({ conversations: z.array(id).max(50), messages: z.array(id).max(50), attachments: z.array(id).max(50) }).strict().optional(),
}).strict();
export const PortableMergePreviewSchema = PortableMergeReceiptSchema.extend({
  previewToken: z.string().min(1).max(512),
});
export const PortableMergeResultSchema = PortableMergeReceiptSchema.extend({
  restoredAt: z.string().datetime().optional(),
  affectedConversationIds: z.array(z.string().uuid()).max(100),
  affectedConversationStarts: z.record(z.string().uuid(), z.number().int().positive()),
});
export const PortableMergeCommitSchema = z.object({ previewToken: z.string().min(1).max(512), confirm: z.literal(true) }).strict();
