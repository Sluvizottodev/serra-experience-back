import { prisma } from '../../common/config/prisma'
import { cloudinary } from '../../common/config/cloudinary'
import { AppError } from '../../common/middlewares/error.middleware'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
import type { CreateDriverProfileInput, UpdateDriverProfileInput, AvailabilityInput } from './driver.schema'

const driverSelect = {
  id: true,
  bio: true,
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
  async listDrivers(query: { date?: string; capacity?: string; page?: string; limit?: string }) {
    const page = Number(query.page) || 1
    const limit = Number(query.limit) || 10
    const { take, skip } = getPaginationParams(page, limit)

    const where: Record<string, unknown> = { isApproved: true, isAvailable: true }
    if (query.capacity) {
      where.vehicleCapacity = { gte: Number(query.capacity) }
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

    return prisma.driverProfile.create({
      data: {
        ...data,
        userId,
        licenseExpiry: new Date(data.licenseExpiry),
      },
    })
  }

  async updateProfile(userId: string, data: UpdateDriverProfileInput) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    const updateData: Record<string, unknown> = { ...data }
    if (data.licenseExpiry) updateData.licenseExpiry = new Date(data.licenseExpiry)

    return prisma.driverProfile.update({ where: { userId }, data: updateData })
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
}
