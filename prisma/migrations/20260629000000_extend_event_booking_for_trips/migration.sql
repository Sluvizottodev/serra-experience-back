-- Estende event_bookings para funcionar como "viagem" na tela admin de Viagens:
-- pagamento (desacoplado do status de aprovação da reserva) e motorista opcional
-- (atribuído manualmente depois, como já ocorre com trips pendentes).
ALTER TABLE "event_bookings" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "event_bookings" ADD COLUMN "driverProfileId" TEXT;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
