import { z } from 'zod';

const isoDatetime = z.string().datetime();

/**
 * Required event types per DOMAIN_ARCHITECTURE §4.18.
 * Server emits these into an immutable log; projections rebuild from them.
 */
export const WorldEventTypes = [
  'account_created',
  'friendship_requested',
  'friendship_accepted',
  'friendship_declined',
  'friendship_deleted',
  'actor_blocked',
  'actor_introduced',
  'identity_linked',
  'group_proposed',
  'group_invited',
  'group_invitation_decided',
  'group_created',
  'group_left',
  'message_sent',
  'message_burst_closed',
  'moment_posted',
  'moment_viewed',
  'moment_reacted',
  'moment_commented',
  'native_world_event',
  'memory_disclosed',
  'relationship_changed',
  'proactive_intent_created',
  'proactive_message_sent',
  'tool_requested',
  'tool_completed',
  'policy_regenerated',
] as const;
export type WorldEventType = (typeof WorldEventTypes)[number];

export const WorldEventSchema = z.object({
  id: z.string().uuid(),
  socialGraphId: z.string().uuid(),
  type: z.enum(WorldEventTypes),
  actorId: z.string().uuid(),
  subjectActorIds: z.array(z.string().uuid()).max(64),
  conversationId: z.string().uuid().nullable(),
  momentId: z.string().uuid().nullable(),
  payload: z.record(z.unknown()),
  visibilityPolicy: z.record(z.unknown()),
  occurredAt: isoDatetime,
  causedByEventId: z.string().uuid().nullable(),
  idempotencyKey: z.string().min(8).max(128),
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;

/**
 * Realtime event names per DOMAIN_ARCHITECTURE §12.
 * Used for WebSocket frames and iOS push notification routing.
 */
export const RealtimeEventTypes = [
  'message.created',
  'message.updated',
  'conversation.updated',
  'typing.updated',
  'friend_request.updated',
  'group_invitation.updated',
  'relationship.updated',
  'moment.created',
  'moment.interaction.created',
  'actor.presence.updated',
  'sync.invalidate',
] as const;
export type RealtimeEventType = (typeof RealtimeEventTypes)[number];
