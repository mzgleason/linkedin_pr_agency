-- Ensure uuid generator exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User table
CREATE TABLE IF NOT EXISTS "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "stripeSubStatus" TEXT,
  "stripePriceId" TEXT,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Add userId columns (nullable for backfill)
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "userId" UUID;
ALTER TABLE "Opinion" ADD COLUMN IF NOT EXISTS "userId" UUID;
ALTER TABLE "Draft" ADD COLUMN IF NOT EXISTS "userId" UUID;
ALTER TABLE "ResearchRun" ADD COLUMN IF NOT EXISTS "userId" UUID;

-- Backfill existing records to a legacy user
DO $$
DECLARE
  legacy_user_id UUID;
BEGIN
  SELECT "id" INTO legacy_user_id FROM "User" WHERE "email" = 'legacy@local' LIMIT 1;
  IF legacy_user_id IS NULL THEN
    INSERT INTO "User" ("email", "passwordHash", "createdAt", "updatedAt")
    VALUES ('legacy@local', 'LEGACY_ACCOUNT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING "id" INTO legacy_user_id;
  END IF;

  UPDATE "Topic" SET "userId" = legacy_user_id WHERE "userId" IS NULL;
  UPDATE "Opinion" SET "userId" = legacy_user_id WHERE "userId" IS NULL;
  UPDATE "Draft" SET "userId" = legacy_user_id WHERE "userId" IS NULL;
  UPDATE "ResearchRun" SET "userId" = legacy_user_id WHERE "userId" IS NULL;
END $$;

-- Enforce NOT NULL after backfill
ALTER TABLE "Topic" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Opinion" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Draft" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ResearchRun" ALTER COLUMN "userId" SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS "Topic_userId_idx" ON "Topic" ("userId");
CREATE INDEX IF NOT EXISTS "Opinion_userId_idx" ON "Opinion" ("userId");
CREATE INDEX IF NOT EXISTS "Draft_userId_idx" ON "Draft" ("userId");
CREATE INDEX IF NOT EXISTS "ResearchRun_userId_idx" ON "ResearchRun" ("userId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "Topic"
    ADD CONSTRAINT "Topic_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Opinion"
    ADD CONSTRAINT "Opinion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Draft"
    ADD CONSTRAINT "Draft_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ResearchRun"
    ADD CONSTRAINT "ResearchRun_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AI action audit trail
CREATE TABLE IF NOT EXISTS "AiActionLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "topicId" UUID,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiActionLog_userId_idx" ON "AiActionLog" ("userId");
CREATE INDEX IF NOT EXISTS "AiActionLog_action_idx" ON "AiActionLog" ("action");

DO $$ BEGIN
  ALTER TABLE "AiActionLog"
    ADD CONSTRAINT "AiActionLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

