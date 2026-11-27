CREATE TABLE "account_portable_backups" (
  "account_id" uuid PRIMARY KEY REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "sha256" text NOT NULL,
  "document" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "portable_backup_payload_size" CHECK (octet_length("document") <= 4194304)
);
