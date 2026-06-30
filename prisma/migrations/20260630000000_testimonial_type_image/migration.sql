-- CreateEnum
CREATE TYPE "TestimonialType" AS ENUM ('TEXT', 'IMAGE');

-- AlterTable
ALTER TABLE "testimonials"
  ADD COLUMN "type" "TestimonialType" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "image_public_id" TEXT,
  ALTER COLUMN "text" DROP NOT NULL;
