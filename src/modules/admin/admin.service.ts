import { prisma } from '../../common/config/prisma'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
import { PaymentLogStatus } from '@prisma/client'

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
    if (comment !== null && comment.length > 300) {
      throw new Error('Comentário não pode ultrapassar 300 caracteres')
    }
    return prisma.review.update({
      where: { id: reviewId },
      data: { comment: comment ?? null },
      select: { id: true, comment: true },
    })
  }

  async deleteReview(reviewId: string) {
    return prisma.review.delete({ where: { id: reviewId } })
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
