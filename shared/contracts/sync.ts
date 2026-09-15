import { z } from 'zod';

const isoDatetime = z.string().datetime();

/**
 * Delta sync envelope per DOMAIN_ARCHITECTURE §13.
 * Server returns ordered upserts/tombstones; client advances cursor only after commit.
 */
export const SyncUpsertSchema = z.object({
  table: z.string().min(1).max(64),
  id: z.string(),
  payload: z.record(z.unknown()),
});

export const SyncTombstoneSchema = z.object({
  table: z.string().min(1).max(64),
  id: z.string(),
  deletedAt: isoDatetime,
});

export const SyncEnvelopeSchema = z.object({
  cursor: z.string().min(1),
  upserts: z.array(SyncUpsertSchema).max(500),
  tombstones: z.array(SyncTombstoneSchema).max(500),
  serverTime: isoDatetime,
});
export type SyncEnvelope = z.infer<typeof SyncEnvelopeSchema>;
