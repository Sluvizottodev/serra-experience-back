import bcrypt from 'bcrypt'
import { prisma } from '../../common/config/prisma'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
import { AppError } from '../../common/middlewares/error.middleware'
import { PaymentLogStatus } from '@prisma/client'
import { decrypt } from '../../common/utils/crypto'
import { sendMail } from '../../common/config/mailer'
import { tplMotoristaAprovado } from '../../common/utils/email.templates'

type VehicleStatus = 'PENDING' | 'APPROVED' | 'REVIEW_PENDING'

type DriverProfileUpdateData = { isApproved?: boolean; vehicleStatus?: VehicleStatus }

function delta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

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

  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        role: true,
        isVerified: true,
        idStatus: true,
        isLocked: true,
        createdAt: true,
      },
    })
    if (!user) throw new AppError(404, 'Usuário não encontrado')
    return {
      ...user,
      cpf: user.cpf ? decrypt(user.cpf) : null,
    }
  }

  async toggleUserLock(userId: string, lock: boolean) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
    if (!user) throw new AppError(404, 'Usuário não encontrado')
    if (user.role === 'ADMIN') throw new AppError(400, 'Não é possível bloquear um administrador')
    return prisma.user.update({ where: { id: userId }, data: { isLocked: lock }, select: { id: true, isLocked: true } })
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

  async listDrivers(approved?: boolean, vehicleStatus?: string, page = 1, limit = 20) {
    const { take, skip } = getPaginationParams(page, limit)
    const where: Record<string, unknown> = {}
    if (approved !== undefined) where.isApproved = approved
    if (vehicleStatus) where.vehicleStatus = vehicleStatus

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

    const totalAll      = await prisma.driverProfile.count()
    const totalPending  = await prisma.driverProfile.count({ where: { isApproved: false } })
    const totalApproved = await prisma.driverProfile.count({ where: { isApproved: true } })
    // cast needed until TS server reloads after prisma generate
    const totalVehicleReview = await prisma.driverProfile.count({ where: { vehicleStatus: 'REVIEW_PENDING' } as any })

    return {
      drivers,
      meta: buildPaginationMeta(total, page, take),
      totalAll,
      totalPending,
      totalApproved,
      totalVehicleReview,
    }
  }

  async approveDriver(driverProfileId: string, approved: boolean) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
      select: { id: true, isApproved: true, vehicleStatus: true },
    })
    if (!driver) throw Object.assign(new Error('Motorista não encontrado'), { statusCode: 404 })
    if (driver.isApproved === approved) {
      return prisma.driverProfile.findUnique({
        where: { id: driverProfileId },
        select: { id: true, isApproved: true, vehicleStatus: true, user: { select: { name: true, email: true } } },
      })
    }
    const data: DriverProfileUpdateData = { isApproved: approved }
    if (approved && driver.vehicleStatus === 'PENDING') {
      data.vehicleStatus = 'APPROVED'
    }
    const updated = await prisma.driverProfile.update({
      where: { id: driverProfileId },
      data,
      select: { id: true, isApproved: true, vehicleStatus: true, user: { select: { name: true, email: true } } },
    })

    const { subject, html } = tplMotoristaAprovado({ driverName: updated.user.name, approved })
    sendMail(updated.user.email, subject, html).catch(() => {})

    return updated
  }

  async approveVehicle(driverProfileId: string) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
      select: { id: true, vehicleStatus: true },
    })
    if (!driver) throw Object.assign(new Error('Motorista não encontrado'), { statusCode: 404 })
    if (driver.vehicleStatus === 'REVIEW_PENDING') {
      return prisma.driverProfile.update({
        where: { id: driverProfileId },
        data: { vehicleStatus: 'APPROVED' } as any,
        select: { id: true, vehicleStatus: true, user: { select: { name: true, email: true } } },
      })
    }
    throw Object.assign(new Error('Veículo não está aguardando revisão'), { statusCode: 400 })
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
    const now = new Date()
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      totalUsers,
      usersLastMonth,
      activeDrivers,
      driversLastMonth,
      tripsThisMonth,
      tripsLastMonth,
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
      tripsByStatusRaw,
      recentTrips,
      recentQuotes,
      pendingDriversRaw,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { lt: startOfThisMonth } } }),
      prisma.driverProfile.count({ where: { isApproved: true } }),
      prisma.driverProfile.count({ where: { isApproved: true, createdAt: { lt: startOfThisMonth } } }),
      prisma.trip.count({ where: { createdAt: { gte: startOfThisMonth } } }),
      prisma.trip.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),
      prisma.payment.aggregate({ where: { status: PaymentLogStatus.PAID }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: PaymentLogStatus.PAID, createdAt: { gte: startOfThisMonth } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: PaymentLogStatus.PAID, createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } }, _sum: { amount: true } }),
      prisma.trip.groupBy({ by: ['status'], _count: true }),
      prisma.trip.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          passenger: { select: { name: true } },
        },
      }),
      prisma.quote.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          passenger: { select: { name: true } },
          guestName: true,
        },
      }),
      prisma.driverProfile.findMany({
        where: { isApproved: false },
        select: {
          id: true,
          vehicleMake: true,
          vehicleModel: true,
          vehicleYear: true,
          vehiclePlate: true,
          user: { select: { name: true } },
        },
      }),
    ])


    const TRIP_STATUS_LABELS: Record<string, string> = {
      COMPLETED: 'Concluídas',
      IN_PROGRESS: 'Em andamento',
      PENDING: 'Pendentes',
      CANCELLED: 'Canceladas',
      CONFIRMED: 'Confirmadas',
    }

    const tripsByStatus = tripsByStatusRaw.map(s => ({
      status: s.status,
      count: s._count,
      label: TRIP_STATUS_LABELS[s.status] ?? s.status,
    }))

    const revenueThisMonthVal = Number(revenueThisMonth._sum.amount || 0)
    const revenueLastMonthVal = Number(revenueLastMonth._sum.amount || 0)

    // Mescla e ordena atividade recente (viagens + orçamentos), retorna os 8 mais recentes
    const activity = [
      ...recentTrips.map(t => ({
        id: `trip-${t.id}`,
        description: `Nova viagem criada por ${t.passenger?.name ?? 'Passageiro'}`,
        createdAt: t.createdAt,
        type: 'trip',
      })),
      ...recentQuotes.map(q => ({
        id: `quote-${q.id}`,
        description: `Orçamento solicitado por ${q.passenger?.name ?? q.guestName ?? 'Visitante'}`,
        createdAt: q.createdAt,
        type: 'quote',
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)

    return {
      totalUsers,
      deltaUsers: delta(totalUsers - usersLastMonth, usersLastMonth),
      activeDrivers,
      deltaDrivers: delta(activeDrivers - driversLastMonth, driversLastMonth),
      tripsThisMonth,
      deltaTrips: delta(tripsThisMonth, tripsLastMonth),
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      deltaRevenue: delta(revenueThisMonthVal, revenueLastMonthVal),
      tripsByStatus,
      recentActivity: activity,
      pendingDrivers: pendingDriversRaw,
    }
  }
}
