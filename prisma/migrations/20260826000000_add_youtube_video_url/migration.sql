-- AlterTable: optional YouTube video URL shown on the public home page
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "youtubeVideoUrl" TEXT;
