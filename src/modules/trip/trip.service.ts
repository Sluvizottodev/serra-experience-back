import { prisma } from '../../common/config/prisma'
import { AppError } from '../../common/middlewares/error.middleware'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
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
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    const trip = await prisma.trip.findUnique({ where: { id: tripId } })
    if (!trip) throw new AppError(404, 'Viagem não encontrada')
    if (trip.driverProfileId !== profile.id) throw new AppError(403, 'Acesso negado')

    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED'],
      CONFIRMED: ['IN_PROGRESS'],
      IN_PROGRESS: ['COMPLETED'],
    }

    if (!validTransitions[trip.status]?.includes(data.status)) {
      throw new AppError(400, `Transição inválida: ${trip.status} → ${data.status}`)
    }

    const updateData: Record<string, unknown> = { status: data.status }
    if (data.status === 'COMPLETED') {
      await prisma.driverProfile.update({
        where: { id: profile.id },
        data: { totalTrips: { increment: 1 } },
      })
    }

    return prisma.trip.update({ where: { id: tripId }, data: updateData })
  }

  async cancelTrip(tripId: string, userId: string, role: string, data: CancelTripInput) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { driverProfile: { include: { user: true } } } })
    if (!trip) throw new AppError(404, 'Viagem não encontrada')

    const isPassenger = trip.passengerId === userId
    const isDriverUser = trip.driverProfile.user.id === userId
    if (!isPassenger && !isDriverUser && role !== 'ADMIN') throw new AppError(403, 'Acesso negado')

    if (['COMPLETED', 'CANCELLED'].includes(trip.status)) {
      throw new AppError(400, 'Esta viagem não pode ser cancelada')
    }

    const updateData: Record<string, unknown> = {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: data.cancelReason,
    }

    if (trip.paymentStatus === 'PAID') {
      updateData.paymentStatus = 'REFUNDED'
    }

    return prisma.trip.update({ where: { id: tripId }, data: updateData })
  }

  async reviewTrip(tripId: string, passengerId: string, data: ReviewInput) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } })
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

    // Recalculate driver rating
    const reviews = await prisma.review.aggregate({
      where: { driverProfileId: trip.driverProfileId },
      _avg: { rating: true },
    })

    await prisma.driverProfile.update({
      where: { id: trip.driverProfileId },
      data: { rating: reviews._avg.rating || 0 },
    })

    return review
  }
}
