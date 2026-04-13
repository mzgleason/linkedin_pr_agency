-- Enums
DO $$ BEGIN
  CREATE TYPE "TopicInboxStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Columns
ALTER TABLE "Topic"
  ADD COLUMN IF NOT EXISTS "inboxStatus" "TopicInboxStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "opinionPitch" TEXT,
  ADD COLUMN IF NOT EXISTS "whyItMatters" TEXT;

CREATE INDEX IF NOT EXISTS "Topic_inboxStatus_idx" ON "Topic" ("inboxStatus");
