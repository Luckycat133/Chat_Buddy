/**
 * Drizzle ORM schema for the Chat Buddy cloud runtime.
 *
 * Per DOMAIN_ARCHITECTURE §4-§5 and WEB_IMPLEMENTATION §5, every table
 * owns its opaque ID, foreign keys, and uniqueness constraints.
 * Authorization is computed in repositories, not in the database.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const accountStatusEnum = pgEnum('account_status', [
  'active',
  'suspended',
  'deleting',
  'deleted',
]);

export const actorTypeEnum = pgEnum('actor_type', ['human', 'character']);
export const actorStatusEnum = pgEnum('actor_status', [
  'active',
  'unavailable',
  'blocked',
  'retired',
]);

export const personaRightsEnum = pgEnum('persona_rights_status', [
  'original',
  'licensed',
  'user_imported',
  'internal_test_only',
]);

export const conversationTypeEnum = pgEnum('conversation_type', [
  'direct',
  'group',
  'hidden_ai_direct',
]);

export const conversationMemberStatusEnum = pgEnum(
  'conversation_member_status',
  ['invited', 'active', 'declined', 'left', 'removed', 'blocked'],
);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'expired',
]);

export const relationshipStateEnum = pgEnum('relationship_state', [
  'requested',
  'accepted',
  'declined',
  'deleted',
  'blocked',
]);

export const memoryTypeEnum = pgEnum('memory_type', [
  'private',
  'shared',
  'public',
  'reported',
  'native_world',
]);

export const memoryConfidenceEnum = pgEnum('memory_confidence', [
  'observed',
  'reported',
  'inferred',
  'uncertain',
  'deceptive_claim',
]);

export const memoryGrantPermissionEnum = pgEnum('memory_grant_permission', [
  'know',
  'summarize',
  'quote',
  'disclose',
]);

export const proactiveStatusEnum = pgEnum('proactive_status', [
  'pending',
  'claimed',
  'sent',
  'cancelled',
  'expired',
  'failed',
]);

export const toolExecutionStatusEnum = pgEnum('tool_execution_status', [
  'requested',
  'awaiting_confirmation',
  'confirmed',
  'succeeded',
  'failed',
  'cancelled',
]);

export const messageKindEnum = pgEnum('message_kind', [
  'text',
  'image',
  'system',
  'invitation',
  'action_result',
]);

export const messageStatusEnum = pgEnum('message_status', [
  'queued',
  'sending',
  'accepted',
  'failed',
  'conflicted',
]);

export const burstClosedReasonEnum = pgEnum('burst_closed_reason', [
  'inactivity',
  'explicit_mention',
  'sender_left',
  'max_wait_guard',
  'manual',
]);

/* -------------------------------------------------------------------------- */
/*                                  accounts                                  */
/* -------------------------------------------------------------------------- */

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: accountStatusEnum('status').notNull().default('active'),
    primaryEmail: text('primary_email'),
    appleSubject: text('apple_subject'),
    displayName: text('display_name').notNull(),
    locale: text('locale').notNull().default('zh-CN'),
    timezone: text('timezone').notNull().default('Asia/Shanghai'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    appleSubjectIdx: uniqueIndex('accounts_apple_subject_idx').on(
      table.appleSubject,
    ),
    primaryEmailIdx: uniqueIndex('accounts_primary_email_idx').on(
      table.primaryEmail,
    ),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    accountIdx: index('sessions_account_idx').on(table.accountId),
  }),
);

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    pushTokenEncrypted: text('push_token_encrypted'),
    appVersion: text('app_version').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    notificationPermission: text('notification_permission').notNull(),
  },
  (table) => ({
    accountIdx: index('devices_account_idx').on(table.accountId),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                social graph                                */
/* -------------------------------------------------------------------------- */

export const socialGraphs = pgTable('social_graphs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const personaTemplates = pgTable(
  'persona_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    schemaVersion: text('schema_version').notNull(),
    publicName: text('public_name').notNull(),
    localizedNames: jsonb('localized_names').notNull().default({}),
    nativeWorld: text('native_world').notNull().default(''),
    canonAnchor: text('canon_anchor').notNull(),
    identityPrompt: text('identity_prompt').notNull(),
    values: jsonb('values').notNull().default([]),
    flaws: jsonb('flaws').notNull().default([]),
    speakingStyle: text('speaking_style').notNull(),
    routines: jsonb('routines').notNull().default([]),
    interests: jsonb('interests').notNull().default([]),
    canonicalRelationships: jsonb('canonical_relationships')
      .notNull()
      .default([]),
    capabilities: jsonb('capabilities').notNull().default([]),
    antiDriftRules: jsonb('anti_drift_rules').notNull().default([]),
    examples: jsonb('examples').notNull().default([]),
    rightsStatus: personaRightsEnum('rights_status').notNull(),
    contentPolicyProfile: text('content_policy_profile').notNull(),
    immutableRevision: integer('immutable_revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('persona_templates_slug_idx').on(table.slug),
  }),
);

export const actors = pgTable(
  'actors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    socialGraphId: uuid('social_graph_id')
      .notNull()
      .references(() => socialGraphs.id, { onDelete: 'cascade' }),
    /**
     * Set only for human actors. One account owns one human actor across
     * all of its graphs (per DOMAIN_ARCHITECTURE §4.1).
     */
    accountId: uuid('account_id').references(() => accounts.id, {
      onDelete: 'cascade',
    }),
    type: actorTypeEnum('type').notNull(),
    publicName: text('public_name').notNull(),
    avatarAssetId: uuid('avatar_asset_id'),
    templateId: uuid('template_id').references(() => personaTemplates.id, {
      onDelete: 'set null',
    }),
    status: actorStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    graphIdx: index('actors_graph_idx').on(table.socialGraphId),
    templateIdx: index('actors_template_idx').on(table.templateId),
    accountIdx: uniqueIndex('actors_account_unique_idx').on(table.accountId),
  }),
);

export const characterActors = pgTable('character_actors', {
  actorId: uuid('actor_id')
    .primaryKey()
    .references(() => actors.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id')
    .notNull()
    .references(() => personaTemplates.id, { onDelete: 'restrict' }),
  templateRevision: integer('template_revision').notNull(),
  socialGraphId: uuid('social_graph_id')
    .notNull()
    .references(() => socialGraphs.id, { onDelete: 'cascade' }),
  publicState: jsonb('public_state').notNull().default({}),
  nativeWorldState: jsonb('native_world_state').notNull().default({}),
  availabilityState: jsonb('availability_state').notNull().default({}),
  lastSimulatedAt: timestamp('last_simulated_at', { withTimezone: true }),
  nextSimulationAfter: timestamp('next_simulation_after', {
    withTimezone: true,
  }),
});

export const actorIdentityLinks = pgTable(
  'actor_identity_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canonicalActorId: uuid('canonical_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    linkedActorId: uuid('linked_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => personaTemplates.id, { onDelete: 'restrict' }),
    createdByEventId: uuid('created_by_event_id').notNull(),
    activeFrom: timestamp('active_from', { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text('status').notNull().default('active'),
    mergePolicyVersion: text('merge_policy_version').notNull(),
  },
  (table) => ({
    canonicalIdx: index('identity_links_canonical_idx').on(
      table.canonicalActorId,
    ),
    linkedIdx: index('identity_links_linked_idx').on(table.linkedActorId),
  }),
);

/* -------------------------------------------------------------------------- */
/*                              social relationships                          */
/* -------------------------------------------------------------------------- */

export const relationships = pgTable(
  'relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    socialGraphId: uuid('social_graph_id')
      .notNull()
      .references(() => socialGraphs.id, { onDelete: 'cascade' }),
    actorAId: uuid('actor_a_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    actorBId: uuid('actor_b_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    state: relationshipStateEnum('state').notNull(),
    initiatedBy: uuid('initiated_by')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pairIdx: uniqueIndex('relationships_pair_idx').on(
      table.actorAId,
      table.actorBId,
    ),
  }),
);

export const relationshipPreferences = pgTable(
  'relationship_preferences',
  {
    relationshipId: uuid('relationship_id')
      .primaryKey()
      .references(() => relationships.id, { onDelete: 'cascade' }),
    ownerActorId: uuid('owner_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    allowDirectMessage: boolean('allow_direct_message').notNull().default(true),
    allowProactiveMessage: boolean('allow_proactive_message')
      .notNull()
      .default(true),
    mutedUntil: timestamp('muted_until', { withTimezone: true }),
    privateRemark: text('private_remark'),
    notificationLevel: text('notification_level').notNull().default('all'),
    shareDefaults: jsonb('share_defaults').notNull().default({}),
  },
);

export const relationshipNarratives = pgTable(
  'relationship_narratives',
  {
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationships.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    currentDynamic: text('current_dynamic').notNull(),
    meaningfulHistory: jsonb('meaningful_history').notNull().default([]),
    trustAndUncertainty: text('trust_and_uncertainty').notNull().default(''),
    tensions: jsonb('tensions').notNull().default([]),
    boundaries: jsonb('boundaries').notNull().default([]),
    openThreads: jsonb('open_threads').notNull().default([]),
    relationshipDirection: text('relationship_direction').notNull().default(''),
    changedByEventIds: jsonb('changed_by_event_ids').notNull().default([]),
    generatedAt: timestamp('generated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    modelMetadata: jsonb('model_metadata').notNull().default({}),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.relationshipId, table.version] }),
  }),
);

export const friendRequests = pgTable(
  'friend_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderActorId: uuid('sender_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    recipientActorId: uuid('recipient_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    introductionEventId: uuid('introduction_event_id'),
    note: text('note'),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pairIdx: index('friend_requests_pair_idx').on(
      table.senderActorId,
      table.recipientActorId,
    ),
    statusIdx: index('friend_requests_status_idx').on(table.status),
  }),
);

/* -------------------------------------------------------------------------- */
/*                              conversations & messages                       */
/* -------------------------------------------------------------------------- */

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  socialGraphId: uuid('social_graph_id')
    .notNull()
    .references(() => socialGraphs.id, { onDelete: 'cascade' }),
  type: conversationTypeEnum('type').notNull(),
  publicName: text('public_name'),
  avatarAssetId: uuid('avatar_asset_id'),
  createdByActorId: uuid('created_by_actor_id')
    .notNull()
    .references(() => actors.id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    status: conversationMemberStatusEnum('status').notNull().default('invited'),
    role: text('role').notNull().default('member'),
    invitedByActorId: uuid('invited_by_actor_id').references(() => actors.id, {
      onDelete: 'set null',
    }),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    leftAt: timestamp('left_at', { withTimezone: true }),
    lastReadSequence: integer('last_read_sequence').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.actorId] }),
    statusIdx: index('conversation_members_status_idx').on(table.status),
  }),
);

export const groupInvitations = pgTable(
  'group_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    inviterActorId: uuid('inviter_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    inviteeActorId: uuid('invitee_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    visibleMemberSnapshot: jsonb('visible_member_snapshot')
      .notNull()
      .default([]),
    purpose: text('purpose').notNull(),
    status: invitationStatusEnum('status').notNull().default('pending'),
    decisionReasonCode: text('decision_reason_code'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (table) => ({
    inviteeIdx: index('group_invitations_invitee_idx').on(table.inviteeActorId),
    statusIdx: index('group_invitations_status_idx').on(table.status),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderActorId: uuid('sender_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    clientIdempotencyKey: text('client_idempotency_key').notNull(),
    kind: messageKindEnum('kind').notNull(),
    content: text('content').notNull(),
    structuredPayload: jsonb('structured_payload'),
    replyToMessageId: uuid('reply_to_message_id'),
    burstId: uuid('burst_id'),
    status: messageStatusEnum('status').notNull().default('accepted'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    convSeqIdx: uniqueIndex('messages_conv_seq_idx').on(
      table.conversationId,
      table.sequence,
    ),
    idempotencyIdx: uniqueIndex('messages_idempotency_idx').on(
      table.conversationId,
      table.clientIdempotencyKey,
    ),
    burstIdx: index('messages_burst_idx').on(table.burstId),
  }),
);

export const messageBursts = pgTable(
  'message_bursts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderActorId: uuid('sender_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    firstMessageSequence: integer('first_message_sequence').notNull(),
    lastMessageSequence: integer('last_message_sequence').notNull(),
    closedReason: burstClosedReasonEnum('closed_reason'),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => ({
    senderIdx: index('message_bursts_sender_idx').on(table.senderActorId),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                    moments                                  */
/* -------------------------------------------------------------------------- */

export const moments = pgTable(
  'moments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    socialGraphId: uuid('social_graph_id')
      .notNull()
      .references(() => socialGraphs.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    mediaAssets: jsonb('media_assets').notNull().default([]),
    audiencePolicy: jsonb('audience_policy').notNull(),
    sourceEventId: uuid('source_event_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    actorIdx: index('moments_actor_idx').on(table.actorId),
    graphIdx: index('moments_graph_idx').on(table.socialGraphId),
  }),
);

export const momentInteractions = pgTable(
  'moment_interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    momentId: uuid('moment_id')
      .notNull()
      .references(() => moments.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    content: text('content'),
    parentInteractionId: uuid('parent_interaction_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    momentIdx: index('moment_interactions_moment_idx').on(table.momentId),
  }),
);

/* -------------------------------------------------------------------------- */
/*                              memory & relationships                        */
/* -------------------------------------------------------------------------- */

export const memoryItems = pgTable(
  'memory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerActorId: uuid('owner_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    relationshipId: uuid('relationship_id').references(
      () => relationships.id,
      { onDelete: 'set null' },
    ),
    sourceEventId: uuid('source_event_id').notNull(),
    sourceActorId: uuid('source_actor_id').references(() => actors.id, {
      onDelete: 'set null',
    }),
    type: memoryTypeEnum('type').notNull(),
    objectiveFact: text('objective_fact').notNull(),
    subjectiveInterpretation: text('subjective_interpretation').notNull(),
    confidence: memoryConfidenceEnum('confidence').notNull(),
    visibilityPolicy: jsonb('visibility_policy').notNull().default({}),
    sharePolicy: jsonb('share_policy').notNull().default({}),
    relevanceTags: jsonb('relevance_tags').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastRecalledAt: timestamp('last_recalled_at', { withTimezone: true }),
    supersededById: uuid('superseded_by_id'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    ownerIdx: index('memory_items_owner_idx').on(table.ownerActorId),
    relationshipIdx: index('memory_items_relationship_idx').on(
      table.relationshipId,
    ),
  }),
);

export const memoryGrants = pgTable(
  'memory_grants',
  {
    memoryId: uuid('memory_id')
      .notNull()
      .references(() => memoryItems.id, { onDelete: 'cascade' }),
    granteeActorId: uuid('grantee_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    grantedByEventId: uuid('granted_by_event_id').notNull(),
    permission: memoryGrantPermissionEnum('permission').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.memoryId, table.granteeActorId] }),
  }),
);

/* -------------------------------------------------------------------------- */
/*                           proactive intents & tools                        */
/* -------------------------------------------------------------------------- */

export const proactiveIntents = pgTable(
  'proactive_intents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceActorId: uuid('source_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    targetActorId: uuid('target_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    sourceEventId: uuid('source_event_id').notNull(),
    reason: text('reason').notNull(),
    privateContext: jsonb('private_context').notNull().default({}),
    desiredEffect: text('desired_effect').notNull(),
    notBefore: timestamp('not_before', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    priority: integer('priority').notNull().default(50),
    status: proactiveStatusEnum('status').notNull().default('pending'),
    quietHoursPolicy: jsonb('quiet_hours_policy').notNull().default({}),
    dedupeKey: text('dedupe_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    dedupeIdx: uniqueIndex('proactive_intents_dedupe_idx').on(
      table.sourceActorId,
      table.targetActorId,
      table.dedupeKey,
    ),
    dueIdx: index('proactive_intents_due_idx').on(
      table.status,
      table.notBefore,
    ),
  }),
);

export const toolExecutions = pgTable(
  'tool_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestingActorId: uuid('requesting_actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    targetHumanActorId: uuid('target_human_actor_id').references(
      () => actors.id,
      { onDelete: 'set null' },
    ),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    toolName: text('tool_name').notNull(),
    arguments: jsonb('arguments').notNull(),
    permissionState: toolExecutionStatusEnum('permission_state')
      .notNull()
      .default('requested'),
    result: jsonb('result'),
    sourceMetadata: jsonb('source_metadata').notNull().default({}),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    convIdx: index('tool_executions_conv_idx').on(table.conversationId),
  }),
);

/* -------------------------------------------------------------------------- */
/*                              immutable event log                           */
/* -------------------------------------------------------------------------- */

export const worldEvents = pgTable(
  'world_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    socialGraphId: uuid('social_graph_id')
      .notNull()
      .references(() => socialGraphs.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    subjectActorIds: jsonb('subject_actor_ids').notNull().default([]),
    conversationId: uuid('conversation_id'),
    momentId: uuid('moment_id'),
    payload: jsonb('payload').notNull().default({}),
    visibilityPolicy: jsonb('visibility_policy').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    causedByEventId: uuid('caused_by_event_id'),
    idempotencyKey: text('idempotency_key').notNull(),
  },
  (table) => ({
    graphOccurredIdx: index('world_events_graph_occurred_idx').on(
      table.socialGraphId,
      table.occurredAt,
    ),
    idempotencyIdx: uniqueIndex('world_events_idempotency_idx').on(
      table.socialGraphId,
      table.idempotencyKey,
    ),
    typeIdx: index('world_events_type_idx').on(table.type),
  }),
);

export const syncCursor = pgTable('sync_cursor', {
  accountId: uuid('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  cursor: text('cursor').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
