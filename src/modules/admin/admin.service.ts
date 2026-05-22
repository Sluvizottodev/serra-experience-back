import { prisma } from '../../common/config/prisma'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'

export class AdminService {
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

  async getDashboardStats() {
    const [totalUsers, totalDrivers, totalTrips, totalRevenue] = await Promise.all([
      prisma.user.count(),
      prisma.driverProfile.count(),
      prisma.trip.count(),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
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
