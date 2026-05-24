-- Drop existing foreign key constraints and recreate with ON DELETE CASCADE

-- trips.passengerId -> users.id
ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "trips_passengerId_fkey";
ALTER TABLE "trips" ADD CONSTRAINT "trips_passengerId_fkey"
  FOREIGN KEY ("passengerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- quotes.passengerId -> users.id
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_passengerId_fkey";
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_passengerId_fkey"
  FOREIGN KEY ("passengerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- reviews.authorId -> users.id
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_authorId_fkey";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- reviews.tripId -> trips.id
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_tripId_fkey";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- messages.senderId -> users.id
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_senderId_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- payments.tripId -> trips.id
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_tripId_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
