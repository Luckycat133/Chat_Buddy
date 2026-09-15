import { z } from 'zod';
import {
  AttentionAction,
  AttentionUrgency,
  BurstClosedReason,
  MessageKind,
  MessageStatus,
} from './enums.js';

const isoDatetime = z.string().datetime();

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderActorId: z.string().uuid(),
  sequence: z.number().int().min(0),
  clientIdempotencyKey: z.string().min(8).max(128),
  kind: z.nativeEnum(MessageKind),
  content: z.string().max(32_000),
  structuredPayload: z.record(z.unknown()).nullable(),
  replyToMessageId: z.string().uuid().nullable(),
  burstId: z.string().uuid().nullable(),
  status: z.nativeEnum(MessageStatus),
  createdAt: isoDatetime,
  editedAt: isoDatetime.nullable(),
  deletedAt: isoDatetime.nullable(),
});
export type Message = z.infer<typeof MessageSchema>;

export const MessageBurstSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderActorId: z.string().uuid(),
  firstMessageSequence: z.number().int().min(0),
  lastMessageSequence: z.number().int().min(0),
  closedReason: z.nativeEnum(BurstClosedReason).nullable(),
  openedAt: isoDatetime,
  closedAt: isoDatetime.nullable(),
});
export type MessageBurst = z.infer<typeof MessageBurstSchema>;

export const AttentionDecisionSchema = z.object({
  action: z.nativeEnum(AttentionAction),
  targetActorId: z.string().uuid().nullable(),
  decisionSummary: z.string().max(400),
  urgency: z.nativeEnum(AttentionUrgency),
  replyPlan: z.string().max(4000).nullable(),
  followUpAfter: isoDatetime.nullable(),
});
export type AttentionDecision = z.infer<typeof AttentionDecisionSchema>;

/** Envelope returned by attention engine for a single (burst, actor). */
export const AttentionDecisionEnvelopeSchema = z.object({
  burstId: z.string().uuid(),
  actorId: z.string().uuid(),
  decision: AttentionDecisionSchema,
  modelMetadata: z.object({
    modelId: z.string().max(120),
    templateRevision: z.number().int().min(1),
    requestId: z.string().uuid(),
    latencyMs: z.number().int().min(0),
  }),
});
export type AttentionDecisionEnvelope = z.infer<
  typeof AttentionDecisionEnvelopeSchema
>;
