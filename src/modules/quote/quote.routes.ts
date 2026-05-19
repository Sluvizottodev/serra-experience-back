import { Router } from 'express'
import { QuoteController } from './quote.controller'
import { isAuthenticated, isDriver, isPassenger } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { createQuoteSchema, respondQuoteSchema, previewQuoteSchema } from './quote.schema'

const router = Router()
const controller = new QuoteController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

// Rota pública — deve vir ANTES do middleware isAuthenticated
router.post('/preview', validate(previewQuoteSchema), wrap(controller.previewQuote))

router.use(isAuthenticated)

router.post('/', isPassenger, validate(createQuoteSchema), wrap(controller.createQuote))
router.get('/', isPassenger, wrap(controller.getMyQuotes))
router.get('/driver', isDriver, wrap(controller.getDriverQuotes))
router.get('/:id', wrap(controller.getQuote))
router.post('/:id/respond', isDriver, validate(respondQuoteSchema), wrap(controller.respondToQuote))
router.post('/:id/accept', isPassenger, wrap(controller.acceptQuote))
router.post('/:id/reject', isPassenger, wrap(controller.rejectQuote))

export { router as quoteRoutes }
