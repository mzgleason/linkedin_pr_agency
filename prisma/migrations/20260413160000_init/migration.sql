-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'REVIEW', 'READY', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ResearchRunStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS "Topic" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TopicSource" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "topicId" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "sourceType" TEXT,
  "title" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TopicSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Opinion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "topicId" UUID NOT NULL,
  "stance" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Opinion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Draft" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "topicId" UUID NOT NULL,
  "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResearchRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "topicId" UUID,
  "status" "ResearchRunStatus" NOT NULL DEFAULT 'STARTED',
  "input" JSONB,
  "output" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- Indexes / constraints
CREATE INDEX IF NOT EXISTS "TopicSource_topicId_idx" ON "TopicSource" ("topicId");
CREATE UNIQUE INDEX IF NOT EXISTS "TopicSource_topicId_url_key" ON "TopicSource" ("topicId", "url");
CREATE INDEX IF NOT EXISTS "Opinion_topicId_idx" ON "Opinion" ("topicId");
CREATE INDEX IF NOT EXISTS "Draft_topicId_idx" ON "Draft" ("topicId");
CREATE INDEX IF NOT EXISTS "ResearchRun_topicId_idx" ON "ResearchRun" ("topicId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "TopicSource"
    ADD CONSTRAINT "TopicSource_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Opinion"
    ADD CONSTRAINT "Opinion_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Draft"
    ADD CONSTRAINT "Draft_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ResearchRun"
    ADD CONSTRAINT "ResearchRun_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

