-- AlterTable: add basePricePerKm to settings
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "basePricePerKm" DECIMAL(10,2);

-- AlterTable: make totalPrice nullable on trips (preço fixo só no checkout futuro)
ALTER TABLE "trips" ALTER COLUMN "totalPrice" DROP NOT NULL;
