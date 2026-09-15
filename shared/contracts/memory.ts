import { z } from 'zod';
import {
  MemoryConfidence,
  MemoryGrantPermission,
  MemoryType,
} from './enums.js';

const isoDatetime = z.string().datetime();

export const MemoryItemSchema = z.object({
  id: z.string().uuid(),
  ownerActorId: z.string().uuid(),
  relationshipId: z.string().uuid().nullable(),
  sourceEventId: z.string().uuid(),
  sourceActorId: z.string().uuid().nullable(),
  type: z.nativeEnum(MemoryType),
  objectiveFact: z.string().min(1).max(4000),
  subjectiveInterpretation: z.string().max(4000),
  confidence: z.nativeEnum(MemoryConfidence),
  visibilityPolicy: z.record(z.unknown()),
  sharePolicy: z.record(z.unknown()),
  relevanceTags: z.array(z.string().min(1).max(64)).max(32),
  createdAt: isoDatetime,
  lastRecalledAt: isoDatetime.nullable(),
  supersededById: z.string().uuid().nullable(),
  deletedAt: isoDatetime.nullable(),
});
export type MemoryItem = z.infer<typeof MemoryItemSchema>;

export const MemoryGrantSchema = z.object({
  memoryId: z.string().uuid(),
  granteeActorId: z.string().uuid(),
  grantedByEventId: z.string().uuid(),
  permission: z.nativeEnum(MemoryGrantPermission),
  expiresAt: isoDatetime.nullable(),
});
export type MemoryGrant = z.infer<typeof MemoryGrantSchema>;
