import { createHash } from 'node:crypto';
import type { messages } from '../../db/schema.js';
import type { PortableBackup } from '../../shared/contracts/portable-backup.js';
import { portableMessagePayload } from './portable-message.js';

type Attachment = NonNullable<PortableBackup['attachments']>[number];
type ArchivedMessage = NonNullable<PortableBackup['cloudAccount']>['conversations'][number]['messages'][number];
type StoredMessage = typeof messages.$inferSelect;

export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex');

export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]),
  );
  return value;
}
export function attachmentHash(asset: Attachment) {
  return digest([asset.name, asset.mimeType, asset.byteLength, asset.contentBase64]);
}

/** Read-only proof over rows already locked by the caller. Never restore identities,
 * infer missing authors, query other conversations, or write archive content. */
export function proveRetainedArchive(
  original: readonly StoredMessage[], archivedMessages: readonly ArchivedMessage[],
  actorId: string, memberIds: ReadonlySet<string>, occurrence: ReadonlyMap<string, number>,
  manifest: ReadonlyMap<string, Attachment>, manifestHashes: ReadonlyMap<string, string>,
): Set<string> | null {
  const archived = new Map(archivedMessages.map(m => [m.id, m]));
  const sequenceById = new Map(original.map(row => [row.id, row.sequence]));
  const restoredAssetIds = new Set<string>();
  if (original.length !== archived.size) return null;
  for (const row of original) {
    const m = archived.get(row.id);
    const projected = portableMessagePayload(row);
    if (!m || !projected || !memberIds.has(row.senderActorId) || m.senderActorId !== row.senderActorId ||
        row.sequence < 1 || row.sequence !== m.sequence || row.createdAt.toISOString() !== m.createdAt ||
        (row.editedAt?.toISOString() ?? null) !== m.editedAt || row.replyToMessageId !== m.replyToMessageId ||
        (row.replyToMessageId !== null && (sequenceById.get(row.replyToMessageId) ?? Number.POSITIVE_INFINITY) >= row.sequence) ||
        m.content !== row.content || m.kind !== row.kind || m.status !== row.status || row.content.length > 32_000 ||
        (row.kind === 'system' && row.senderActorId === actorId) ||
        occurrence.get(m.id) !== 1 || digest(canonical(projected.payload)) !== digest(canonical(m.structuredPayload)) ||
        digest(projected.attachments.map(item => item.id)) !== digest(m.attachmentIds ?? []) ||
        projected.attachments.some(item => !manifest.has(item.id) || attachmentHash(item) !== manifestHashes.get(item.id))) {
      return null;
    }
    for (const item of projected.attachments) restoredAssetIds.add(item.id);
  }
  return restoredAssetIds;
}
