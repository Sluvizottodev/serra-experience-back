import { Router } from 'express'
import { TripController } from './trip.controller'
import { isAuthenticated, isDriver, isPassenger } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { updateTripStatusSchema, cancelTripSchema, reviewSchema } from './trip.schema'

const router = Router()
const controller = new TripController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

router.use(isAuthenticated)

// Token endpoints devem vir antes de /:id para não serem capturados pelo param genérico
router.get('/preview/:token',  isDriver, wrap(controller.previewOpenTrip))
router.post('/claim/:token',   isDriver, wrap(controller.claimOpenTrip))

router.get('/', wrap(controller.getMyTrips))
router.get('/:id', wrap(controller.getTrip))
router.put('/:id/status', isDriver, validate(updateTripStatusSchema), wrap(controller.updateTripStatus))
router.post('/:id/cancel', validate(cancelTripSchema), wrap(controller.cancelTrip))
router.post('/:id/review', isPassenger, validate(reviewSchema), wrap(controller.reviewTrip))

export { router as tripRoutes }
