import { Request, Response } from 'express'
import { EventBookingService } from './event-booking.service'

const service = new EventBookingService()

export class EventBookingController {
  async getAvailability(req: Request, res: Response) {
    const data = await service.getAvailability(String(req.params.eventId))
    res.json(data)
  }

  async upsertDateSlots(req: Request, res: Response) {
    const data = await service.upsertDateSlots(String(req.params.eventId), req.body)
    res.json(data)
  }

  async createBooking(req: Request, res: Response) {
    const data = await service.createBooking(String(req.params.eventId), req.body)
    res.status(201).json(data)
  }

  async listBookings(req: Request, res: Response) {
    const data = await service.listBookings(String(req.params.eventId))
    res.json(data)
  }

  async confirmBooking(req: Request, res: Response) {
    const data = await service.confirmBooking(String(req.params.id))
    res.json(data)
  }

  async cancelBooking(req: Request, res: Response) {
    const data = await service.cancelBooking(String(req.params.id))
    res.json(data)
  }
}
