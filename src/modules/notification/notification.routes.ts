import { Router, text } from 'express'
import { NotificationController } from './notification.controller'

const router = Router()
const controller = new NotificationController()

// QStash assina o corpo bruto (string) da requisição — precisa chegar
// sem passar pelo express.json() global, por isso esta rota é montada
// antes dele em app.ts.
router.post('/dispatch', text({ type: '*/*' }), (req, res) =>
  controller.dispatch(req, res).catch((err: unknown) => {
    const status = (err as { statusCode?: number })?.statusCode ?? 400
    res.status(status).json({ error: (err as Error).message })
  }),
)

export { router as notificationRoutes }
