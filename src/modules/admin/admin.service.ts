import bcrypt from 'bcrypt'
import { prisma } from '../../common/config/prisma'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
import { AppError } from '../../common/middlewares/error.middleware'
import { PaymentLogStatus } from '@prisma/client'

export class AdminService {
  async createAdmin(data: { name: string; email: string; password: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new AppError(409, 'Este e-mail já está em uso.')

    const hashed = await bcrypt.hash(data.password, 12)
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: 'ADMIN',
        isVerified: true,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return user
  }

  async listUsers(page = 1, limit = 20) {
    const { take, skip } = getPaginationParams(page, limit)
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isVerified: true,
          idStatus: true,
          isLocked: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.user.count(),
    ])
    return { users, meta: buildPaginationMeta(total, page, take) }
  }

  async verifyUserDocument(userId: string, action: 'APPROVED' | 'REJECTED') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, idStatus: true } })
    if (!user) throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 })
    if (user.idStatus === action) {
      return prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, idStatus: true } })
    }
    return prisma.user.update({
      where: { id: userId },
      data: { idStatus: action },
      select: { id: true, name: true, email: true, idStatus: true },
    })
  }

  async listDrivers(approved?: boolean, page = 1, limit = 20) {
    const { take, skip } = getPaginationParams(page, limit)
    const where = approved !== undefined ? { isApproved: approved } : {}

    const [drivers, total] = await Promise.all([
      prisma.driverProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, idStatus: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.driverProfile.count({ where }),
    ])
    return { drivers, meta: buildPaginationMeta(total, page, take) }
  }

  async approveDriver(driverProfileId: string, approved: boolean) {
    const driver = await prisma.driverProfile.findUnique({ where: { id: driverProfileId }, select: { id: true, isApproved: true } })
    if (!driver) throw Object.assign(new Error('Motorista não encontrado'), { statusCode: 404 })
    if (driver.isApproved === approved) {
      return prisma.driverProfile.findUnique({
        where: { id: driverProfileId },
        select: { id: true, isApproved: true, user: { select: { name: true, email: true } } },
      })
    }
    return prisma.driverProfile.update({
      where: { id: driverProfileId },
      data: { isApproved: approved },
      select: { id: true, isApproved: true, user: { select: { name: true, email: true } } },
    })
  }

  async getSettings() {
    return prisma.settings.upsert({
      where: { id: 1 },
      create: {},
      update: {},
    })
  }

  async updateSettings(data: {
    siteName?: string
    contactEmail?: string
    phone?: string
    whatsapp?: string
    address?: string
    commissionRate?: number
    timezone?: string
    baseAddress?: string | null
    baseLat?: number | null
    baseLng?: number | null
  }) {
    return prisma.settings.upsert({
      where: { id: 1 },
      create: { ...data },
      update: { ...data },
    })
  }

  async getPaymentLogs(page = 1, limit = 50) {
    const { take, skip } = getPaginationParams(page, limit)
    const [logs, total] = await Promise.all([
      prisma.paymentLog.findMany({ orderBy: { createdAt: 'desc' }, take, skip }),
      prisma.paymentLog.count(),
    ])
    return { logs, meta: buildPaginationMeta(total, page, take) }
  }

  async listReviews(page = 1, limit = 20, visible?: boolean) {
    const { take, skip } = getPaginationParams(page, limit)
    const where = visible !== undefined ? { isVisible: visible } : {}
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, email: true } },
          driverProfile: { select: { id: true, user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.review.count({ where }),
    ])
    return { reviews, meta: buildPaginationMeta(total, page, take) }
  }

  async updateReviewVisibility(reviewId: string, isVisible: boolean) {
    return prisma.review.update({
      where: { id: reviewId },
      data: { isVisible },
      select: { id: true, isVisible: true },
    })
  }

  async updateReviewComment(reviewId: string, comment: string | null) {
    return prisma.review.update({
      where: { id: reviewId },
      data: { comment: comment ?? null },
      select: { id: true, comment: true },
    })
  }

  async deleteReview(reviewId: string): Promise<boolean> {
    const exists = await prisma.review.findUnique({ where: { id: reviewId }, select: { id: true } })
    if (!exists) return false
    await prisma.review.delete({ where: { id: reviewId } })
    return true
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return false
    await prisma.user.delete({ where: { id: userId } })
    return true
  }

  async listAdminTrips(page = 1, limit = 10, status?: string, search?: string) {
    const { take, skip } = getPaginationParams(page, limit)
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { originAddress: { contains: search, mode: 'insensitive' } },
        { destinationAddress: { contains: search, mode: 'insensitive' } },
        { passenger: { name: { contains: search, mode: 'insensitive' } } },
        { driverProfile: { user: { name: { contains: search, mode: 'insensitive' } } } },
      ]
    }
    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: {
          passenger: { select: { name: true } },
          driverProfile: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.trip.count({ where }),
    ])
    return { trips, total, meta: buildPaginationMeta(total, page, take) }
  }

  async listQuotes(page = 1, limit = 20, status?: string) {
    const { take, skip } = getPaginationParams(page, limit)
    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: {
          passenger: { select: { id: true, name: true, email: true, phone: true } },
          driverProfile: { select: { id: true, vehicleMake: true, vehicleModel: true, user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.quote.count({ where }),
    ])
    return { quotes, meta: buildPaginationMeta(total, page, take) }
  }

  async getDashboardStats() {
    const [totalUsers, totalDrivers, totalTrips, totalRevenue] = await Promise.all([
      prisma.user.count(),
      prisma.driverProfile.count(),
      prisma.trip.count(),
      prisma.payment.aggregate({ where: { status: PaymentLogStatus.PAID }, _sum: { amount: true } }),
    ])

    const tripsByStatus = await prisma.trip.groupBy({
      by: ['status'],
      _count: true,
    })

    return {
      totalUsers,
      totalDrivers,
      totalTrips,
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      tripsByStatus,
    }
  }
}
