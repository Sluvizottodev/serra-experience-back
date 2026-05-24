-- Migration: add slug to events
-- Safe migration: adds column as nullable, fills data, then adds NOT NULL + UNIQUE

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Fill slug from title for existing rows
UPDATE "events"
SET "slug" = lower(
  regexp_replace(
    regexp_replace(
      translate("title",
        'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
        'aaaaaaeeeeiiiiooooouuuucAAAAAAAAEEEEIIIIOOOOOUUUUC'
      ),
    '[^a-zA-Z0-9\s-]', '', 'g'),
  '\s+', '-', 'g'))
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "events" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "events" ADD CONSTRAINT "events_slug_key" UNIQUE ("slug");
