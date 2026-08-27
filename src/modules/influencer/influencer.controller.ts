import { Request, Response } from 'express'
import { InfluencerService } from './influencer.service'

const service = new InfluencerService()

export class InfluencerController {
  async listAdmin(_req: Request, res: Response) {
    const influencers = await service.listInfluencers(false)
    res.json(influencers)
  }

  async create(req: Request, res: Response) {
    const { name, handle, notes, active } = req.body
    const influencer = await service.createInfluencer({ name, handle, notes, active })
    res.status(201).json(influencer)
  }

  async update(req: Request, res: Response) {
    const { name, handle, notes, active } = req.body
    const data: Record<string, unknown> = {}
    if (name !== undefined)   data.name   = name
    if (handle !== undefined) data.handle = handle
    if (notes !== undefined)  data.notes  = notes
    if (active !== undefined) data.active = active
    const influencer = await service.updateInfluencer(String(req.params.id), data)
    res.json(influencer)
  }

  async remove(req: Request, res: Response) {
    await service.deleteInfluencer(String(req.params.id))
    res.status(204).send()
  }

  async createLink(req: Request, res: Response) {
    const { eventId, code } = req.body
    const link = await service.createLink(String(req.params.influencerId), eventId, code)
    res.status(201).json(link)
  }

  async listLinksByInfluencer(req: Request, res: Response) {
    const links = await service.listLinksForInfluencer(String(req.params.influencerId))
    res.json(links)
  }

  async listLinksByEvent(req: Request, res: Response) {
    const links = await service.listLinksForEvent(String(req.params.eventId))
    res.json(links)
  }

  async trackView(req: Request, res: Response) {
    const { code, visitorId } = req.body
    if (typeof code === 'string' && code) {
      await service.trackView(code, typeof visitorId === 'string' ? visitorId : undefined)
    }
    res.status(204).send()
  }

  async trackConversion(req: Request, res: Response) {
    const { code, visitorId } = req.body
    if (typeof code === 'string' && code) {
      await service.trackConversion(code, typeof visitorId === 'string' ? visitorId : undefined)
    }
    res.status(204).send()
  }

  async getMetrics(req: Request, res: Response) {
    const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : undefined
    const influencerId = typeof req.query.influencerId === 'string' ? req.query.influencerId : undefined
    const metrics = await service.getMetrics({ eventId, influencerId })
    res.json(metrics)
  }
}
