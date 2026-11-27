CREATE TABLE "account_portable_merge_quotas" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"lifetime_rows" integer NOT NULL,
	"lifetime_bytes" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"window_rows" integer NOT NULL,
	"window_bytes" integer NOT NULL,
	"window_commits" integer NOT NULL,
	CONSTRAINT "portable_merge_quota_nonnegative" CHECK (
    "account_portable_merge_quotas"."lifetime_rows" >= 0 AND "account_portable_merge_quotas"."lifetime_bytes" >= 0 AND
    "account_portable_merge_quotas"."window_rows" >= 0 AND "account_portable_merge_quotas"."window_bytes" >= 0 AND "account_portable_merge_quotas"."window_commits" >= 0)
);
--> statement-breakpoint
ALTER TABLE "account_portable_merge_quotas" ADD CONSTRAINT "account_portable_merge_quotas_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;