import { z } from 'zod';
import { InvitationStatus, RelationshipState } from './enums.js';

const isoDatetime = z.string().datetime();

export const RelationshipSchema = z.object({
  id: z.string().uuid(),
  socialGraphId: z.string().uuid(),
  actorAId: z.string().uuid(),
  actorBId: z.string().uuid(),
  state: z.nativeEnum(RelationshipState),
  initiatedBy: z.string().uuid(),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});
export type Relationship = z.infer<typeof RelationshipSchema>;

export const RelationshipPreferenceSchema = z.object({
  relationshipId: z.string().uuid(),
  ownerActorId: z.string().uuid(),
  allowDirectMessage: z.boolean(),
  allowProactiveMessage: z.boolean(),
  mutedUntil: isoDatetime.nullable(),
  privateRemark: z.string().max(80).nullable(),
  notificationLevel: z.enum(['all', 'mentions', 'none']),
  shareDefaults: z.record(z.unknown()),
});
export type RelationshipPreference = z.infer<
  typeof RelationshipPreferenceSchema
>;

export const RelationshipNarrativeSchema = z.object({
  relationshipId: z.string().uuid(),
  version: z.number().int().min(1),
  currentDynamic: z.string().max(4000),
  meaningfulHistory: z.array(z.string().max(800)).max(128),
  trustAndUncertainty: z.string().max(2000),
  tensions: z.array(z.string().max(400)).max(64),
  boundaries: z.array(z.string().max(400)).max(64),
  openThreads: z.array(z.string().max(400)).max(64),
  relationshipDirection: z.string().max(2000),
  changedByEventIds: z.array(z.string().uuid()).max(64),
  generatedAt: isoDatetime,
  modelMetadata: z.record(z.unknown()),
});
export type RelationshipNarrative = z.infer<
  typeof RelationshipNarrativeSchema
>;

export const FriendRequestSchema = z.object({
  id: z.string().uuid(),
  senderActorId: z.string().uuid(),
  recipientActorId: z.string().uuid(),
  introductionEventId: z.string().uuid().nullable(),
  note: z.string().max(800).nullable(),
  status: z.enum([
    'pending',
    'accepted',
    'declined',
    'ignored',
    'cancelled',
    'expired',
  ]),
  expiresAt: isoDatetime.nullable(),
  decidedAt: isoDatetime.nullable(),
});
export type FriendRequest = z.infer<typeof FriendRequestSchema>;

export const GroupInvitationSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  inviterActorId: z.string().uuid(),
  inviteeActorId: z.string().uuid(),
  visibleMemberSnapshot: z.array(z.string().uuid()).max(64),
  purpose: z.string().max(800),
  status: z.nativeEnum(InvitationStatus),
  decisionReasonCode: z.string().max(64).nullable(),
  createdAt: isoDatetime,
  decidedAt: isoDatetime.nullable(),
});
export type GroupInvitation = z.infer<typeof GroupInvitationSchema>;
