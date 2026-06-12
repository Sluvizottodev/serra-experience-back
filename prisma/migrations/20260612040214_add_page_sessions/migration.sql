CREATE TABLE "page_sessions" (
    "id"               TEXT NOT NULL,
    "visitorId"        TEXT NOT NULL,
    "enteredAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt"         TIMESTAMP(3),
    "durationSeconds"  INTEGER,

    CONSTRAINT "page_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_sessions_visitorId_idx" ON "page_sessions"("visitorId");
CREATE INDEX "page_sessions_enteredAt_idx" ON "page_sessions"("enteredAt");
