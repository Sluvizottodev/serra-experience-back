CREATE TABLE "pending_registrations" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"         TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "password"     TEXT NOT NULL,
  "phone"        TEXT,
  "cpf"          TEXT,
  "role"         "Role" NOT NULL DEFAULT 'PASSENGER',
  "otpCode"      TEXT NOT NULL,
  "otpExpiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_registrations_email_key" ON "pending_registrations"("email");

CREATE OR REPLACE FUNCTION update_pending_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pending_registrations_updated_at
  BEFORE UPDATE ON "pending_registrations"
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_registrations_updated_at();
