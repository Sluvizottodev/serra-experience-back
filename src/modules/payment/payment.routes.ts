import { Router } from 'express'
import { PaymentController } from './payment.controller'
import { isAuthenticated } from '../../common/middlewares/auth.middleware'

const router = Router()
const controller = new PaymentController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

router.post('/webhook', wrap(controller.handleWebhook))
router.post('/trip/:tripId', isAuthenticated, wrap(controller.createCharge))
router.get('/trip/:tripId', isAuthenticated, wrap(controller.getPaymentStatus))

export { router as paymentRoutes }
