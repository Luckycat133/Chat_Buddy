ALTER TABLE "sessions" ADD COLUMN "access_token_hash" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_access_token_idx" ON "sessions" USING btree ("access_token_hash");