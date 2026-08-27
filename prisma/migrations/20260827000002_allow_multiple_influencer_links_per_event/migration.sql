-- Permite múltiplos links de rastreamento por influenciador+evento
-- (cada clique em "gerar link" cria um novo código, ex: -2, -3, via uniqueCode)
DROP INDEX "influencer_event_links_influencerId_eventId_key";

-- CreateIndex (não-único, mantém performance de lookup pelo par)
CREATE INDEX "influencer_event_links_influencerId_eventId_idx" ON "influencer_event_links"("influencerId", "eventId");
