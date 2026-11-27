CREATE TABLE "account_portable_backups" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"document" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portable_backup_payload_size" CHECK (octet_length("account_portable_backups"."document") <= 4194304)
);
--> statement-breakpoint
ALTER TABLE "account_portable_backups" ADD CONSTRAINT "account_portable_backups_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;