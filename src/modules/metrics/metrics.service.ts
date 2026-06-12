import * as fastCsv from 'fast-csv'
import { prisma } from '../../common/config/prisma'
import { Response } from 'express'

export type InsightType = 'visits' | 'duration' | 'quotes' | 'trips' | 'revenue'

interface MetricsFilters {
  from?: string
  to?: string
  insights: InsightType[]
}

export class MetricsService {
  async trackSessionStart(visitorId: string): Promise<string> {
    const session = await prisma.pageSession.create({
      data: { visitorId },
    })
    return session.id
  }

  async trackSessionEnd(sessionId: string, visitorId: string): Promise<void> {
    const session = await prisma.pageSession.findFirst({
      where: { id: sessionId, visitorId },
    })
    if (!session || session.exitedAt) return

    const exitedAt = new Date()
    const durationSeconds = Math.round((exitedAt.getTime() - session.enteredAt.getTime()) / 1000)
    await prisma.pageSession.update({
      where: { id: sessionId },
      data: { exitedAt, durationSeconds },
    })
  }

  async getMetrics(filters: MetricsFilters) {
    const from = filters.from ? new Date(filters.from) : undefined
    const to   = filters.to   ? new Date(filters.to)   : undefined
    const dateRange = (field: string) => ({
      ...(from ? { [field]: { gte: from } } : {}),
      ...(to   ? { [field]: { lte: to   } } : {}),
    })

    const result: Record<string, unknown> = {}

    await Promise.all(
      filters.insights.map(async (insight) => {
        switch (insight) {
          case 'visits': {
            const sessions = await prisma.pageSession.findMany({
              where: from || to ? { enteredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {},
              select: { visitorId: true, enteredAt: true },
            })
            const uniqueVisitors = new Set(sessions.map(s => s.visitorId)).size
            result.visits = {
              total: sessions.length,
              uniqueVisitors,
            }
            break
          }

          case 'duration': {
            const sessions = await prisma.pageSession.findMany({
              where: {
                ...(from || to ? { enteredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
                durationSeconds: { not: null },
              },
              select: { durationSeconds: true, visitorId: true, enteredAt: true },
            })

            if (!sessions.length) {
              result.duration = { avgSeconds: 0, medianSeconds: 0, distribution: [] }
              break
            }

            const durations = sessions.map(s => s.durationSeconds as number).sort((a, b) => a - b)
            const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            const mid = Math.floor(durations.length / 2)
            const median = durations.length % 2 === 0
              ? Math.round((durations[mid - 1] + durations[mid]) / 2)
              : durations[mid]

            const distribution = [
              { label: 'Menos de 30s',  count: durations.filter(d => d < 30).length },
              { label: '30s – 2 min',   count: durations.filter(d => d >= 30 && d < 120).length },
              { label: '2 – 5 min',     count: durations.filter(d => d >= 120 && d < 300).length },
              { label: 'Mais de 5 min', count: durations.filter(d => d >= 300).length },
            ]

            result.duration = { avgSeconds: avg, medianSeconds: median, distribution }
            break
          }

          case 'quotes': {
            const where: Record<string, unknown> = {}
            if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
            const count = await prisma.quote.count({ where })
            result.quotes = { total: count }
            break
          }

          case 'trips': {
            const where: Record<string, unknown> = { status: 'COMPLETED' }
            if (from || to) where.updatedAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
            const count = await prisma.trip.count({ where })
            result.trips = { completed: count }
            break
          }

          case 'revenue': {
            const where: Record<string, unknown> = { status: 'PAID' }
            if (from || to) where.paidAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
            const agg = await prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true })
            const settings = await prisma.settings.findUnique({ where: { id: 1 } })
            const commissionRate = Number(settings?.commissionRate ?? 0.1)
            const totalPaid = Number(agg._sum.amount ?? 0)
            result.revenue = {
              totalPaid,
              platformRevenue: Number((totalPaid * commissionRate).toFixed(2)),
              totalTransactions: agg._count,
            }
            break
          }
        }
      })
    )

    return result
  }

  async exportCsv(res: Response, filters: MetricsFilters): Promise<void> {
    const data = await this.getMetrics(filters)

    const rows: string[][] = []

    if (data.visits) {
      const v = data.visits as { total: number; uniqueVisitors: number }
      rows.push(['Insight', 'Métrica', 'Valor'])
      rows.push(['Visitas', 'Total de sessões', String(v.total)])
      rows.push(['Visitas', 'Visitantes únicos', String(v.uniqueVisitors)])
    }

    if (data.duration) {
      const d = data.duration as { avgSeconds: number; medianSeconds: number; distribution: { label: string; count: number }[] }
      if (!rows.length) rows.push(['Insight', 'Métrica', 'Valor'])
      rows.push(['Tempo de Permanência', 'Média (segundos)', String(d.avgSeconds)])
      rows.push(['Tempo de Permanência', 'Mediana (segundos)', String(d.medianSeconds)])
      d.distribution.forEach(dist => {
        rows.push(['Tempo de Permanência', dist.label, String(dist.count)])
      })
    }

    if (data.quotes) {
      const q = data.quotes as { total: number }
      if (!rows.length) rows.push(['Insight', 'Métrica', 'Valor'])
      rows.push(['Orçamentos', 'Total criados', String(q.total)])
    }

    if (data.trips) {
      const t = data.trips as { completed: number }
      if (!rows.length) rows.push(['Insight', 'Métrica', 'Valor'])
      rows.push(['Viagens', 'Concluídas', String(t.completed)])
    }

    if (data.revenue) {
      const r = data.revenue as { totalPaid: number; platformRevenue: number; totalTransactions: number }
      if (!rows.length) rows.push(['Insight', 'Métrica', 'Valor'])
      rows.push(['Receita', 'Total pago (R$)', r.totalPaid.toFixed(2).replace('.', ',')])
      rows.push(['Receita', 'Receita da plataforma (R$)', r.platformRevenue.toFixed(2).replace('.', ',')])
      rows.push(['Receita', 'Total de transações', String(r.totalTransactions)])
    }

    const BOM = '﻿'
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = rows.map(row => row.map(escape).join(';'))

    const now = new Date()
    const dateSuffix = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="metricas_${dateSuffix}.csv"`)
    res.end(BOM + lines.join('\r\n'))
  }
}
