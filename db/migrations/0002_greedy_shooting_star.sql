CREATE TABLE IF NOT EXISTS "push_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid,
	"actor_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"ok" boolean NOT NULL,
	"detail" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_delivery_attempts" ADD CONSTRAINT "push_delivery_attempts_intent_id_proactive_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."proactive_intents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_delivery_attempts" ADD CONSTRAINT "push_delivery_attempts_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_delivery_attempts_intent_idx" ON "push_delivery_attempts" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_delivery_attempts_actor_idx" ON "push_delivery_attempts" USING btree ("actor_id");