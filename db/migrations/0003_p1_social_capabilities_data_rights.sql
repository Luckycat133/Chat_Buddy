CREATE TABLE IF NOT EXISTS "actor_capability_settings" (
	"actor_id" uuid PRIMARY KEY NOT NULL,
	"weather_city" text,
	"weather_consent_at" timestamp with time zone,
	"weather_location_lat" double precision,
	"weather_location_lon" double precision,
	"calendar_provider" text,
	"calendar_connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "actor_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_graph_id" uuid NOT NULL,
	"reporter_actor_id" uuid NOT NULL,
	"reported_actor_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_graph_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_by_actor_id" uuid,
	"relationship_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "moments" ADD COLUMN "import_key" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actor_capability_settings" ADD CONSTRAINT "actor_capability_settings_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actor_reports" ADD CONSTRAINT "actor_reports_social_graph_id_social_graphs_id_fk" FOREIGN KEY ("social_graph_id") REFERENCES "public"."social_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actor_reports" ADD CONSTRAINT "actor_reports_reporter_actor_id_actors_id_fk" FOREIGN KEY ("reporter_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actor_reports" ADD CONSTRAINT "actor_reports_reported_actor_id_actors_id_fk" FOREIGN KEY ("reported_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_invites" ADD CONSTRAINT "contact_invites_social_graph_id_social_graphs_id_fk" FOREIGN KEY ("social_graph_id") REFERENCES "public"."social_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_invites" ADD CONSTRAINT "contact_invites_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_invites" ADD CONSTRAINT "contact_invites_accepted_by_actor_id_actors_id_fk" FOREIGN KEY ("accepted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_invites" ADD CONSTRAINT "contact_invites_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actor_reports_reporter_idx" ON "actor_reports" USING btree ("reporter_actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actor_reports_reported_idx" ON "actor_reports" USING btree ("reported_actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_invites_code_idx" ON "contact_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_invites_creator_idx" ON "contact_invites" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memory_items_import_key_idx" ON "memory_items" USING btree ("import_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "moments_import_key_idx" ON "moments" USING btree ("import_key");