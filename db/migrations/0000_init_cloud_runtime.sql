CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'deleting', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."actor_status" AS ENUM('active', 'unavailable', 'blocked', 'retired');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('human', 'character');--> statement-breakpoint
CREATE TYPE "public"."burst_closed_reason" AS ENUM('inactivity', 'explicit_mention', 'sender_left', 'max_wait_guard', 'manual');--> statement-breakpoint
CREATE TYPE "public"."conversation_member_status" AS ENUM('invited', 'active', 'declined', 'left', 'removed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."conversation_type" AS ENUM('direct', 'group', 'hidden_ai_direct');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."memory_confidence" AS ENUM('observed', 'reported', 'inferred', 'uncertain', 'deceptive_claim');--> statement-breakpoint
CREATE TYPE "public"."memory_grant_permission" AS ENUM('know', 'summarize', 'quote', 'disclose');--> statement-breakpoint
CREATE TYPE "public"."memory_type" AS ENUM('private', 'shared', 'public', 'reported', 'native_world');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'image', 'system', 'invitation', 'action_result');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sending', 'accepted', 'failed', 'conflicted');--> statement-breakpoint
CREATE TYPE "public"."persona_rights_status" AS ENUM('original', 'licensed', 'user_imported', 'internal_test_only');--> statement-breakpoint
CREATE TYPE "public"."proactive_status" AS ENUM('pending', 'claimed', 'sent', 'cancelled', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."relationship_state" AS ENUM('requested', 'accepted', 'declined', 'deleted', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."tool_execution_status" AS ENUM('requested', 'awaiting_confirmation', 'confirmed', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"primary_email" text,
	"apple_subject" text,
	"display_name" text NOT NULL,
	"locale" text DEFAULT 'zh-CN' NOT NULL,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "actor_identity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_actor_id" uuid NOT NULL,
	"linked_actor_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"created_by_event_id" uuid NOT NULL,
	"active_from" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"merge_policy_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_graph_id" uuid NOT NULL,
	"account_id" uuid,
	"type" "actor_type" NOT NULL,
	"public_name" text NOT NULL,
	"avatar_asset_id" uuid,
	"template_id" uuid,
	"status" "actor_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_actors" (
	"actor_id" uuid PRIMARY KEY NOT NULL,
	"template_id" uuid NOT NULL,
	"template_revision" integer NOT NULL,
	"social_graph_id" uuid NOT NULL,
	"public_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"native_world_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"availability_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_simulated_at" timestamp with time zone,
	"next_simulation_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"status" "conversation_member_status" DEFAULT 'invited' NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by_actor_id" uuid,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"last_read_sequence" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "conversation_members_conversation_id_actor_id_pk" PRIMARY KEY("conversation_id","actor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_graph_id" uuid NOT NULL,
	"type" "conversation_type" NOT NULL,
	"public_name" text,
	"avatar_asset_id" uuid,
	"created_by_actor_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"push_token_encrypted" text,
	"app_version" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notification_permission" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_actor_id" uuid NOT NULL,
	"recipient_actor_id" uuid NOT NULL,
	"introduction_event_id" uuid,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"inviter_actor_id" uuid NOT NULL,
	"invitee_actor_id" uuid NOT NULL,
	"visible_member_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"purpose" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"decision_reason_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_grants" (
	"memory_id" uuid NOT NULL,
	"grantee_actor_id" uuid NOT NULL,
	"granted_by_event_id" uuid NOT NULL,
	"permission" "memory_grant_permission" NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "memory_grants_memory_id_grantee_actor_id_pk" PRIMARY KEY("memory_id","grantee_actor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_actor_id" uuid NOT NULL,
	"relationship_id" uuid,
	"source_event_id" uuid NOT NULL,
	"source_actor_id" uuid,
	"type" "memory_type" NOT NULL,
	"objective_fact" text NOT NULL,
	"subjective_interpretation" text NOT NULL,
	"confidence" "memory_confidence" NOT NULL,
	"visibility_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"share_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"relevance_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_recalled_at" timestamp with time zone,
	"superseded_by_id" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_bursts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_actor_id" uuid NOT NULL,
	"first_message_sequence" integer NOT NULL,
	"last_message_sequence" integer NOT NULL,
	"closed_reason" "burst_closed_reason",
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_actor_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"client_idempotency_key" text NOT NULL,
	"kind" "message_kind" NOT NULL,
	"content" text NOT NULL,
	"structured_payload" jsonb,
	"reply_to_message_id" uuid,
	"burst_id" uuid,
	"status" "message_status" DEFAULT 'accepted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moment_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moment_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"type" text NOT NULL,
	"content" text,
	"parent_interaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"social_graph_id" uuid NOT NULL,
	"content" text NOT NULL,
	"media_assets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audience_policy" jsonb NOT NULL,
	"source_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persona_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"schema_version" text NOT NULL,
	"public_name" text NOT NULL,
	"localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"native_world" text DEFAULT '' NOT NULL,
	"canon_anchor" text NOT NULL,
	"identity_prompt" text NOT NULL,
	"values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flaws" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"speaking_style" text NOT NULL,
	"routines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"canonical_relationships" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"anti_drift_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rights_status" "persona_rights_status" NOT NULL,
	"content_policy_profile" text NOT NULL,
	"immutable_revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proactive_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_actor_id" uuid NOT NULL,
	"target_actor_id" uuid NOT NULL,
	"source_event_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"private_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"desired_effect" text NOT NULL,
	"not_before" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"status" "proactive_status" DEFAULT 'pending' NOT NULL,
	"quiet_hours_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationship_narratives" (
	"relationship_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"current_dynamic" text NOT NULL,
	"meaningful_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trust_and_uncertainty" text DEFAULT '' NOT NULL,
	"tensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"boundaries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_threads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"relationship_direction" text DEFAULT '' NOT NULL,
	"changed_by_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "relationship_narratives_relationship_id_version_pk" PRIMARY KEY("relationship_id","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationship_preferences" (
	"relationship_id" uuid PRIMARY KEY NOT NULL,
	"owner_actor_id" uuid NOT NULL,
	"allow_direct_message" boolean DEFAULT true NOT NULL,
	"allow_proactive_message" boolean DEFAULT true NOT NULL,
	"muted_until" timestamp with time zone,
	"private_remark" text,
	"notification_level" text DEFAULT 'all' NOT NULL,
	"share_defaults" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_graph_id" uuid NOT NULL,
	"actor_a_id" uuid NOT NULL,
	"actor_b_id" uuid NOT NULL,
	"state" "relationship_state" NOT NULL,
	"initiated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_graphs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_cursor" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"cursor" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requesting_actor_id" uuid NOT NULL,
	"target_human_actor_id" uuid,
	"conversation_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"permission_state" "tool_execution_status" DEFAULT 'requested' NOT NULL,
	"result" jsonb,
	"source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "world_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_graph_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"subject_actor_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conversation_id" uuid,
	"moment_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"caused_by_event_id" uuid,
	"idempotency_key" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actor_identity_links" ADD CONSTRAINT "actor_identity_links_canonical_actor_id_actors_id_fk" FOREIGN KEY ("canonical_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actor_identity_links" ADD CONSTRAINT "actor_identity_links_linked_actor_id_actors_id_fk" FOREIGN KEY ("linked_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actor_identity_links" ADD CONSTRAINT "actor_identity_links_template_id_persona_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."persona_templates"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actors" ADD CONSTRAINT "actors_social_graph_id_social_graphs_id_fk" FOREIGN KEY ("social_graph_id") REFERENCES "public"."social_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actors" ADD CONSTRAINT "actors_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actors" ADD CONSTRAINT "actors_template_id_persona_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."persona_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_actors" ADD CONSTRAINT "character_actors_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_actors" ADD CONSTRAINT "character_actors_template_id_persona_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."persona_templates"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_actors" ADD CONSTRAINT "character_actors_social_graph_id_social_graphs_id_fk" FOREIGN KEY ("social_graph_id") REFERENCES "public"."social_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_invited_by_actor_id_actors_id_fk" FOREIGN KEY ("invited_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_social_graph_id_social_graphs_id_fk" FOREIGN KEY ("social_graph_id") REFERENCES "public"."social_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "devices" ADD CONSTRAINT "devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_sender_actor_id_actors_id_fk" FOREIGN KEY ("sender_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_recipient_actor_id_actors_id_fk" FOREIGN KEY ("recipient_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_inviter_actor_id_actors_id_fk" FOREIGN KEY ("inviter_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_invitee_actor_id_actors_id_fk" FOREIGN KEY ("invitee_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_grants" ADD CONSTRAINT "memory_grants_memory_id_memory_items_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_grants" ADD CONSTRAINT "memory_grants_grantee_actor_id_actors_id_fk" FOREIGN KEY ("grantee_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_owner_actor_id_actors_id_fk" FOREIGN KEY ("owner_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_source_actor_id_actors_id_fk" FOREIGN KEY ("source_actor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_bursts" ADD CONSTRAINT "message_bursts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_bursts" ADD CONSTRAINT "message_bursts_sender_actor_id_actors_id_fk" FOREIGN KEY ("sender_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_actor_id_actors_id_fk" FOREIGN KEY ("sender_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moment_interactions" ADD CONSTRAINT "moment_interactions_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."moments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moment_interactions" ADD CONSTRAINT "moment_interactions_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moments" ADD CONSTRAINT "moments_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moments" ADD CONSTRAINT "moments_social_graph_id_social_graphs_id_fk" FOREIGN KEY ("social_graph_id") REFERENCES "public"."social_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proactive_intents" ADD CONSTRAINT "proactive_intents_source_actor_id_actors_id_fk" FOREIGN KEY ("source_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proactive_intents" ADD CONSTRAINT "proactive_intents_target_actor_id_actors_id_fk" FOREIGN KEY ("target_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationship_narratives" ADD CONSTRAINT "relationship_narratives_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationship_preferences" ADD CONSTRAINT "relationship_preferences_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationship_preferences" ADD CONSTRAINT "relationship_preferences_owner_actor_id_actors_id_fk" FOREIGN KEY ("owner_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationships" ADD CONSTRAINT "relationships_social_graph_id_social_graphs_id_fk" FOREIGN KEY ("social_graph_id") REFERENCES "public"."social_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationships" ADD CONSTRAINT "relationships_actor_a_id_actors_id_fk" FOREIGN KEY ("actor_a_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationships" ADD CONSTRAINT "relationships_actor_b_id_actors_id_fk" FOREIGN KEY ("actor_b_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationships" ADD CONSTRAINT "relationships_initiated_by_actors_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_cursor" ADD CONSTRAINT "sync_cursor_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_requesting_actor_id_actors_id_fk" FOREIGN KEY ("requesting_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_target_human_actor_id_actors_id_fk" FOREIGN KEY ("target_human_actor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "world_events" ADD CONSTRAINT "world_events_social_graph_id_social_graphs_id_fk" FOREIGN KEY ("social_graph_id") REFERENCES "public"."social_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "world_events" ADD CONSTRAINT "world_events_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_apple_subject_idx" ON "accounts" USING btree ("apple_subject");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_primary_email_idx" ON "accounts" USING btree ("primary_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_links_canonical_idx" ON "actor_identity_links" USING btree ("canonical_actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_links_linked_idx" ON "actor_identity_links" USING btree ("linked_actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actors_graph_idx" ON "actors" USING btree ("social_graph_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actors_template_idx" ON "actors" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "actors_account_unique_idx" ON "actors" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_members_status_idx" ON "conversation_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_account_idx" ON "devices" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_requests_pair_idx" ON "friend_requests" USING btree ("sender_actor_id","recipient_actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_requests_status_idx" ON "friend_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_invitations_invitee_idx" ON "group_invitations" USING btree ("invitee_actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_invitations_status_idx" ON "group_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_items_owner_idx" ON "memory_items" USING btree ("owner_actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_items_relationship_idx" ON "memory_items" USING btree ("relationship_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_bursts_sender_idx" ON "message_bursts" USING btree ("sender_actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messages_conv_seq_idx" ON "messages" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messages_idempotency_idx" ON "messages" USING btree ("conversation_id","client_idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_burst_idx" ON "messages" USING btree ("burst_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moment_interactions_moment_idx" ON "moment_interactions" USING btree ("moment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moments_actor_idx" ON "moments" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moments_graph_idx" ON "moments" USING btree ("social_graph_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "persona_templates_slug_idx" ON "persona_templates" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proactive_intents_dedupe_idx" ON "proactive_intents" USING btree ("source_actor_id","target_actor_id","dedupe_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proactive_intents_due_idx" ON "proactive_intents" USING btree ("status","not_before");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_pair_idx" ON "relationships" USING btree ("actor_a_id","actor_b_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_account_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_executions_conv_idx" ON "tool_executions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "world_events_graph_occurred_idx" ON "world_events" USING btree ("social_graph_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "world_events_idempotency_idx" ON "world_events" USING btree ("social_graph_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "world_events_type_idx" ON "world_events" USING btree ("type");