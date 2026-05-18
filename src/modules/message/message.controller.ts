import { Response } from 'express'
import { MessageService } from './message.service'
import { AuthRequest } from '../../common/types'

const service = new MessageService()

export class MessageController {
  async getMessages(req: AuthRequest, res: Response) {
    const messages = await service.getMessagesByQuote(req.params.quoteId as string, req.user!.id)
    res.json(messages)
  }

  async sendMessage(req: AuthRequest, res: Response) {
    const message = await service.sendMessage(req.params.quoteId as string, req.user!.id, req.body.content)
    res.status(201).json(message)
  }
}
