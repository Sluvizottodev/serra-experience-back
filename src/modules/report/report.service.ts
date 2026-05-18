import ExcelJS from 'exceljs'
import { stringify } from 'fast-csv'
import { prisma } from '../../common/config/prisma'
import { Response } from 'express'

export class ReportService {
  async exportTripsExcel(res: Response, filters: { from?: string; to?: string }) {
    const where: Record<string, unknown> = {}
    if (filters.from || filters.to) {
      where.scheduledAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      }
    }

    const trips = await prisma.trip.findMany({
      where,
      include: {
        passenger: { select: { name: true, email: true } },
        driverProfile: { include: { user: { select: { name: true } } } },
        payment: true,
      },
      orderBy: { scheduledAt: 'desc' },
    })

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Viagens')

    sheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Passageiro', key: 'passenger', width: 25 },
      { header: 'Motorista', key: 'driver', width: 25 },
      { header: 'Origem', key: 'origin', width: 35 },
      { header: 'Destino', key: 'destination', width: 35 },
      { header: 'Data Programada', key: 'scheduledAt', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Pagamento', key: 'paymentStatus', width: 15 },
      { header: 'Valor (R$)', key: 'totalPrice', width: 12 },
    ]

    trips.forEach(trip => {
      sheet.addRow({
        id: trip.id,
        passenger: trip.passenger.name,
        driver: trip.driverProfile.user.name,
        origin: trip.originAddress,
        destination: trip.destinationAddress,
        scheduledAt: trip.scheduledAt.toISOString().slice(0, 16),
        status: trip.status,
        paymentStatus: trip.paymentStatus,
        totalPrice: Number(trip.totalPrice),
      })
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=viagens.xlsx')
    await workbook.xlsx.write(res)
    res.end()
  }

  async exportTripsCSV(res: Response, filters: { from?: string; to?: string }) {
    const where: Record<string, unknown> = {}
    if (filters.from || filters.to) {
      where.scheduledAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      }
    }

    const trips = await prisma.trip.findMany({
      where,
      include: {
        passenger: { select: { name: true, email: true } },
        driverProfile: { include: { user: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: 'desc' },
    })

    const rows = trips.map(t => ({
      id: t.id,
      passenger: t.passenger.name,
      driver: t.driverProfile.user.name,
      origin: t.originAddress,
      destination: t.destinationAddress,
      scheduledAt: t.scheduledAt.toISOString().slice(0, 16),
      status: t.status,
      paymentStatus: t.paymentStatus,
      totalPrice: Number(t.totalPrice),
    }))

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=viagens.csv')
    stringify(rows, { headers: true }).pipe(res)
  }

  async getRevenue(filters: { from?: string; to?: string }) {
    const where: Record<string, unknown> = { status: 'PAID' }
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      }
    }

    const [total, byMonth] = await Promise.all([
      prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true }),
      prisma.$queryRaw<{ month: string; total: number }[]>`
        SELECT TO_CHAR(paid_at, 'YYYY-MM') as month, SUM(amount) as total
        FROM payments
        WHERE status = 'PAID'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `,
    ])

    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    const commissionRate = Number(settings?.commissionRate || 0.1)
    const platformRevenue = Number(total._sum.amount || 0) * commissionRate

    return {
      totalPaid: Number(total._sum.amount || 0),
      platformRevenue,
      totalTransactions: total._count,
      byMonth,
    }
  }

  async getDriversReport() {
    return prisma.driverProfile.findMany({
      select: {
        id: true,
        vehicleMake: true,
        vehicleModel: true,
        rating: true,
        totalTrips: true,
        isApproved: true,
        isAvailable: true,
        user: { select: { name: true, email: true } },
        _count: { select: { trips: true, reviews: true } },
      },
      orderBy: { totalTrips: 'desc' },
    })
  }
}
