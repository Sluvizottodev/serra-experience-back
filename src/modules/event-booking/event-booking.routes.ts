import { Router } from 'express'
import { EventBookingController } from './event-booking.controller'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { upsertDateSlotsSchema, createBookingSchema } from './event-booking.schema'

const router = Router()
const controller = new EventBookingController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

// public — no auth required
router.get('/:eventId/availability', wrap(controller.getAvailability))

// admin only
router.use(isAuthenticated, isAdmin)
router.put('/:eventId/date-slots', validate(upsertDateSlotsSchema), wrap(controller.upsertDateSlots))
router.get('/:eventId/bookings', wrap(controller.listBookings))
router.post('/:eventId/bookings', validate(createBookingSchema), wrap(controller.createBooking))
router.put('/:id/confirm', wrap(controller.confirmBooking))
router.put('/:id/cancel', wrap(controller.cancelBooking))

export { router as eventBookingRoutes }
