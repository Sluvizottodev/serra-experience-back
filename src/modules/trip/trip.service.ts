import { prisma } from '../../common/config/prisma'
import { AppError } from '../../common/middlewares/error.middleware'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
import { sendMail } from '../../common/config/mailer'
import { env } from '../../common/config/env'
import { notifyAdmins } from '../../common/utils/notify-admins'
import { tplViagemCancelada, tplNovaAvaliacao } from '../../common/utils/email.templates'
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
      include: { user: { select: { name: true } } },
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

    return prisma.trip.update({ where: { id: tripId }, data: { status: data.status } })
  }

  private async notifyAdminOfRejection(
    trip: { id: string; originAddress: string; destinationAddress: string; scheduledAt: Date; passenger: { name: string } },
    driverName: string,
    reason?: string,
  ) {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!admin) return

    const adminUrl = `${env.CORS_ORIGIN}/admin/quotes`
    const scheduled = new Date(trip.scheduledAt).toLocaleString('pt-BR', {
      dateStyle: 'short', timeStyle: 'short',
    } as Intl.DateTimeFormatOptions)

    await sendMail(
      admin.email,
      'Viagem recusada — ação necessária',
      `
        <h2 style="color:#a98549">Viagem recusada pelo motorista</h2>
        <p><strong>Motorista:</strong> ${driverName}</p>
        <p><strong>Passageiro:</strong> ${trip.passenger.name}</p>
        <p><strong>Rota:</strong> ${trip.originAddress} → ${trip.destinationAddress}</p>
        <p><strong>Horário agendado:</strong> ${scheduled}</p>
        ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ''}
        <p style="margin-top:20px">
          <a href="${adminUrl}" style="background:#a98549;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
            Gerenciar orçamentos
          </a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:16px">Serra Experience — Painel Administrativo</p>
      `
    )
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
