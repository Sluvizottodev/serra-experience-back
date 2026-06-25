-- AlterTable: add configurable expiry (in hours) for driver open-assignment links
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "assignLinkExpiryHours" INTEGER NOT NULL DEFAULT 24;
