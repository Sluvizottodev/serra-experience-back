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
    const data = await service.verifyUserDocument(req.params.id, action)
    res.json(data)
  }

  async listDrivers(req: Request, res: Response) {
    const approved = req.query.approved !== undefined ? req.query.approved === 'true' : undefined
    const data = await service.listDrivers(approved, Number(req.query.page) || 1, Number(req.query.limit) || 20)
    res.json(data)
  }

  async approveDriver(req: Request, res: Response) {
    const { approved } = req.body
    const data = await service.approveDriver(req.params.id, Boolean(approved))
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
}
