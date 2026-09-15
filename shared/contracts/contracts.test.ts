import { describe, expect, it } from 'vitest';
import {
  AccountSchema,
  ActorSchema,
  ActorIdentityLinkSchema,
  CharacterActorSchema,
  ConversationSchema,
  ConversationMemberSchema,
  FriendRequestSchema,
  GroupInvitationSchema,
  MemoryItemSchema,
  MemoryGrantSchema,
  MessageBurstSchema,
  MessageSchema,
  MomentSchema,
  MomentInteractionSchema,
  PersonaTemplateSchema,
  ProactiveIntentSchema,
  RelationshipNarrativeSchema,
  RelationshipPreferenceSchema,
  RelationshipSchema,
  SocialGraphSchema,
  SyncEnvelopeSchema,
  ToolExecutionSchema,
  WorldEventSchema,
  DeviceSchema,
} from './index.js';
import {
  AccountStatus,
  ActorStatus,
  ActorType,
  AttentionAction,
  AttentionUrgency,
  BurstClosedReason,
  ConversationMemberStatus,
  ConversationType,
  InvitationStatus,
  MemoryConfidence,
  MemoryGrantPermission,
  MemoryType,
  MessageKind,
  MessageStatus,
  PersonaRightsStatus,
  ProactiveStatus,
  RelationshipState,
  ToolExecutionStatus,
  WorldEventTypes,
  RealtimeEventTypes,
} from './index.js';

const NOW = new Date('2026-09-14T10:00:00.000Z').toISOString();
const UUID = '00000000-0000-0000-0000-000000000001';

describe('shared contracts', () => {
  it('Account round-trips a valid sample', () => {
    const parsed = AccountSchema.parse({
      id: UUID,
      status: AccountStatus.Active,
      primaryEmail: 'a@b.test',
      appleSubject: null,
      displayName: 'Test',
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
      createdAt: NOW,
      deletedAt: null,
    });
    expect(parsed.displayName).toBe('Test');
  });

  it('Actor accepts both human and character types', () => {
    for (const type of [ActorType.Human, ActorType.Character]) {
      const parsed = ActorSchema.parse({
        id: UUID,
        socialGraphId: UUID,
        type,
        publicName: 'Mira',
        avatarAssetId: null,
        templateId: type === 'character' ? UUID : null,
        status: ActorStatus.Active,
        createdAt: NOW,
        updatedAt: NOW,
      });
      expect(parsed.type).toBe(type);
    }
  });

  it('PersonaTemplate rejects an illegal slug', () => {
    const bad = PersonaTemplateSchema.safeParse({
      id: UUID,
      slug: 'Has Spaces And Caps',
      schemaVersion: '1.0.0',
      publicName: 'X',
      localizedNames: { en: 'X' },
      nativeWorld: '',
      canonAnchor: '...',
      identityPrompt: '...',
      values: [],
      flaws: [],
      speakingStyle: '...',
      routines: [],
      interests: [],
      canonicalRelationships: [],
      capabilities: [],
      antiDriftRules: [],
      examples: [],
      rightsStatus: PersonaRightsStatus.Original,
      contentPolicyProfile: 'default',
      immutableRevision: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(bad.success).toBe(false);
  });

  it('Conversation hides hidden_ai_direct from human listings via type', () => {
    const parsed = ConversationSchema.parse({
      id: UUID,
      socialGraphId: UUID,
      type: ConversationType.HiddenAiDirect,
      publicName: null,
      avatarAssetId: null,
      createdByActorId: UUID,
      status: 'active',
      createdAt: NOW,
    });
    expect(parsed.type).toBe('hidden_ai_direct');
  });

  it('Message idempotency key is required and bounded', () => {
    const ok = MessageSchema.safeParse({
      id: UUID,
      conversationId: UUID,
      senderActorId: UUID,
      sequence: 1,
      clientIdempotencyKey: 'abcdef-1234567890',
      kind: MessageKind.Text,
      content: 'hello',
      structuredPayload: null,
      replyToMessageId: null,
      burstId: null,
      status: MessageStatus.Accepted,
      createdAt: NOW,
      editedAt: null,
      deletedAt: null,
    });
    expect(ok.success).toBe(true);
    const bad = MessageSchema.safeParse({
      id: UUID,
      conversationId: UUID,
      senderActorId: UUID,
      sequence: 1,
      clientIdempotencyKey: 'short',
      kind: MessageKind.Text,
      content: 'hello',
      structuredPayload: null,
      replyToMessageId: null,
      burstId: null,
      status: MessageStatus.Accepted,
      createdAt: NOW,
      editedAt: null,
      deletedAt: null,
    });
    expect(bad.success).toBe(false);
  });

  it('WorldEvent only accepts known event types', () => {
    for (const t of WorldEventTypes) {
      const parsed = WorldEventSchema.parse({
        id: UUID,
        socialGraphId: UUID,
        type: t,
        actorId: UUID,
        subjectActorIds: [],
        conversationId: null,
        momentId: null,
        payload: {},
        visibilityPolicy: {},
        occurredAt: NOW,
        causedByEventId: null,
        idempotencyKey: 'idem-' + t,
      });
      expect(parsed.type).toBe(t);
    }
    expect(RealtimeEventTypes).toContain('message.created');
  });

  it('Memory types and confidences cover every documented value', () => {
    expect(Object.values(MemoryType)).toEqual([
      'private',
      'shared',
      'public',
      'reported',
      'native_world',
    ]);
    expect(Object.values(MemoryConfidence)).toEqual([
      'observed',
      'reported',
      'inferred',
      'uncertain',
      'deceptive_claim',
    ]);
  });

  it('MemoryItem requires non-empty objective fact and bounded subjective', () => {
    const ok = MemoryItemSchema.safeParse({
      id: UUID,
      ownerActorId: UUID,
      relationshipId: null,
      sourceEventId: UUID,
      sourceActorId: null,
      type: MemoryType.Private,
      objectiveFact: 'Robert has interview tomorrow',
      subjectiveInterpretation: 'Mira reads calm reassurance preference',
      confidence: MemoryConfidence.Observed,
      visibilityPolicy: { conversation: UUID },
      sharePolicy: { default: 'private' },
      relevanceTags: ['interview'],
      createdAt: NOW,
      lastRecalledAt: null,
      supersededById: null,
      deletedAt: null,
    });
    expect(ok.success).toBe(true);
  });

  it('ProactiveIntent dedupe key + (source,target) is unique by index', () => {
    const parsed = ProactiveIntentSchema.parse({
      id: UUID,
      sourceActorId: UUID,
      targetActorId: UUID,
      sourceEventId: UUID,
      reason: 'follow up on interview',
      privateContext: {},
      desiredEffect: 'reassurance',
      notBefore: NOW,
      expiresAt: new Date('2026-09-15T10:00:00.000Z').toISOString(),
      priority: 50,
      status: ProactiveStatus.Pending,
      quietHoursPolicy: {},
      dedupeKey: 'follow-up-2026-09-14',
    });
    expect(parsed.dedupeKey).toBe('follow-up-2026-09-14');
  });

  it('ConversationMember statuses and invitation states cover the matrix', () => {
    expect(Object.values(ConversationMemberStatus)).toContain('invited');
    expect(Object.values(InvitationStatus)).toContain('pending');
    expect(Object.values(RelationshipState)).toContain('blocked');
    expect(Object.values(BurstClosedReason)).toContain('max_wait_guard');
    expect(Object.values(AttentionAction)).toContain('reply_publicly');
    expect(Object.values(AttentionUrgency)).toContain('high');
    expect(Object.values(ToolExecutionStatus)).toContain('awaiting_confirmation');
    expect(Object.values(MemoryGrantPermission)).toContain('disclose');
  });

  it('SyncEnvelope validates upserts and tombstones separately', () => {
    const parsed = SyncEnvelopeSchema.parse({
      cursor: 'cursor-1',
      upserts: [
        {
          table: 'world_events',
          id: UUID,
          payload: { occurredAt: NOW },
        },
      ],
      tombstones: [
        {
          table: 'world_events',
          id: UUID,
          deletedAt: NOW,
        },
      ],
      serverTime: NOW,
    });
    expect(parsed.upserts[0]?.table).toBe('world_events');
  });

  it('Rejects nested synthetic types that should never appear', () => {
    expect(
      FriendRequestSchema.safeParse({
        id: UUID,
        senderActorId: UUID,
        recipientActorId: UUID,
        introductionEventId: null,
        note: null,
        status: 'pending',
        expiresAt: null,
        decidedAt: null,
      }).success,
    ).toBe(true);
    expect(
      GroupInvitationSchema.safeParse({
        id: UUID,
        conversationId: UUID,
        inviterActorId: UUID,
        inviteeActorId: UUID,
        visibleMemberSnapshot: [UUID],
        purpose: 'group',
        status: InvitationStatus.Pending,
        decisionReasonCode: null,
        createdAt: NOW,
        decidedAt: null,
      }).success,
    ).toBe(true);
    expect(
      RelationshipSchema.safeParse({
        id: UUID,
        socialGraphId: UUID,
        actorAId: UUID,
        actorBId: UUID,
        state: RelationshipState.Accepted,
        initiatedBy: UUID,
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      RelationshipPreferenceSchema.safeParse({
        relationshipId: UUID,
        ownerActorId: UUID,
        allowDirectMessage: true,
        allowProactiveMessage: true,
        mutedUntil: null,
        privateRemark: null,
        notificationLevel: 'all',
        shareDefaults: {},
      }).success,
    ).toBe(true);
    expect(
      RelationshipNarrativeSchema.safeParse({
        relationshipId: UUID,
        version: 1,
        currentDynamic: 'warm familiar',
        meaningfulHistory: [],
        trustAndUncertainty: '',
        tensions: [],
        boundaries: [],
        openThreads: [],
        relationshipDirection: 'friendly',
        changedByEventIds: [],
        generatedAt: NOW,
        modelMetadata: {},
      }).success,
    ).toBe(true);
    expect(
      CharacterActorSchema.safeParse({
        actorId: UUID,
        templateId: UUID,
        templateRevision: 1,
        socialGraphId: UUID,
        publicState: {},
        nativeWorldState: {},
        availabilityState: {},
        lastSimulatedAt: null,
        nextSimulationAfter: null,
      }).success,
    ).toBe(true);
    expect(
      SocialGraphSchema.safeParse({
        id: UUID,
        status: 'active',
        createdAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      ActorIdentityLinkSchema.safeParse({
        id: UUID,
        canonicalActorId: UUID,
        linkedActorId: UUID,
        templateId: UUID,
        createdByEventId: UUID,
        activeFrom: NOW,
        status: 'active',
        mergePolicyVersion: '1.0.0',
      }).success,
    ).toBe(true);
    expect(
      MessageBurstSchema.safeParse({
        id: UUID,
        conversationId: UUID,
        senderActorId: UUID,
        firstMessageSequence: 1,
        lastMessageSequence: 3,
        closedReason: BurstClosedReason.Inactivity,
        openedAt: NOW,
        closedAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      MomentSchema.safeParse({
        id: UUID,
        actorId: UUID,
        socialGraphId: UUID,
        content: 'walked by the river',
        mediaAssets: [],
        audiencePolicy: {
          allowedActorIds: [],
          class: 'public_within_graph',
        },
        sourceEventId: null,
        createdAt: NOW,
        deletedAt: null,
      }).success,
    ).toBe(true);
    expect(
      MomentInteractionSchema.safeParse({
        id: UUID,
        momentId: UUID,
        actorId: UUID,
        type: 'view',
        content: null,
        parentInteractionId: null,
        createdAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      ConversationMemberSchema.safeParse({
        conversationId: UUID,
        actorId: UUID,
        status: ConversationMemberStatus.Active,
        role: 'member',
        invitedByActorId: null,
        joinedAt: NOW,
        leftAt: null,
        lastReadSequence: 0,
      }).success,
    ).toBe(true);
    expect(
      MemoryGrantSchema.safeParse({
        memoryId: UUID,
        granteeActorId: UUID,
        grantedByEventId: UUID,
        permission: MemoryGrantPermission.Know,
        expiresAt: null,
      }).success,
    ).toBe(true);
    expect(
      ToolExecutionSchema.safeParse({
        id: UUID,
        requestingActorId: UUID,
        targetHumanActorId: null,
        conversationId: UUID,
        toolName: 'weather',
        arguments: { city: 'Shanghai' },
        permissionState: ToolExecutionStatus.AwaitingConfirmation,
        result: null,
        sourceMetadata: {},
        requestedAt: NOW,
        completedAt: null,
      }).success,
    ).toBe(true);
    expect(
      DeviceSchema.safeParse({
        id: UUID,
        accountId: UUID,
        platform: 'web',
        pushTokenEncrypted: null,
        appVersion: '1.0.0',
        lastSeenAt: NOW,
        notificationPermission: 'granted',
      }).success,
    ).toBe(true);
  });
});