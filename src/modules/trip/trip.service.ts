import { prisma } from '../../common/config/prisma'
import { AppError } from '../../common/middlewares/error.middleware'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
import { sendMail } from '../../common/config/mailer'
import { notifyAdmins } from '../../common/utils/notify-admins'
import { isLicenseExpired, LICENSE_EXPIRED_MESSAGE } from '../../common/utils/license'
import { tplViagemCancelada, tplNovaAvaliacao, tplViagemConfirmadaPassageiro, tplViagemConcluidaPassageiro, tplLembreteViagemMotorista, tplViagemRecusada } from '../../common/utils/email.templates'
import { enqueueNotification } from '../../common/config/queue'
import type { UpdateTripStatusInput, CancelTripInput, ReviewInput } from './trip.schema'

const tripInclude = {
  passenger: { select: { id: true, name: true, phone: true, avatarUrl: true } },
  driverProfile: {
    select: {
      id: true,
      vehicleMake: true,
      vehicleModel: true,
      vehiclePlate: true,
      vehicleColor: true,
      baseRatePerKm: true,
      user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
    },
  },
  payment: true,
  review: true,
}

export class TripService {
  async getMyTrips(userId: string, role: string, page = 1, limit = 10) {
    const { take, skip } = getPaginationParams(page, limit)

    let where: Record<string, unknown>
    if (role === 'PASSENGER') {
      where = { passengerId: userId }
    } else if (role === 'DRIVER') {
      const profile = await prisma.driverProfile.findUnique({ where: { userId } })
      if (!profile) return { trips: [], meta: buildPaginationMeta(0, page, take) }
      where = { driverProfileId: profile.id }
    } else {
      where = {}
    }

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({ where, include: tripInclude, orderBy: { scheduledAt: 'desc' }, take, skip }),
      prisma.trip.count({ where }),
    ])

    return { trips, meta: buildPaginationMeta(total, page, take) }
  }

  async getTrip(id: string, userId: string, role: string) {
    const trip = await prisma.trip.findUnique({ where: { id }, include: tripInclude })
    if (!trip) throw new AppError(404, 'Viagem não encontrada')

    if (role !== 'ADMIN') {
      const isPassenger = trip.passengerId === userId
      const isDriver = trip.driverProfile.user.id === userId
      if (!isPassenger && !isDriver) throw new AppError(403, 'Acesso negado')
    }

    return trip
  }

  async updateTripStatus(tripId: string, userId: string, data: UpdateTripStatusInput) {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true, email: true } } },
    })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        passenger: { select: { name: true, email: true } },
      },
    })
    if (!trip) throw new AppError(404, 'Viagem não encontrada')
    if (trip.driverProfileId !== profile.id) throw new AppError(403, 'Acesso negado')

    const validTransitions: Record<string, string[]> = {
      PENDING:     ['CONFIRMED', 'CANCELLED'],
      CONFIRMED:   ['IN_PROGRESS'],
      IN_PROGRESS: ['COMPLETED'],
    }

    if (!validTransitions[trip.status]?.includes(data.status)) {
      throw new AppError(400, `Transição inválida: ${trip.status} → ${data.status}`)
    }

    // Motorista com CNH vencida não pode aceitar/iniciar viagem (mas pode recusar/cancelar)
    if (
      (data.status === 'CONFIRMED' || data.status === 'IN_PROGRESS') &&
      isLicenseExpired(profile.licenseExpiry)
    ) {
      throw new AppError(403, LICENSE_EXPIRED_MESSAGE)
    }

    // Motorista recusou viagem encaminhada → notificar admin por email
    if (data.status === 'CANCELLED' && trip.status === 'PENDING') {
      const updatedTrip = await prisma.$transaction(async (tx) => {
        const cancelled = await tx.trip.update({
          where: { id: tripId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelReason: data.cancelReason ?? 'Recusado pelo motorista',
          },
        })

        // Volta o Quote para OPEN para que o admin possa redirecionar
        if (trip.quoteId) {
          await tx.quote.update({
            where: { id: trip.quoteId },
            data: { status: 'OPEN', driverProfileId: null, assignToken: null, assignExpiresAt: null },
          })
        }

        return cancelled
      })

      // Email assíncrono para o admin — não bloqueia a resposta
      this.notifyAdminOfRejection(trip, profile.user.name, data.cancelReason).catch(() => {})

      return updatedTrip
    }

    if (data.status === 'COMPLETED') {
      await prisma.driverProfile.update({
        where: { id: profile.id },
        data: { totalTrips: { increment: 1 } },
      })
    }

    const updatedTrip = await prisma.trip.update({ where: { id: tripId }, data: { status: data.status } })

    if (data.status === 'CONFIRMED') {
      const vehicleInfo = [profile.vehicleMake, profile.vehicleModel, profile.vehiclePlate].filter(Boolean).join(' ')
      const { subject, html } = tplViagemConfirmadaPassageiro({
        passengerName: trip.passenger.name,
        tripId: updatedTrip.id,
        driverName: profile.user.name,
        vehicleInfo: vehicleInfo || 'Não informado',
        origin: trip.originAddress,
        destination: trip.destinationAddress,
        scheduledAt: trip.scheduledAt,
      })
      enqueueNotification({ to: trip.passenger.email, subject, html }).catch(() => {})

      this.scheduleDriverReminders(updatedTrip.id, trip.scheduledAt, {
        driverName: profile.user.name,
        driverEmail: profile.user.email,
        passengerName: trip.passenger.name,
        origin: trip.originAddress,
        destination: trip.destinationAddress,
      }).catch(err => console.error('Falha ao agendar lembretes de viagem:', err))
    }

    if (data.status === 'COMPLETED') {
      const { subject, html } = tplViagemConcluidaPassageiro({
        passengerName: trip.passenger.name,
        tripId: updatedTrip.id,
        driverName: profile.user.name,
      })
      enqueueNotification({ to: trip.passenger.email, subject, html }).catch(() => {})
    }

    return updatedTrip
  }

  // Constrói o instante correspondente a `HH:00` no horário de Brasília, no dia anterior a `date`.
  // Necessário porque o servidor roda em UTC (Vercel) e Date.setHours usaria o timezone do servidor.
  private static brasiliaHourBeforeDate(date: Date, hour: number): Date {
    const dayBefore = new Date(date.getTime() - 24 * 60 * 60 * 1000)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(dayBefore)
    const y = parts.find(p => p.type === 'year')!.value
    const m = parts.find(p => p.type === 'month')!.value
    const d = parts.find(p => p.type === 'day')!.value

    // America/Sao_Paulo não usa horário de verão desde 2019 — offset fixo UTC-3.
    return new Date(`${y}-${m}-${d}T${String(hour).padStart(2, '0')}:00:00-03:00`)
  }

  // Agenda os dois lembretes de viagem para o motorista: véspera às 18h (horário de Brasília)
  // e 1h antes do horário agendado. Lembretes cujo horário já passou são pulados.
  private async scheduleDriverReminders(
    tripId: string,
    scheduledAt: Date,
    info: { driverName: string; driverEmail: string; passengerName: string; origin: string; destination: string },
  ) {
    const now = Date.now()

    const vesperaAt = TripService.brasiliaHourBeforeDate(scheduledAt, 18)
    const umaHoraAntesAt = new Date(scheduledAt.getTime() - 60 * 60 * 1000)

    const reminders: Array<{ at: Date; when: 'VESPERA' | 'UMA_HORA' }> = [
      { at: vesperaAt, when: 'VESPERA' },
      { at: umaHoraAntesAt, when: 'UMA_HORA' },
    ]

    const jobs = reminders
      .filter(reminder => reminder.at.getTime() > now)
      .map(reminder => {
        const { subject, html } = tplLembreteViagemMotorista({
          tripId,
          driverName: info.driverName,
          passengerName: info.passengerName,
          origin: info.origin,
          destination: info.destination,
          scheduledAt,
          when: reminder.when,
        })

        return enqueueNotification(
          {
            to: info.driverEmail,
            subject,
            html,
            guardTripId: tripId,
            guardStatus: 'CONFIRMED',
          },
          Math.floor(reminder.at.getTime() / 1000),
        )
      })

    await Promise.all(jobs)
  }

  private async notifyAdminOfRejection(
    trip: { id: string; originAddress: string; destinationAddress: string; scheduledAt: Date; passenger: { name: string } },
    driverName: string,
    reason?: string,
  ) {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!admin) return

    const scheduled = new Date(trip.scheduledAt)
    const { subject, html } = tplViagemRecusada({
      driverName,
      passengerName: trip.passenger.name,
      origin: trip.originAddress,
      destination: trip.destinationAddress,
      scheduledAt: scheduled,
      reason,
    })
    await sendMail(admin.email, subject, html)
  }

  async cancelTrip(tripId: string, userId: string, role: string, data: CancelTripInput) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        passenger: { select: { name: true } },
        driverProfile: { include: { user: { select: { id: true, name: true } } } },
      },
    })
    if (!trip) throw new AppError(404, 'Viagem não encontrada')

    const isPassenger = trip.passengerId === userId
    const isDriverUser = trip.driverProfile.user.id === userId
    if (!isPassenger && !isDriverUser && role !== 'ADMIN') throw new AppError(403, 'Acesso negado')

    if (['COMPLETED', 'CANCELLED'].includes(trip.status)) {
      throw new AppError(400, 'Esta viagem não pode ser cancelada')
    }

    let cancelledBy: 'PASSENGER' | 'DRIVER' | 'ADMIN'
    if (role === 'ADMIN') cancelledBy = 'ADMIN'
    else if (isPassenger) cancelledBy = 'PASSENGER'
    else cancelledBy = 'DRIVER'

    const updateData: Record<string, unknown> = {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: data.cancelReason,
    }

    if (trip.paymentStatus === 'PAID') {
      updateData.paymentStatus = 'REFUNDED'
    }

    const updated = await prisma.trip.update({ where: { id: tripId }, data: updateData })

    const { subject, html } = tplViagemCancelada({
      tripId,
      cancelledBy,
      passengerName: trip.passenger?.name ?? 'Passageiro',
      driverName: trip.driverProfile.user.name,
      origin: trip.originAddress,
      destination: trip.destinationAddress,
      scheduledAt: trip.scheduledAt,
      cancelReason: data.cancelReason ?? null,
      hadPayment: trip.paymentStatus === 'PAID',
    })
    notifyAdmins(subject, html).catch(() => {})

    return updated
  }

  async reviewTrip(tripId: string, passengerId: string, data: ReviewInput) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        passenger: { select: { name: true } },
        driverProfile: { include: { user: { select: { name: true, email: true } } } },
      },
    })
    if (!trip) throw new AppError(404, 'Viagem não encontrada')
    if (trip.passengerId !== passengerId) throw new AppError(403, 'Acesso negado')
    if (trip.status !== 'COMPLETED') throw new AppError(400, 'Apenas viagens concluídas podem ser avaliadas')

    const existing = await prisma.review.findUnique({ where: { tripId } })
    if (existing) throw new AppError(409, 'Viagem já foi avaliada')

    const review = await prisma.review.create({
      data: {
        tripId,
        authorId: passengerId,
        driverProfileId: trip.driverProfileId,
        rating: data.rating,
        comment: data.comment,
      },
    })

    const agg = await prisma.review.aggregate({
      where: { driverProfileId: trip.driverProfileId },
      _avg: { rating: true },
    })

    const newAverage = agg._avg.rating || 0
    await prisma.driverProfile.update({
      where: { id: trip.driverProfileId },
      data: { rating: newAverage },
    })

    const { subject, html } = tplNovaAvaliacao({
      driverName: trip.driverProfile.user.name,
      passengerName: trip.passenger?.name ?? 'Passageiro',
      rating: data.rating,
      comment: data.comment ?? null,
      newAverage,
    })
    sendMail(trip.driverProfile.user.email, subject, html).catch(() => {})

    return review
  }
}
