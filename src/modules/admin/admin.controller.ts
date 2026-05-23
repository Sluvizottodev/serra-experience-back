import { Request, Response } from 'express'
import { AdminService } from './admin.service'

const service = new AdminService()

export class AdminController {
  async listUsers(req: Request, res: Response) {
    const data = await service.listUsers(Number(req.query.page) || 1, Number(req.query.limit) || 20)
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
    const approved = req.query.approved !== undefined ? req.query.approved === 'true' : undefined
    const data = await service.listDrivers(approved, Number(req.query.page) || 1, Number(req.query.limit) || 20)
    res.json(data)
  }

  async approveDriver(req: Request, res: Response) {
    const { approved } = req.body
    const data = await service.approveDriver(String(req.params.id), Boolean(approved))
    res.json(data)
  }

  async getSettings(_req: Request, res: Response) {
    const data = await service.getSettings()
    res.json(data)
  }

  async updateSettings(req: Request, res: Response) {
    const data = await service.updateSettings(req.body)
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
    if (typeof comment === 'string' && comment.length > 300) {
      res.status(400).json({ error: 'Comentário não pode ultrapassar 300 caracteres' })
      return
    }
    const data = await service.updateReviewComment(String(req.params.id), comment ?? null)
    res.json(data)
  }

  async deleteReview(req: Request, res: Response) {
    await service.deleteReview(String(req.params.id))
    res.status(204).send()
  }
}
