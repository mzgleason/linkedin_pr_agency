-- Topic Storage and Status Lifecycle (MZG-31)
-- Migrate from TopicInboxStatus/PENDING|APPROVED|REJECTED to TopicStatus/NEW|APPROVED|REJECTED|SAVED|IN_PROGRESS

DO $$ BEGIN
  CREATE TYPE "TopicStatus" AS ENUM ('NEW', 'APPROVED', 'REJECTED', 'SAVED', 'IN_PROGRESS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Topic"
  ADD COLUMN IF NOT EXISTS "status" "TopicStatus" NOT NULL DEFAULT 'NEW';

UPDATE "Topic"
SET "status" = CASE
  WHEN "inboxStatus" = 'PENDING' THEN 'NEW'::"TopicStatus"
  WHEN "inboxStatus" = 'APPROVED' THEN 'APPROVED'::"TopicStatus"
  WHEN "inboxStatus" = 'REJECTED' THEN 'REJECTED'::"TopicStatus"
  ELSE 'NEW'::"TopicStatus"
END
WHERE "status" IS NULL OR "status" = 'NEW';

DROP INDEX IF EXISTS "Topic_inboxStatus_idx";
CREATE INDEX IF NOT EXISTS "Topic_status_idx" ON "Topic" ("status");

ALTER TABLE "Topic" DROP COLUMN IF EXISTS "inboxStatus";

DO $$ BEGIN
  DROP TYPE "TopicInboxStatus";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

