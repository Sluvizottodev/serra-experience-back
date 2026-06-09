-- Migration: add VehicleStatus enum, birthDate/address fields, make vehicle fields nullable
-- Safe for production: only additive (new columns + removed NOT NULL constraints, no data loss)

-- 1. Create enum type (skip if already exists — idempotent re-runs)
DO $$ BEGIN
  CREATE TYPE "VehicleStatus" AS ENUM ('PENDING', 'APPROVED', 'REVIEW_PENDING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns (IF NOT EXISTS — safe to re-run)
ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "vehicle_status" "VehicleStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "birth_date"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "address"        TEXT;

-- 3. Make vehicle fields nullable (no data loss — existing rows keep their values)
ALTER TABLE "driver_profiles"
  ALTER COLUMN "vehicle_make"       DROP NOT NULL,
  ALTER COLUMN "vehicle_model"      DROP NOT NULL,
  ALTER COLUMN "vehicle_year"       DROP NOT NULL,
  ALTER COLUMN "vehicle_plate"      DROP NOT NULL,
  ALTER COLUMN "vehicle_color"      DROP NOT NULL,
  ALTER COLUMN "vehicle_capacity"   DROP NOT NULL,
  ALTER COLUMN "license_number"     DROP NOT NULL,
  ALTER COLUMN "license_expiry"     DROP NOT NULL,
  ALTER COLUMN "base_rate_per_km"   DROP NOT NULL,
  ALTER COLUMN "base_rate_per_hour" DROP NOT NULL;
