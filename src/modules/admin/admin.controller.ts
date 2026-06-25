import { Request, Response } from 'express'
import { AdminService } from './admin.service'
import { QuoteService } from '../quote/quote.service'

const service = new AdminService()
const quoteService = new QuoteService()

export class AdminController {
  async createAdmin(req: Request, res: Response) {
    const { name, email, password } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome é obrigatório.' }); return
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'E-mail inválido.' }); return
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres.' }); return
    }
    const data = await service.createAdmin({ name: name.trim(), email: email.trim().toLowerCase(), password })
    res.status(201).json(data)
  }

  async listUsers(req: Request, res: Response) {
    const data = await service.listUsers(Number(req.query.page) || 1, Number(req.query.limit) || 20)
    res.json(data)
  }

  async getUserDetail(req: Request, res: Response) {
    const data = await service.getUserDetail(String(req.params.id))
    res.json(data)
  }

  async verifyUserDocument(req: Request, res: Response) {
    const { action } = req.body
    if (!['APPROVED', 'REJECTED'].includes(action)) {
      res.status(400).json({ error: 'Ação inválida' })
      return
    }
    const data = await service.verifyUserDocument(String(req.params.id), action)
    res.json(data)
  }

  async listDrivers(req: Request, res: Response) {
    const approved = req.query.approved === undefined ? undefined : req.query.approved === 'true'
    const vehicleStatus = typeof req.query.vehicleStatus === 'string' ? req.query.vehicleStatus : undefined
    const data = await service.listDrivers(approved, vehicleStatus, Number(req.query.page) || 1, Number(req.query.limit) || 20)
    res.json(data)
  }

  async approveDriver(req: Request, res: Response) {
    const { approved } = req.body
    if (typeof approved === 'boolean') {
      const data = await service.approveDriver(String(req.params.id), approved)
      res.json(data)
      return
    }
    res.status(400).json({ error: 'approved deve ser booleano' })
  }

  async approveVehicle(req: Request, res: Response) {
    const data = await service.approveVehicle(String(req.params.id))
    res.json(data)
  }

  async getSettings(_req: Request, res: Response) {
    const data = await service.getSettings()
    res.json(data)
  }

  async updateSettings(req: Request, res: Response) {
    const body = { ...req.body }
    if (body.assignLinkExpiryHours !== undefined) {
      const hours = Number(body.assignLinkExpiryHours)
      if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
        res.status(400).json({ error: 'Validade do link deve ser um número entre 1 e 720 horas' })
        return
      }
      body.assignLinkExpiryHours = Math.round(hours)
    }
    const data = await service.updateSettings(body)
    res.json(data)
  }

  async getPaymentLogs(req: Request, res: Response) {
    const data = await service.getPaymentLogs(Number(req.query.page) || 1, Number(req.query.limit) || 50)
    res.json(data)
  }

  async getDashboard(_req: Request, res: Response) {
    const data = await service.getDashboardStats()
    res.json(data)
  }

  async listReviews(req: Request, res: Response) {
    const visible = req.query.visible !== undefined ? req.query.visible === 'true' : undefined
    const data = await service.listReviews(Number(req.query.page) || 1, Number(req.query.limit) || 20, visible)
    res.json(data)
  }

  async updateReviewVisibility(req: Request, res: Response) {
    const { isVisible } = req.body
    if (typeof isVisible !== 'boolean') {
      res.status(400).json({ error: 'isVisible deve ser booleano' })
      return
    }
    const data = await service.updateReviewVisibility(String(req.params.id), isVisible)
    res.json(data)
  }

  async updateReviewComment(req: Request, res: Response) {
    const { comment } = req.body
    if (comment !== null && comment !== undefined && typeof comment !== 'string') {
      res.status(400).json({ error: 'comment deve ser string ou null' })
      return
    }
    if (typeof comment === 'string' && comment.trim().length > 300) {
      res.status(400).json({ error: 'Comentário não pode ultrapassar 300 caracteres' })
      return
    }
    const data = await service.updateReviewComment(String(req.params.id), comment ?? null)
    res.json(data)
  }

  async deleteReview(req: Request, res: Response) {
    const deleted = await service.deleteReview(String(req.params.id))
    if (!deleted) { res.status(404).json({ error: 'Avaliação não encontrada' }); return }
    res.status(204).send()
  }

  async toggleUserLock(req: Request, res: Response) {
    const { lock } = req.body
    if (typeof lock !== 'boolean') {
      res.status(400).json({ error: 'lock deve ser booleano' }); return
    }
    const data = await service.toggleUserLock(String(req.params.id), lock)
    res.json(data)
  }

  async deleteUser(req: Request, res: Response) {
    const deleted = await service.deleteUser(String(req.params.id))
    if (!deleted) { res.status(404).json({ error: 'Usuário não encontrado' }); return }
    res.status(204).send()
  }

  async listQuotes(req: Request, res: Response) {
    const { page, limit, status } = req.query as Record<string, string>
    const data = await service.listQuotes(
      Number(page) || 1,
      Number(limit) || 20,
      status || undefined,
    )
    res.json(data)
  }

  async listTrips(req: Request, res: Response) {
    const { page, limit, status, search } = req.query as Record<string, string>
    const data = await service.listAdminTrips(
      Number(page) || 1,
      Number(limit) || 10,
      status || undefined,
      search || undefined,
    )
    res.json(data)
  }

  async assignQuoteDirect(req: Request, res: Response) {
    const quoteId  = String(req.params.id)
    const driverId = req.body?.driverId

    if (!driverId || typeof driverId !== 'string') {
      res.status(400).json({ error: 'driverId é obrigatório' })
      return
    }

    const data = await quoteService.assignDirect(quoteId, driverId)
    res.status(201).json(data)
  }

  async assignQuoteOpen(req: Request, res: Response) {
    const quoteId = String(req.params.id)
    const data = await quoteService.assignOpen(quoteId)
    res.status(201).json(data)
  }

  async revokeQuoteOpen(req: Request, res: Response) {
    const quoteId = String(req.params.id)
    const data = await quoteService.revokeOpenLink(quoteId)
    res.json(data)
  }
}
