ALTER TABLE "sessions" ADD COLUMN "user_agent" text DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
