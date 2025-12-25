-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
  "discord_id" text PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "avatar" text,
  "currency" integer DEFAULT 10 NOT NULL,
  "onboarding" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Migrate existing session data to users table (deduplicate by discord_id, keeping the most recent)
INSERT INTO "users" ("discord_id", "username", "avatar", "currency", "onboarding", "created_at", "updated_at")
SELECT DISTINCT ON ("discord_id")
  "discord_id",
  "username",
  "avatar",
  "currency",
  "onboarding",
  "created_at",
  now() as "updated_at"
FROM "sessions"
ORDER BY "discord_id", "created_at" DESC
ON CONFLICT ("discord_id") DO NOTHING;

-- Drop columns from sessions table
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "username";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "avatar";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "onboarding";

-- Add foreign key constraint
ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_discord_id_users_discord_id_fk"
FOREIGN KEY ("discord_id") REFERENCES "users"("discord_id") ON DELETE cascade;
