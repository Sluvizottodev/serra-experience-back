-- Migration: add VehicleStatus enum, birthDate/address fields, make vehicle fields nullable
-- Applied manually to Supabase on 2026-06-09 (bank uses camelCase — created via db push, not migrations)

DO $$ BEGIN
  CREATE TYPE "VehicleStatus" AS ENUM ('PENDING', 'APPROVED', 'REVIEW_PENDING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "vehicleStatus" "VehicleStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "birthDate"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "address"       TEXT;

ALTER TABLE "driver_profiles"
  ALTER COLUMN "vehicleMake"     DROP NOT NULL,
  ALTER COLUMN "vehicleModel"    DROP NOT NULL,
  ALTER COLUMN "vehicleYear"     DROP NOT NULL,
  ALTER COLUMN "vehiclePlate"    DROP NOT NULL,
  ALTER COLUMN "vehicleColor"    DROP NOT NULL,
  ALTER COLUMN "vehicleCapacity" DROP NOT NULL,
  ALTER COLUMN "licenseNumber"   DROP NOT NULL,
  ALTER COLUMN "licenseExpiry"   DROP NOT NULL,
  ALTER COLUMN "baseRatePerKm"   DROP NOT NULL,
  ALTER COLUMN "baseRatePerHour" DROP NOT NULL;
