import { Response } from 'express'
import { UserService } from './user.service'
import { AuthRequest } from '../../common/types'

const service = new UserService()

export class UserController {
  async getMe(req: AuthRequest, res: Response) {
    const data = await service.getMe(req.user!.id)
    res.json(data)
  }

  async updateMe(req: AuthRequest, res: Response) {
    const data = await service.updateMe(req.user!.id, req.body)
    res.json(data)
  }

  async uploadAvatar(req: AuthRequest, res: Response) {
    if (!req.file) {
      res.status(400).json({ error: 'Arquivo não fornecido' })
      return
    }
    const data = await service.uploadAvatar(req.user!.id, req.file.buffer, req.file.mimetype)
    res.json(data)
  }

  async uploadIdDocument(req: AuthRequest, res: Response) {
    if (!req.file) {
      res.status(400).json({ error: 'Arquivo não fornecido' })
      return
    }
    const data = await service.uploadIdDocument(req.user!.id, req.file.buffer)
    res.json(data)
  }
}
