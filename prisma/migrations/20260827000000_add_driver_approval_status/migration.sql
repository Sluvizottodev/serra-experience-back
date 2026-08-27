-- CreateEnum: tri-state driver approval (adds REJECTED, distinct from never-reviewed PENDING)
CREATE TYPE "DriverApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "driver_profiles" ADD COLUMN "approvalStatus" "DriverApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill: keep in sync with the existing isApproved flag (no historical data to recover REJECTED from)
UPDATE "driver_profiles" SET "approvalStatus" = 'APPROVED' WHERE "isApproved" = true;
