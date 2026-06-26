import { prisma } from '../../common/config/prisma'
import { AppError } from '../../common/middlewares/error.middleware'
import type { UpsertDateSlotsInput, CreateBookingInput } from './event-booking.schema'

const PENDING_EXPIRY_HOURS = 6
const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED'] as const

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

export class EventBookingService {
  // Expira reservas PENDING vencidas antes de qualquer leitura/escrita de disponibilidade.
  private async expireStalePending(eventId: string) {
    await prisma.eventBooking.updateMany({
      where: { eventId, status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED', expiresAt: null },
    })
  }

  async getAvailability(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } })
    if (!event) throw new AppError(404, 'Evento não encontrado')

    await this.expireStalePending(eventId)

    const slots = await prisma.eventDateSlot.findMany({
      where: { eventId },
      include: {
        bookingSlots: {
          where: { eventBooking: { status: { in: [...ACTIVE_STATUSES] } } },
          include: { eventBooking: { select: { passengerCount: true } } },
        },
      },
      orderBy: { date: 'asc' },
    })

    return slots.map(slot => {
      const booked = slot.bookingSlots.reduce((sum, bs) => sum + bs.eventBooking.passengerCount, 0)
      return {
        id: slot.id,
        date: slot.date.toISOString().slice(0, 10),
        capacity: slot.capacity,
        booked,
        available: Math.max(0, slot.capacity - booked),
      }
    })
  }

  async upsertDateSlots(eventId: string, data: UpsertDateSlotsInput) {
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) throw new AppError(404, 'Evento não encontrado')

    const minDate = event.date ? event.date.slice(0, 10) : null
    const maxDate = event.endDate ? event.endDate.slice(0, 10) : null

    for (const slot of data.slots) {
      if (minDate && slot.date < minDate) throw new AppError(400, `Data ${slot.date} está antes do início do evento`)
      if (maxDate && slot.date > maxDate) throw new AppError(400, `Data ${slot.date} está depois do término do evento`)
    }

    await prisma.$transaction(
      data.slots.map(slot =>
        prisma.eventDateSlot.upsert({
          where: { eventId_date: { eventId, date: toDateOnly(slot.date) } },
          create: { eventId, date: toDateOnly(slot.date), capacity: slot.capacity },
          update: { capacity: slot.capacity },
        })
      )
    )

    return this.getAvailability(eventId)
  }

  async createBooking(eventId: string, data: CreateBookingInput) {
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) throw new AppError(404, 'Evento não encontrado')

    await this.expireStalePending(eventId)

    const dates = [...new Set(data.dates)].map(toDateOnly)

    return prisma.$transaction(async (tx) => {
      const slots = await tx.eventDateSlot.findMany({
        where: { eventId, date: { in: dates } },
        include: {
          bookingSlots: {
            where: { eventBooking: { status: { in: [...ACTIVE_STATUSES] } } },
            include: { eventBooking: { select: { passengerCount: true } } },
          },
        },
      })

      if (slots.length !== dates.length) {
        throw new AppError(400, 'Uma ou mais datas selecionadas não estão disponíveis para este evento')
      }

      for (const slot of slots) {
        const booked = slot.bookingSlots.reduce((sum, bs) => sum + bs.eventBooking.passengerCount, 0)
        const available = slot.capacity - booked
        if (available < data.passengerCount) {
          throw new AppError(409, `Vagas insuficientes em ${slot.date.toISOString().slice(0, 10)}: restam ${available}`)
        }
      }

      const expiresAt = new Date(Date.now() + PENDING_EXPIRY_HOURS * 60 * 60 * 1000)

      const booking = await tx.eventBooking.create({
        data: {
          eventId,
          userId: data.userId,
          guestName: data.guestName,
          guestPhone: data.guestPhone,
          passengerCount: data.passengerCount,
          notes: data.notes,
          status: 'PENDING',
          expiresAt,
          slots: {
            create: slots.map(slot => ({ eventDateSlotId: slot.id })),
          },
        },
        include: { slots: { include: { eventDateSlot: true } } },
      })

      return booking
    })
  }

  async confirmBooking(id: string) {
    const booking = await prisma.eventBooking.findUnique({ where: { id } })
    if (!booking) throw new AppError(404, 'Reserva não encontrada')
    if (booking.status !== 'PENDING') throw new AppError(400, 'Apenas reservas pendentes podem ser confirmadas')

    return prisma.eventBooking.update({
      where: { id },
      data: { status: 'CONFIRMED', expiresAt: null },
    })
  }

  async cancelBooking(id: string) {
    const booking = await prisma.eventBooking.findUnique({ where: { id } })
    if (!booking) throw new AppError(404, 'Reserva não encontrada')
    if (booking.status === 'CANCELLED') throw new AppError(400, 'Esta reserva já está cancelada')

    return prisma.eventBooking.update({
      where: { id },
      data: { status: 'CANCELLED', expiresAt: null },
    })
  }

  async listBookings(eventId: string) {
    await this.expireStalePending(eventId)

    return prisma.eventBooking.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        slots: { include: { eventDateSlot: { select: { date: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
