import { Router } from 'express'
import { MessageController } from './message.controller'
import { isAuthenticated } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { sendMessageSchema } from './message.schema'

const router = Router()
const controller = new MessageController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

router.use(isAuthenticated)

router.get('/:quoteId', wrap(controller.getMessages))
router.post('/:quoteId', validate(sendMessageSchema), wrap(controller.sendMessage))

export { router as messageRoutes }
