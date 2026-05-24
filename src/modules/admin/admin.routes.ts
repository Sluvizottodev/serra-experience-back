import { Router } from 'express'
import { AdminController } from './admin.controller'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'

const router = Router()
const controller = new AdminController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

router.use(isAuthenticated, isAdmin)

router.get('/dashboard', wrap(controller.getDashboard))
router.post('/users/create-admin', wrap(controller.createAdmin))
router.get('/users', wrap(controller.listUsers))
router.put('/users/:id/verify-id', wrap(controller.verifyUserDocument))
router.get('/drivers', wrap(controller.listDrivers))
router.put('/drivers/:id/approve', wrap(controller.approveDriver))
router.get('/settings', wrap(controller.getSettings))
router.put('/settings', wrap(controller.updateSettings))
router.get('/payment-logs', wrap(controller.getPaymentLogs))
router.get('/trips', wrap(controller.listTrips))

router.get('/reviews', wrap(controller.listReviews))
router.patch('/reviews/:id/visibility', wrap(controller.updateReviewVisibility))
router.patch('/reviews/:id/comment', wrap(controller.updateReviewComment))
router.delete('/reviews/:id', wrap(controller.deleteReview))

export { router as adminRoutes }
