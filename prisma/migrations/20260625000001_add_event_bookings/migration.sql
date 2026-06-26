-- CreateEnum
CREATE TYPE "EventBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "event_date_slots" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_date_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_bookings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "passengerCount" INTEGER NOT NULL DEFAULT 1,
    "status" "EventBookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_booking_slots" (
    "id" TEXT NOT NULL,
    "eventBookingId" TEXT NOT NULL,
    "eventDateSlotId" TEXT NOT NULL,

    CONSTRAINT "event_booking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_date_slots_eventId_date_key" ON "event_date_slots"("eventId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "event_booking_slots_eventBookingId_eventDateSlotId_key" ON "event_booking_slots"("eventBookingId", "eventDateSlotId");

-- AddForeignKey
ALTER TABLE "event_date_slots" ADD CONSTRAINT "event_date_slots_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_booking_slots" ADD CONSTRAINT "event_booking_slots_eventBookingId_fkey" FOREIGN KEY ("eventBookingId") REFERENCES "event_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_booking_slots" ADD CONSTRAINT "event_booking_slots_eventDateSlotId_fkey" FOREIGN KEY ("eventDateSlotId") REFERENCES "event_date_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
