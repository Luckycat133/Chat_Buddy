/**
 * Stable opaque identifiers used across the Chat Buddy cloud runtime.
 *
 * Per DOMAIN_ARCHITECTURE §3, identifiers are opaque and transport-stable.
 * These are branded types so accidental cross-assignment is a compile error.
 */

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type AccountId = Brand<string, 'AccountId'>;
export type SocialGraphId = Brand<string, 'SocialGraphId'>;
export type ActorId = Brand<string, 'ActorId'>;
export type HumanActorId = Brand<string, 'HumanActorId'>;
export type CharacterActorId = Brand<string, 'CharacterActorId'>;
export type PersonaTemplateId = Brand<string, 'PersonaTemplateId'>;
export type RelationshipId = Brand<string, 'RelationshipId'>;
export type FriendRequestId = Brand<string, 'FriendRequestId'>;
export type ConversationId = Brand<string, 'ConversationId'>;
export type ConversationMemberId = Brand<number, 'ConversationMemberId'>;
export type GroupInvitationId = Brand<string, 'GroupInvitationId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type MessageBurstId = Brand<string, 'MessageBurstId'>;
export type MomentId = Brand<string, 'MomentId'>;
export type MomentInteractionId = Brand<string, 'MomentInteractionId'>;
export type WorldEventId = Brand<string, 'WorldEventId'>;
export type MemoryItemId = Brand<string, 'MemoryItemId'>;
export type MemoryGrantId = Brand<number, 'MemoryGrantId'>;
export type ProactiveIntentId = Brand<string, 'ProactiveIntentId'>;
export type ToolExecutionId = Brand<string, 'ToolExecutionId'>;
export type DeviceId = Brand<string, 'DeviceId'>;
export type ActorIdentityLinkId = Brand<string, 'ActorIdentityLinkId'>;

/** New ID minting. Uses crypto.randomUUID() where available, with fallback. */
export function newId<T extends string>(): Brand<string, T> {
  const raw =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  return raw as Brand<string, T>;
}

/** Cast a raw string to a branded id (server-side trust boundary). */
export const asId = <T extends string>(raw: string) => raw as Brand<string, T>;
