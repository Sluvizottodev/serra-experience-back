-- Migration: add end_date to events
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "end_date" TEXT;
