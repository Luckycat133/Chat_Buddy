/**
 * Shared enumerations. DOMAIN_ARCHITECTURE §3-§4 normalize these to a single
 * source so Web, iOS, and server stay aligned.
 */

export const ActorType = {
  Human: 'human',
  Character: 'character',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const ActorStatus = {
  Active: 'active',
  Unavailable: 'unavailable',
  Blocked: 'blocked',
  Retired: 'retired',
} as const;
export type ActorStatus = (typeof ActorStatus)[keyof typeof ActorStatus];

export const PersonaRightsStatus = {
  Original: 'original',
  Licensed: 'licensed',
  UserImported: 'user_imported',
  InternalTestOnly: 'internal_test_only',
} as const;
export type PersonaRightsStatus =
  (typeof PersonaRightsStatus)[keyof typeof PersonaRightsStatus];

export const ConversationType = {
  Direct: 'direct',
  Group: 'group',
  HiddenAiDirect: 'hidden_ai_direct',
} as const;
export type ConversationType =
  (typeof ConversationType)[keyof typeof ConversationType];

export const ConversationMemberStatus = {
  Invited: 'invited',
  Active: 'active',
  Declined: 'declined',
  Left: 'left',
  Removed: 'removed',
  Blocked: 'blocked',
} as const;
export type ConversationMemberStatus =
  (typeof ConversationMemberStatus)[keyof typeof ConversationMemberStatus];

export const InvitationStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Declined: 'declined',
  Cancelled: 'cancelled',
  Expired: 'expired',
} as const;
export type InvitationStatus =
  (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const RelationshipState = {
  Requested: 'requested',
  Accepted: 'accepted',
  Declined: 'declined',
  Deleted: 'deleted',
  Blocked: 'blocked',
} as const;
export type RelationshipState =
  (typeof RelationshipState)[keyof typeof RelationshipState];

export const MemoryType = {
  Private: 'private',
  Shared: 'shared',
  Public: 'public',
  Reported: 'reported',
  NativeWorld: 'native_world',
} as const;
export type MemoryType = (typeof MemoryType)[keyof typeof MemoryType];

export const MemoryConfidence = {
  Observed: 'observed',
  Reported: 'reported',
  Inferred: 'inferred',
  Uncertain: 'uncertain',
  DeceptiveClaim: 'deceptive_claim',
} as const;
export type MemoryConfidence =
  (typeof MemoryConfidence)[keyof typeof MemoryConfidence];

export const MemoryGrantPermission = {
  Know: 'know',
  Summarize: 'summarize',
  Quote: 'quote',
  Disclose: 'disclose',
} as const;
export type MemoryGrantPermission =
  (typeof MemoryGrantPermission)[keyof typeof MemoryGrantPermission];

export const ProactiveStatus = {
  Pending: 'pending',
  Claimed: 'claimed',
  Sent: 'sent',
  Cancelled: 'cancelled',
  Expired: 'expired',
  Failed: 'failed',
} as const;
export type ProactiveStatus =
  (typeof ProactiveStatus)[keyof typeof ProactiveStatus];

export const ToolExecutionStatus = {
  Requested: 'requested',
  AwaitingConfirmation: 'awaiting_confirmation',
  Confirmed: 'confirmed',
  Succeeded: 'succeeded',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;
export type ToolExecutionStatus =
  (typeof ToolExecutionStatus)[keyof typeof ToolExecutionStatus];

export const AccountStatus = {
  Active: 'active',
  Suspended: 'suspended',
  Deleting: 'deleting',
  Deleted: 'deleted',
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const MessageKind = {
  Text: 'text',
  Image: 'image',
  System: 'system',
  Invitation: 'invitation',
  ActionResult: 'action_result',
} as const;
export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind];

export const MessageStatus = {
  Queued: 'queued',
  Sending: 'sending',
  Accepted: 'accepted',
  Failed: 'failed',
  Conflicted: 'conflicted',
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const BurstClosedReason = {
  Inactivity: 'inactivity',
  ExplicitMention: 'explicit_mention',
  SenderLeft: 'sender_left',
  MaxWaitGuard: 'max_wait_guard',
  Manual: 'manual',
} as const;
export type BurstClosedReason =
  (typeof BurstClosedReason)[keyof typeof BurstClosedReason];

export const AttentionAction = {
  Wait: 'wait',
  Ignore: 'ignore',
  ReplyPublicly: 'reply_publicly',
  ReplyPrivately: 'reply_privately',
  React: 'react',
  StartFriendRequest: 'start_friend_request',
  ProposeGroup: 'propose_group',
  LeaveGroup: 'leave_group',
  NoAction: 'no_action',
} as const;
export type AttentionAction =
  (typeof AttentionAction)[keyof typeof AttentionAction];

export const AttentionUrgency = {
  Low: 'low',
  Normal: 'normal',
  High: 'high',
} as const;
export type AttentionUrgency =
  (typeof AttentionUrgency)[keyof typeof AttentionUrgency];
