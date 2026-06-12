import { Request, Response } from 'express'
import { MetricsService, InsightType } from './metrics.service'

const service = new MetricsService()

export class MetricsController {
  async sessionStart(req: Request, res: Response) {
    const { visitorId } = req.body as { visitorId: string }
    if (!visitorId) return res.status(400).json({ error: 'visitorId obrigatório' })
    const sessionId = await service.trackSessionStart(visitorId)
    res.json({ sessionId })
  }

  async sessionEnd(req: Request, res: Response) {
    const { sessionId, visitorId } = req.body as { sessionId: string; visitorId: string }
    if (!sessionId || !visitorId) return res.status(400).json({ error: 'sessionId e visitorId obrigatórios' })
    await service.trackSessionEnd(sessionId, visitorId)
    res.json({ ok: true })
  }

  async getMetrics(req: Request, res: Response) {
    const { from, to, insights } = req.query as Record<string, string>
    const insightList = insights
      ? (insights.split(',') as InsightType[])
      : (['visits', 'duration', 'quotes', 'trips', 'revenue'] as InsightType[])
    const data = await service.getMetrics({ from, to, insights: insightList })
    res.json(data)
  }

  async exportCsv(req: Request, res: Response) {
    const { from, to, insights } = req.query as Record<string, string>
    const insightList = insights
      ? (insights.split(',') as InsightType[])
      : (['visits', 'duration', 'quotes', 'trips', 'revenue'] as InsightType[])
    await service.exportCsv(res, { from, to, insights: insightList })
  }
}
