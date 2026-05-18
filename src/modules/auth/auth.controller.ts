import { Request, Response } from 'express'
import { AuthService } from './auth.service'

const service = new AuthService()

export class AuthController {
  async register(req: Request, res: Response) {
    const result = await service.register(req.body)
    res.status(201).json(result)
  }

  async login(req: Request, res: Response) {
    const result = await service.login(req.body, res)
    res.json(result)
  }

  async verifyOtp(req: Request, res: Response) {
    const result = await service.verifyOtp(req.body)
    res.json(result)
  }

  async refreshToken(req: Request, res: Response) {
    const token = req.cookies?.refreshToken
    const result = await service.refreshToken(token, res)
    res.json(result)
  }

  async logout(req: Request, res: Response) {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.split(' ')[1] || ''
    const refreshToken = req.cookies?.refreshToken || ''
    const result = await service.logout(token, refreshToken, res)
    res.json(result)
  }

  async forgotPassword(req: Request, res: Response) {
    const result = await service.forgotPassword(req.body)
    res.json(result)
  }

  async resetPassword(req: Request, res: Response) {
    const result = await service.resetPassword(req.body)
    res.json(result)
  }
}
