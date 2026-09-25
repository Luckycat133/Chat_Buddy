ALTER TABLE "tool_executions" ALTER COLUMN "conversation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "moment_interactions" ADD COLUMN "client_idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "moment_interactions_client_key_idx" ON "moment_interactions" USING btree ("moment_id","actor_id","client_idempotency_key");