-- Alinha as tabelas novas de event-booking ao padrão de RLS do restante do schema
-- (RLS habilitado, sem políticas — acesso real é via conexão direta do backend, não PostgREST)
ALTER TABLE "public"."event_date_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_booking_slots" ENABLE ROW LEVEL SECURITY;
