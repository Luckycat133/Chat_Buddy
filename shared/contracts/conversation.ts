import { z } from 'zod';
import {
  ConversationMemberStatus,
  ConversationType,
} from './enums.js';

const isoDatetime = z.string().datetime();

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  socialGraphId: z.string().uuid(),
  type: z.nativeEnum(ConversationType),
  publicName: z.string().max(120).nullable(),
  avatarAssetId: z.string().uuid().nullable(),
  createdByActorId: z.string().uuid(),
  status: z.enum(['active', 'archived']),
  createdAt: isoDatetime,
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ConversationMemberSchema = z.object({
  conversationId: z.string().uuid(),
  actorId: z.string().uuid(),
  status: z.nativeEnum(ConversationMemberStatus),
  role: z.enum(['member', 'moderator']),
  invitedByActorId: z.string().uuid().nullable(),
  joinedAt: isoDatetime.nullable(),
  leftAt: isoDatetime.nullable(),
  lastReadSequence: z.number().int().min(0).default(0),
});
export type ConversationMember = z.infer<typeof ConversationMemberSchema>;
