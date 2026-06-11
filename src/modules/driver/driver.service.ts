import { prisma } from '../../common/config/prisma'
import { cloudinary } from '../../common/config/cloudinary'
import { AppError } from '../../common/middlewares/error.middleware'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
import { notifyAdmins } from '../../common/utils/notify-admins'
import { tplVeiculoEmRevisao } from '../../common/utils/email.templates'
import type { CreateDriverProfileInput, UpdateDriverProfileInput, AvailabilityInput } from './driver.schema'

const VEHICLE_FIELDS = [
  'vehicleMake', 'vehicleModel', 'vehicleYear', 'vehiclePlate',
  'vehicleColor', 'vehicleCapacity', 'licenseNumber', 'licenseExpiry',
  'baseRatePerKm', 'baseRatePerHour',
] as const

const driverSelect = {
  id: true,
  bio: true,
  birthDate: true,
  address: true,
  vehicleStatus: true,
  vehicleMake: true,
  vehicleModel: true,
  vehicleYear: true,
  vehiclePlate: true,
  vehicleColor: true,
  vehicleCapacity: true,
  rating: true,
  totalTrips: true,
  isAvailable: true,
  isApproved: true,
  baseRatePerKm: true,
  baseRatePerHour: true,
  vehiclePhotoUrl: true,
  user: {
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
  },
}

export class DriverService {
  async listDrivers(query: { date?: string; capacity?: string; search?: string; available?: string; ids?: string; page?: string; limit?: string }) {
    const page = Number(query.page) || 1
    const limit = Number(query.limit) || 10
    const { take, skip } = getPaginationParams(page, limit)

    const where: Record<string, unknown> = { isApproved: true }

    if (query.ids) {
      where.id = { in: query.ids.split(',').filter(Boolean) }
    }

    if (query.available === 'true') {
      where.isAvailable = true
    }

    const andConditions: Record<string, unknown>[] = []

    if (query.search) {
      andConditions.push({
        OR: [
          { user: { name: { contains: query.search, mode: 'insensitive' } } },
          { vehicleMake: { contains: query.search, mode: 'insensitive' } },
          { vehicleModel: { contains: query.search, mode: 'insensitive' } },
        ],
      })
    }

    if (query.capacity) {
      where.vehicleCapacity = { gte: Number(query.capacity) }
    }

    if (query.date) {
      const day = new Date(query.date)
      day.setUTCHours(0, 0, 0, 0)
      const nextDay = new Date(day)
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)

      andConditions.push({
        OR: [
          {
            availabilities: {
              some: {
                date: { gte: day, lt: nextDay },
                isAvailable: true,
              },
            },
          },
          { availabilities: { none: {} } },
        ],
      })
    }

    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    const [drivers, total] = await Promise.all([
      prisma.driverProfile.findMany({
        where,
        select: driverSelect,
        orderBy: { rating: 'desc' },
        take,
        skip,
      }),
      prisma.driverProfile.count({ where }),
    ])

    return { drivers, meta: buildPaginationMeta(total, page, take) }
  }

  async getDriver(id: string) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      select: {
        ...driverSelect,
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })
    if (!driver) throw new AppError(404, 'Motorista não encontrado')
    return driver
  }

  async createProfile(userId: string, data: CreateDriverProfileInput) {
    const existing = await prisma.driverProfile.findUnique({ where: { userId } })
    if (existing) throw new AppError(409, 'Você já possui um perfil de motorista')

    const createData: Record<string, unknown> = {
      ...data,
      userId,
      vehicleStatus: 'PENDING',
    }
    if (data.birthDate) createData.birthDate = new Date(data.birthDate)
    if (data.licenseExpiry) createData.licenseExpiry = new Date(data.licenseExpiry)

    return prisma.driverProfile.create({ data: createData as any })
  }

  async updateProfile(userId: string, data: UpdateDriverProfileInput) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    const updateData: Record<string, unknown> = { ...data }
    if (data.birthDate) updateData.birthDate = new Date(data.birthDate)
    if (data.licenseExpiry) updateData.licenseExpiry = new Date(data.licenseExpiry)

    // Se o motorista já está aprovado e está alterando dados do veículo,
    // marca para revisão (não bloqueia corridas, apenas sinaliza ao admin)
    const vehicleFieldChanged = VEHICLE_FIELDS.some(
      f => f in data && (data as any)[f] !== undefined
    )
    const goingToReview = profile.isApproved && vehicleFieldChanged && profile.vehicleStatus === 'APPROVED'
    if (goingToReview) {
      updateData.vehicleStatus = 'REVIEW_PENDING'
    }

    const updated = await prisma.driverProfile.update({
      where: { userId },
      data: updateData as any,
      include: { user: { select: { name: true, email: true } } },
    })

    if (goingToReview) {
      const changedFields = VEHICLE_FIELDS.filter(f => f in data && (data as any)[f] !== undefined)
      const { subject, html } = tplVeiculoEmRevisao({
        driverName: updated.user.name,
        driverEmail: updated.user.email,
        driverProfileId: updated.id,
        changedFields,
      })
      notifyAdmins(subject, html).catch(() => {})
    }

    return updated
  }

  async uploadVehiclePhoto(userId: string, fileBuffer: Buffer) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'viagem-motorista/vehicles', resource_type: 'image' },
        (err, res) => {
          if (err || !res) return reject(err)
          resolve(res as { secure_url: string })
        }
      )
      stream.end(fileBuffer)
    })

    await prisma.driverProfile.update({ where: { userId }, data: { vehiclePhotoUrl: result.secure_url } })
    return { vehiclePhotoUrl: result.secure_url }
  }

  async getMyAvailability(userId: string) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    return prisma.availability.findMany({
      where: { driverProfileId: profile.id },
      orderBy: { date: 'asc' },
    })
  }

  async addAvailability(userId: string, data: AvailabilityInput) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    return prisma.availability.create({
      data: { ...data, date: new Date(data.date), driverProfileId: profile.id },
    })
  }

  async updateAvailability(userId: string, availabilityId: string, data: Partial<AvailabilityInput>) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    const availability = await prisma.availability.findFirst({
      where: { id: availabilityId, driverProfileId: profile.id },
    })
    if (!availability) throw new AppError(404, 'Disponibilidade não encontrada')

    return prisma.availability.update({ where: { id: availabilityId }, data })
  }

  async deleteAvailability(userId: string, availabilityId: string) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    const availability = await prisma.availability.findFirst({
      where: { id: availabilityId, driverProfileId: profile.id },
    })
    if (!availability) throw new AppError(404, 'Disponibilidade não encontrada')

    await prisma.availability.delete({ where: { id: availabilityId } })
    return { message: 'Disponibilidade removida' }
  }

  async getFavorites(userId: string) {
    const rows = await prisma.favoriteDriver.findMany({
      where: { userId },
      select: {
        driverProfile: { select: driverSelect },
      },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(r => r.driverProfile)
  }

  async toggleFavorite(userId: string, driverProfileId: string) {
    const driver = await prisma.driverProfile.findUnique({ where: { id: driverProfileId } })
    if (!driver) throw new AppError(404, 'Motorista não encontrado')

    const existing = await prisma.favoriteDriver.findUnique({
      where: { userId_driverProfileId: { userId, driverProfileId } },
    })

    if (existing) {
      await prisma.favoriteDriver.delete({ where: { id: existing.id } })
      return { favorited: false }
    }

    await prisma.favoriteDriver.create({ data: { userId, driverProfileId } })
    return { favorited: true }
  }
}
