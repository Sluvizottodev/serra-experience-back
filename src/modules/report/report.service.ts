import ExcelJS from 'exceljs'
import * as fastCsv from 'fast-csv'
import { prisma } from '../../common/config/prisma'
import { Response } from 'express'

export class ReportService {
  private statusLabel(s: string): string {
    return ({ PENDING: 'Pendente', CONFIRMED: 'Confirmada', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluída', CANCELLED: 'Cancelada' } as Record<string, string>)[s] ?? s
  }

  private paymentLabel(p: string): string {
    return ({ PAID: 'Pago', UNPAID: 'Pendente', REFUNDED: 'Reembolsado' } as Record<string, string>)[p] ?? p
  }

  private formatDateBR(d: Date): string {
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  }

  private filenameDateSuffix(): string {
    const now = new Date()
    return now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-')
  }

  async exportTripsExcel(res: Response, filters: { from?: string; to?: string; status?: string }) {
    const where: Record<string, unknown> = {}
    if (filters.from || filters.to) {
      where.scheduledAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to   ? { lte: new Date(filters.to)   } : {}),
      }
    }
    if (filters.status && filters.status !== 'ALL') where.status = filters.status

    const trips = await prisma.trip.findMany({
      where,
      include: {
        passenger: { select: { name: true, email: true } },
        driverProfile: { include: { user: { select: { name: true, email: true } } } },
        payment: true,
      },
      orderBy: { scheduledAt: 'desc' },
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Serra Experience'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Viagens', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    sheet.columns = [
      { header: 'Passageiro',          key: 'passenger',      width: 28 },
      { header: 'E-mail Passageiro',   key: 'passengerEmail', width: 30 },
      { header: 'Motorista',           key: 'driver',         width: 28 },
      { header: 'E-mail Motorista',    key: 'driverEmail',    width: 30 },
      { header: 'Origem',              key: 'origin',         width: 38 },
      { header: 'Destino',             key: 'destination',    width: 38 },
      { header: 'Data Programada',     key: 'scheduledAt',    width: 22 },
      { header: 'Status',              key: 'status',         width: 18 },
      { header: 'Pagamento',           key: 'paymentStatus',  width: 16 },
      { header: 'Valor (R$)',          key: 'totalPrice',     width: 14 },
      { header: 'ID',                  key: 'id',             width: 38 },
    ]

    // Header row styling
    const headerRow = sheet.getRow(1)
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FFA98549' } },
      }
    })
    headerRow.height = 22

    // Status color map (ARGB)
    const statusFill: Record<string, string> = {
      COMPLETED:   'FF1A3D2B',
      CANCELLED:   'FF3D1A1A',
      IN_PROGRESS: 'FF3D2F0A',
      CONFIRMED:   'FF2A2010',
      PENDING:     'FF2E2A20',
    }

    trips.forEach((trip, i) => {
      const row = sheet.addRow({
        passenger:      trip.passenger.name,
        passengerEmail: trip.passenger.email,
        driver:         trip.driverProfile.user.name,
        driverEmail:    trip.driverProfile.user.email,
        origin:         trip.originAddress,
        destination:    trip.destinationAddress,
        scheduledAt:    this.formatDateBR(trip.scheduledAt),
        status:         this.statusLabel(trip.status),
        paymentStatus:  this.paymentLabel(trip.paymentStatus),
        totalPrice:     Number(trip.totalPrice),
        id:             trip.id,
      })

      const rowFill = i % 2 === 0 ? 'FF111111' : 'FF191919'
      row.eachCell(cell => {
        cell.font = { color: { argb: 'FFD4D0CA' }, size: 10 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } }
        cell.alignment = { vertical: 'middle' }
      })

      // Highlight status cell
      const statusCell = row.getCell('status')
      const fill = statusFill[trip.status]
      if (fill) statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }

      // Price formatting
      const priceCell = row.getCell('totalPrice')
      priceCell.numFmt = 'R$ #,##0.00'
      priceCell.font = { color: { argb: 'FFA98549' }, bold: true, size: 10 }
    })

    // Auto-filter on header
    sheet.autoFilter = { from: 'A1', to: 'K1' }

    const filename = `viagens_${this.filenameDateSuffix()}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    await workbook.xlsx.write(res)
    res.end()
  }

  async exportTripsCSV(res: Response, filters: { from?: string; to?: string; status?: string }) {
    const where: Record<string, unknown> = {}
    if (filters.from || filters.to) {
      where.scheduledAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to   ? { lte: new Date(filters.to)   } : {}),
      }
    }
    if (filters.status && filters.status !== 'ALL') where.status = filters.status

    const trips = await prisma.trip.findMany({
      where,
      include: {
        passenger: { select: { name: true, email: true } },
        driverProfile: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { scheduledAt: 'desc' },
    })

    // BOM UTF-8 so Excel opens accented chars correctly
    const BOM = '﻿'

    const headers = ['Passageiro', 'E-mail Passageiro', 'Motorista', 'E-mail Motorista', 'Origem', 'Destino', 'Data Programada', 'Status', 'Pagamento', 'Valor (R$)', 'ID']

    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`

    const lines = [
      headers.map(escape).join(';'),
      ...trips.map(t => [
        t.passenger.name,
        t.passenger.email,
        t.driverProfile.user.name,
        t.driverProfile.user.email,
        t.originAddress,
        t.destinationAddress,
        this.formatDateBR(t.scheduledAt),
        this.statusLabel(t.status),
        this.paymentLabel(t.paymentStatus),
        Number(t.totalPrice).toFixed(2).replace('.', ','),
        t.id,
      ].map(escape).join(';')),
    ]

    const filename = `viagens_${this.filenameDateSuffix()}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.end(BOM + lines.join('\r\n'))
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
