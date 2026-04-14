-- MZG-35 Opinion fast capture fields

ALTER TABLE "Opinion" ADD COLUMN IF NOT EXISTS "coreTake" TEXT;
ALTER TABLE "Opinion" ADD COLUMN IF NOT EXISTS "whatPeopleMiss" TEXT;
ALTER TABLE "Opinion" ADD COLUMN IF NOT EXISTS "realWorldExample" TEXT;

UPDATE "Opinion" SET "coreTake" = "content" WHERE "coreTake" IS NULL;

ALTER TABLE "Opinion" ALTER COLUMN "coreTake" SET NOT NULL;
