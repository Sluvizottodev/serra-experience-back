import { Request, Response } from 'express'
import { PaymentService } from './payment.service'
import { AuthRequest } from '../../common/types'

const service = new PaymentService()

export class PaymentController {
  async createCharge(req: AuthRequest, res: Response) {
    const data = await service.createCharge(String(req.params.tripId), req.user!.id)
    res.status(201).json(data)
  }

  async getPaymentStatus(req: AuthRequest, res: Response) {
    const data = await service.getPaymentStatus(String(req.params.tripId), req.user!.id)
    res.json(data)
  }

  async handleWebhook(req: Request, res: Response) {
    const sellerToken = req.headers['x-seller-token'] as string | undefined
    const data = await service.handleWebhook(req.body, sellerToken)
    res.json(data)
  }
}
