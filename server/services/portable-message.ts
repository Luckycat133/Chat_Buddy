import type { messages } from '../../db/schema.js';
import { PortableAttachmentSchema } from '../../shared/contracts/portable-backup.js';

export function portableMessagePayload(row: Pick<typeof messages.$inferSelect, 'id' | 'kind' | 'content' | 'structuredPayload'>) {
  const payload = row.structuredPayload as Record<string, unknown> | null;
  const items = payload?.attachments;
  if (items !== undefined && !Array.isArray(items)) return null;
  const assets = (items ?? []).map(item => PortableAttachmentSchema.safeParse(item));
  if (assets.some(item => !item.success)) return null;
  const attachments = assets.flatMap(item => item.success ? [item.data] : []);
  if (!attachments.length && row.kind === 'image') {
    const [, mimeType, contentBase64] = row.content.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/) ?? [];
    attachments.push({
      id: `image:${row.id}`, name: 'Image', mimeType: mimeType || 'application/octet-stream',
      byteLength: contentBase64 ? Buffer.from(contentBase64, 'base64').length : 0,
      ...(contentBase64 ? { contentBase64 } : {}),
    });
  }
  return { payload, attachments };
}
