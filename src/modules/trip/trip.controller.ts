import { Response } from 'express'
import { TripService } from './trip.service'
import { AuthRequest } from '../../common/types'

const service = new TripService()

export class TripController {
  async getMyTrips(req: AuthRequest, res: Response) {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const data = await service.getMyTrips(req.user!.id, req.user!.role, page, limit)
    res.json(data)
  }

  async getTrip(req: AuthRequest, res: Response) {
    const data = await service.getTrip(String(req.params.id), req.user!.id, req.user!.role)
    res.json(data)
  }

  async updateTripStatus(req: AuthRequest, res: Response) {
    const data = await service.updateTripStatus(String(req.params.id), req.user!.id, req.body)
    res.json(data)
  }

  async cancelTrip(req: AuthRequest, res: Response) {
    const data = await service.cancelTrip(String(req.params.id), req.user!.id, req.user!.role, req.body)
    res.json(data)
  }

  async reviewTrip(req: AuthRequest, res: Response) {
    const data = await service.reviewTrip(String(req.params.id), req.user!.id, req.body)
    res.json(data)
  }
}
