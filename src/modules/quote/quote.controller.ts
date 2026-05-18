import { Response } from 'express'
import { QuoteService } from './quote.service'
import { AuthRequest } from '../../common/types'

const service = new QuoteService()

export class QuoteController {
  async createQuote(req: AuthRequest, res: Response) {
    const data = await service.createQuote(req.user!.id, req.body)
    res.status(201).json(data)
  }

  async getMyQuotes(req: AuthRequest, res: Response) {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const data = await service.getMyQuotes(req.user!.id, page, limit)
    res.json(data)
  }

  async getQuote(req: AuthRequest, res: Response) {
    const data = await service.getQuote(req.params.id, req.user!.id)
    res.json(data)
  }

  async getDriverQuotes(req: AuthRequest, res: Response) {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const data = await service.getDriverQuotes(req.user!.id, page, limit)
    res.json(data)
  }

  async respondToQuote(req: AuthRequest, res: Response) {
    const data = await service.respondToQuote(req.params.id, req.user!.id, req.body)
    res.json(data)
  }

  async acceptQuote(req: AuthRequest, res: Response) {
    const data = await service.acceptQuote(req.params.id, req.user!.id)
    res.json(data)
  }

  async rejectQuote(req: AuthRequest, res: Response) {
    const data = await service.rejectQuote(req.params.id, req.user!.id)
    res.json(data)
  }
}
