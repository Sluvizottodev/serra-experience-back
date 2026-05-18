import { Router } from 'express'
import { DriverController } from './driver.controller'
import { isAuthenticated, isDriver } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { upload } from '../../common/middlewares/upload.middleware'
import {
  createDriverProfileSchema,
  updateDriverProfileSchema,
  availabilitySchema,
} from './driver.schema'

const router = Router()
const controller = new DriverController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

// Protected driver routes — must be declared BEFORE /:id to avoid "me" being captured as param
router.post('/profile', isAuthenticated, isDriver, validate(createDriverProfileSchema), wrap(controller.createProfile))
router.put('/profile', isAuthenticated, isDriver, validate(updateDriverProfileSchema), wrap(controller.updateProfile))
router.post('/profile/vehicle-photos', isAuthenticated, isDriver, upload.single('photo'), wrap(controller.uploadVehiclePhoto))
router.get('/me/availability', isAuthenticated, isDriver, wrap(controller.getMyAvailability))
router.post('/me/availability', isAuthenticated, isDriver, validate(availabilitySchema), wrap(controller.addAvailability))
router.put('/me/availability/:id', isAuthenticated, isDriver, wrap(controller.updateAvailability))
router.delete('/me/availability/:id', isAuthenticated, isDriver, wrap(controller.deleteAvailability))

// Public routes — /:id must come last to avoid capturing static segments
router.get('/', wrap(controller.listDrivers))
router.get('/:id', wrap(controller.getDriver))

export { router as driverRoutes }
