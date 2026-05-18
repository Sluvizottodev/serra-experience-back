import { Request, Response } from 'express'
import { DriverService } from './driver.service'
import { AuthRequest } from '../../common/types'

const service = new DriverService()

export class DriverController {
  async listDrivers(req: Request, res: Response) {
    const data = await service.listDrivers(req.query as Record<string, string>)
    res.json(data)
  }

  async getDriver(req: Request, res: Response) {
    const data = await service.getDriver(req.params.id)
    res.json(data)
  }

  async createProfile(req: AuthRequest, res: Response) {
    const data = await service.createProfile(req.user!.id, req.body)
    res.status(201).json(data)
  }

  async updateProfile(req: AuthRequest, res: Response) {
    const data = await service.updateProfile(req.user!.id, req.body)
    res.json(data)
  }

  async uploadVehiclePhoto(req: AuthRequest, res: Response) {
    if (!req.file) {
      res.status(400).json({ error: 'Arquivo não fornecido' })
      return
    }
    const data = await service.uploadVehiclePhoto(req.user!.id, req.file.buffer)
    res.json(data)
  }

  async getMyAvailability(req: AuthRequest, res: Response) {
    const data = await service.getMyAvailability(req.user!.id)
    res.json(data)
  }

  async addAvailability(req: AuthRequest, res: Response) {
    const data = await service.addAvailability(req.user!.id, req.body)
    res.status(201).json(data)
  }

  async updateAvailability(req: AuthRequest, res: Response) {
    const data = await service.updateAvailability(req.user!.id, req.params.id, req.body)
    res.json(data)
  }

  async deleteAvailability(req: AuthRequest, res: Response) {
    const data = await service.deleteAvailability(req.user!.id, req.params.id)
    res.json(data)
  }
}
