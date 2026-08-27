-- CreateEnum
CREATE TYPE "TrackingEventType" AS ENUM ('VIEW', 'CONVERSION');

-- CreateTable
CREATE TABLE "influencers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_event_links" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "eventId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencer_event_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "type" "TrackingEventType" NOT NULL,
    "linkId" TEXT NOT NULL,
    "eventId" TEXT,
    "influencerId" TEXT NOT NULL,
    "visitorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "influencer_event_links_code_key" ON "influencer_event_links"("code");

-- CreateIndex
CREATE INDEX "influencer_event_links_eventId_idx" ON "influencer_event_links"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "influencer_event_links_influencerId_eventId_key" ON "influencer_event_links"("influencerId", "eventId");

-- CreateIndex
CREATE INDEX "tracking_events_linkId_idx" ON "tracking_events"("linkId");

-- CreateIndex
CREATE INDEX "tracking_events_eventId_idx" ON "tracking_events"("eventId");

-- CreateIndex
CREATE INDEX "tracking_events_influencerId_idx" ON "tracking_events"("influencerId");

-- CreateIndex
CREATE INDEX "tracking_events_createdAt_idx" ON "tracking_events"("createdAt");

-- CreateIndex
CREATE INDEX "tracking_events_type_linkId_idx" ON "tracking_events"("type", "linkId");

-- AddForeignKey
ALTER TABLE "influencer_event_links" ADD CONSTRAINT "influencer_event_links_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_event_links" ADD CONSTRAINT "influencer_event_links_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "influencer_event_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alinha as tabelas novas ao padrão de RLS do restante do schema
-- (RLS habilitado, sem políticas — acesso real é via conexão direta do backend, não PostgREST)
ALTER TABLE "public"."influencers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."influencer_event_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tracking_events" ENABLE ROW LEVEL SECURITY;
